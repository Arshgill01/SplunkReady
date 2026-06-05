import { extname } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

import { healthFromConfig, type WorkbenchConfig } from "./config.js";
import {
  parseExternalTraceCertificationPayload,
  parseMcpTranscriptCertificationPayload,
  type ExternalCertificationPayload
} from "../workflows/external-certification.js";
import { runManifestVerificationWorkflow } from "../workflows/manifest-verification.js";
import { WorkbenchArtifactStore } from "./artifacts.js";
import {
  WorkbenchJobRunner,
  type CertificationIndexPayload,
  type PublicProofExportPayload,
  type WorkbenchWorkflowPayload
} from "./jobs.js";
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const stringField = (value: unknown, key: string): string | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const field = value[key];
  return typeof field === "string" && field.length > 0 ? field : undefined;
};

const numberField = (value: unknown, key: string): number | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const field = value[key];
  return typeof field === "number" ? field : undefined;
};

const arrayField = (value: unknown, key: string): unknown[] => {
  if (!isRecord(value)) {
    return [];
  }

  const field = value[key];
  return Array.isArray(field) ? field : [];
};

const readRunJson = async (store: WorkbenchArtifactStore, runId: string, fileName: string): Promise<unknown> => {
  const file = await store.readFile(runId, fileName);

  if (!file) {
    return undefined;
  }

  try {
    return JSON.parse(file.toString("utf8")) as unknown;
  } catch {
    return undefined;
  }
};

const inferWorkflow = (files: string[]): WorkbenchWorkflow | "artifact-bundle" => {
  const has = (fileName: string): boolean => files.includes(fileName);

  if (has("mcp-transcript-import.json")) {
    return "mcp-transcript-certification";
  }

  if (has("certification-index.json")) {
    return "certification-index";
  }

  if (has("public-proof-export-manifest.json")) {
    return "public-proof-export";
  }

  if (has("receipt-external-001.json")) {
    return "external-trace-certification";
  }

  if (has("firewall-block-before.json") || has("firewall-check.json")) {
    return "firewall-check";
  }

  if (has("policy-patch.json") && has("receipt-before-001.json") && has("receipt-after-001.json")) {
    return "policy-backed-rerun";
  }

  if (has("live-security-proof-summary.json")) {
    return "live-security-proof";
  }

  if (has("live-security-kit.json")) {
    return "live-security-kit";
  }

  if (has("live-security-readiness.json")) {
    return "live-security-readiness";
  }

  if (has("hosted-model-proof.json")) {
    return "hosted-model-proof";
  }

  if (has("hosted-model-diagnostic.json")) {
    return "hosted-model-diagnostic";
  }

  if (has("live-candidates.json")) {
    return "live-candidates";
  }

  if (has("live-smoke-contract.json")) {
    return "live-smoke";
  }

  if (has("receipt-before-001.json") || has("receipt-after-001.json")) {
    return "fixture-certification";
  }

  return "artifact-bundle";
};

const createdAtFromRunId = (runId: string): string => {
  const match = runId.match(/^run-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z-/);

  if (!match) {
    return runId.replace(/^run-/, "");
  }

  const [, date, hours, minutes, seconds, milliseconds] = match;

  return `${date}T${hours}:${minutes}:${seconds}.${milliseconds}Z`;
};

const summarizeRun = async (context: WorkbenchRouteContext, runId: string, fileCount: number) => {
  const files = await context.artifactStore.listRunFiles(runId);
  const job = context.jobRunner.listJobs().find((candidate) => candidate.runId === runId);
  const receipt =
    (await readRunJson(context.artifactStore, runId, "receipt-after-001.json")) ??
    (await readRunJson(context.artifactStore, runId, "receipt-before-001.json")) ??
    (await readRunJson(context.artifactStore, runId, "receipt-external-001.json"));
  const proofAudit = await readRunJson(context.artifactStore, runId, "proof-audit.json");
  const manifestVerification = await readRunJson(context.artifactStore, runId, "proof-manifest-verification.json");
  const beforeViolations = await readRunJson(context.artifactStore, runId, "violations-before.json");
  const afterViolations = await readRunJson(context.artifactStore, runId, "violations-after.json");
  const externalViolations = await readRunJson(context.artifactStore, runId, "violations-external.json");
  const violations = [
    ...(Array.isArray(beforeViolations) ? beforeViolations : []),
    ...(Array.isArray(afterViolations) ? afterViolations : []),
    ...(Array.isArray(externalViolations) ? externalViolations : [])
  ];
  const missionsInput = await readRunJson(context.artifactStore, runId, "missions.json");
  const missionIds = Array.isArray(missionsInput)
    ? missionsInput.map((mission) => stringField(mission, "id")).filter((missionId): missionId is string => Boolean(missionId))
    : [];
  const ruleIds = violations
    .map((violation) => stringField(violation, "ruleId"))
    .filter((ruleId): ruleId is string => Boolean(ruleId));
  const proofAuditStatus = stringField(proofAudit, "status");
  const manifestStatus = stringField(manifestVerification, "status") ?? (files.includes("proof-manifest.json") ? "UNVERIFIED" : "MISSING");

  return {
    runId,
    artifactBase: `/api/artifacts/${runId}`,
    fileCount: files.length || fileCount,
    files,
    workflow: job?.workflow ?? inferWorkflow(files),
    state: job?.state ?? (proofAuditStatus === "FAIL" ? "failed" : "succeeded"),
    verdict: stringField(receipt, "verdict") ?? "NO RECEIPT",
    score: numberField(receipt, "score") ?? null,
    violations: arrayField(receipt, "violations").length,
    evidenceRefs: arrayField(receipt, "evidenceRefs").length,
    proofAuditStatus: proofAuditStatus ?? "not loaded",
    manifestStatus,
    missionIds,
    ruleIds: [...new Set(ruleIds)].sort(),
    createdAt: job?.createdAt ?? createdAtFromRunId(runId)
  };
};

const listArtifactRuns = async (context: WorkbenchRouteContext) => {
  const runs = await context.artifactStore.listRuns();
  const activeRunIds = new Set(context.jobRunner.listJobs().map((job) => job.runId));
  const summaries = await Promise.all(runs.map((run) => summarizeRun(context, run.runId, run.files)));

  return summaries.filter((run) => run.fileCount > 0 || activeRunIds.has(run.runId));
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
  "external-trace-certification",
  "mcp-transcript-certification",
  "certification-index",
  "public-proof-export",
  "policy-backed-rerun",
  "firewall-check",
  "live-smoke",
  "live-candidates",
  "live-security-kit",
  "live-security-readiness",
  "live-security-proof",
  "hosted-model-diagnostic",
  "hosted-model-proof"
]);

const parseWorkflow = (value: string): WorkbenchWorkflow | undefined =>
  workflows.has(value as WorkbenchWorkflow) ? (value as WorkbenchWorkflow) : undefined;

const parseJsonBody = (body: string): unknown => {
  if (!body.trim()) {
    return {};
  }

  return JSON.parse(body) as unknown;
};

const parseCertificationIndexPayload = (input: unknown): CertificationIndexPayload["value"] => {
  if (!isRecord(input) || !Array.isArray(input.runIds)) {
    throw new Error("Certification index requires runIds as a string array.");
  }

  const runIds = input.runIds.map((runId) => (typeof runId === "string" ? runId.trim() : ""));

  if (runIds.length < 2) {
    throw new Error("Certification index requires at least two selected managed runs.");
  }

  if (runIds.some((runId) => !/^run-[A-Za-z0-9._-]+$/.test(runId))) {
    throw new Error("Certification index accepts managed artifact run IDs only.");
  }

  const uniqueRunIds = [...new Set(runIds)];

  if (uniqueRunIds.length < 2) {
    throw new Error("Certification index requires at least two distinct managed runs.");
  }

  return { runIds: uniqueRunIds };
};

const parseManagedRunId = (value: unknown, label: string): string => {
  const runId = typeof value === "string" ? value.trim() : "";

  if (!/^run-[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error(`${label} accepts managed artifact run IDs only.`);
  }

  return runId;
};

const parsePublicProofExportPayload = (input: unknown): PublicProofExportPayload["value"] => {
  if (!isRecord(input)) {
    throw new Error("Public proof export requires sourceRunId.");
  }

  return { sourceRunId: parseManagedRunId(input.sourceRunId ?? input.runId, "Public proof export") };
};

const payloadForWorkflow = (workflow: WorkbenchWorkflow, body: string): WorkbenchWorkflowPayload | undefined => {
  if (workflow === "external-trace-certification") {
    return { kind: "external-trace", value: parseExternalTraceCertificationPayload(parseJsonBody(body)) };
  }

  if (workflow === "mcp-transcript-certification") {
    return { kind: "mcp-transcript", value: parseMcpTranscriptCertificationPayload(parseJsonBody(body)) };
  }

  if (workflow === "certification-index") {
    return { kind: "certification-index", value: parseCertificationIndexPayload(parseJsonBody(body)) };
  }

  if (workflow === "public-proof-export") {
    return { kind: "public-proof-export", value: parsePublicProofExportPayload(parseJsonBody(body)) };
  }

  return undefined;
};

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

        const body = await readRequestBody(request, context.config.maxRequestBytes);
        const payload = payloadForWorkflow(workflow, body);

        json(response, 202, { job: await context.jobRunner.createJob(workflow, payload) });
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
        json(response, 200, { runs: await listArtifactRuns(context) });
        return true;
      }

      if (request.method === "POST" && url.pathname.startsWith("/api/artifacts/") && url.pathname.endsWith("/verify-manifest")) {
        const parts = url.pathname.split("/").filter(Boolean);
        const runId = parts[2] ?? "";
        const result = await runManifestVerificationWorkflow({ outDir: context.artifactStore.resolveRun(runId) });

        json(response, 200, {
          status: result.status,
          artifact: "proof-manifest-verification.json",
          report: result.report,
          run: await summarizeRun(context, runId, 0)
        });
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
