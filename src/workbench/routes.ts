import { extname } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

import { healthFromConfig, type WorkbenchConfig } from "./config.js";
import { WorkbenchArtifactStore } from "./artifacts.js";
import { WorkbenchJobRunner } from "./jobs.js";
import type { WorkbenchWorkflow } from "./events.js";

export interface WorkbenchRouteContext {
  config: WorkbenchConfig;
  artifactStore: WorkbenchArtifactStore;
  jobRunner: WorkbenchJobRunner;
}

const json = (response: ServerResponse, statusCode: number, payload: unknown): void => {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
};

const structuredError = (response: ServerResponse, statusCode: number, code: string, message: string): void => {
  json(response, statusCode, { error: { code, message } });
};

const contentTypeFor = (fileName: string): string => {
  if (extname(fileName) === ".json") {
    return "application/json; charset=utf-8";
  }

  if (extname(fileName) === ".md") {
    return "text/markdown; charset=utf-8";
  }

  if (extname(fileName) === ".html") {
    return "text/html; charset=utf-8";
  }

  return "text/plain; charset=utf-8";
};

const readRequestBody = async (request: IncomingMessage, limitBytes: number): Promise<string> =>
  new Promise((resolve, reject) => {
    let body = "";
    let tooLarge = false;

    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      if (tooLarge) {
        return;
      }

      body += chunk;

      if (Buffer.byteLength(body, "utf8") > limitBytes) {
        tooLarge = true;
        reject(new Error("Request body exceeds workbench limit."));
      }
    });
    request.on("end", () => {
      if (!tooLarge) {
        resolve(body);
      }
    });
    request.on("error", reject);
  });

const localhostOriginAllowed = (request: IncomingMessage): boolean => {
  const origin = request.headers["origin"];

  if (!origin) {
    return true;
  }

  try {
    const parsed = new URL(Array.isArray(origin) ? origin[0] : origin);

    return parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  } catch {
    return false;
  }
};

const workflows = new Set<WorkbenchWorkflow>([
  "fixture-certification",
  "live-smoke",
  "live-candidates",
  "live-security-readiness",
  "live-security-proof"
]);

const parseWorkflow = (value: string): WorkbenchWorkflow | undefined =>
  workflows.has(value as WorkbenchWorkflow) ? (value as WorkbenchWorkflow) : undefined;

export const createWorkbenchApiHandler =
  (context: WorkbenchRouteContext) =>
  async (request: IncomingMessage, response: ServerResponse): Promise<boolean> => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    if (!url.pathname.startsWith("/api/")) {
      return false;
    }

    try {
      if (!localhostOriginAllowed(request)) {
        structuredError(response, 403, "WORKBENCH_ORIGIN_FORBIDDEN", "Workbench API accepts localhost origins only.");
        return true;
      }

      if (request.method === "GET" && url.pathname === "/api/health") {
        json(response, 200, healthFromConfig(context.config));
        return true;
      }

      if (request.method === "POST" && url.pathname.startsWith("/api/jobs/")) {
        const workflow = parseWorkflow(decodeURIComponent(url.pathname.slice("/api/jobs/".length)));

        if (!workflow) {
          structuredError(response, 404, "WORKBENCH_WORKFLOW_NOT_FOUND", "Unsupported workbench workflow.");
          return true;
        }

        await readRequestBody(request, context.config.maxRequestBytes);
        json(response, 202, { job: await context.jobRunner.createJob(workflow) });
        return true;
      }

      if (request.method === "GET" && url.pathname === "/api/jobs") {
        json(response, 200, { jobs: context.jobRunner.listJobs() });
        return true;
      }

      if (request.method === "GET" && url.pathname.startsWith("/api/jobs/")) {
        const parts = url.pathname.split("/").filter(Boolean);
        const job = context.jobRunner.getJob(parts[2] ?? "");

        if (!job) {
          structuredError(response, 404, "WORKBENCH_JOB_NOT_FOUND", "Workbench job was not found.");
          return true;
        }

        if (parts[3] === "events") {
          json(response, 200, { events: job.events });
          return true;
        }

        json(response, 200, { job });
        return true;
      }

      if (request.method === "GET" && url.pathname === "/api/artifacts") {
        json(response, 200, { runs: await context.artifactStore.listRuns() });
        return true;
      }

      if (request.method === "GET" && url.pathname.startsWith("/api/artifacts/")) {
        const path = decodeURIComponent(url.pathname.slice("/api/artifacts/".length));
        const [runId, ...fileParts] = path.split("/");
        const fileName = fileParts.join("/");

        if (!runId || !fileName) {
          structuredError(response, 404, "WORKBENCH_ARTIFACT_NOT_FOUND", "Artifact file was not found.");
          return true;
        }

        const file = await context.artifactStore.readFile(runId, fileName);

        if (!file) {
          response.statusCode = 204;
          response.end();
          return true;
        }

        response.statusCode = 200;
        response.setHeader("content-type", contentTypeFor(fileName));
        response.end(file);
        return true;
      }

      structuredError(response, 404, "WORKBENCH_ROUTE_NOT_FOUND", "Workbench API route was not found.");
      return true;
    } catch (error) {
      structuredError(response, 400, "WORKBENCH_REQUEST_FAILED", error instanceof Error ? error.message : String(error));
      return true;
    }
  };
