import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createWorkbenchConfig, type WorkbenchConfig } from "../../src/workbench/config.js";
import { startWorkbenchServer, type StartedWorkbenchServer, type WorkbenchServerOptions } from "../../src/workbench/server.js";
import type { WorkbenchJobSnapshot } from "../../src/workbench/events.js";

interface StartedTestWorkbench {
  config: WorkbenchConfig;
  server: StartedWorkbenchServer;
}

const tempRoot = async (): Promise<string> => mkdtemp(join(tmpdir(), "splunkready-workbench-server-test-"));

const startTestWorkbench = async (
  overrides: Partial<WorkbenchConfig> = {},
  options: WorkbenchServerOptions = {}
): Promise<StartedTestWorkbench> => {
  const config: WorkbenchConfig = {
    ...createWorkbenchConfig({}, process.cwd()),
    artifactRoot: await tempRoot(),
    host: "127.0.0.1",
    port: 0,
    maxConcurrentJobs: 1,
    maxRequestBytes: 200_000,
    ...overrides
  };

  return { config, server: await startWorkbenchServer(config, options) };
};

const fetchText = async (baseUrl: string, path: string, init?: RequestInit) => {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();

  return { response, text };
};

const fetchJson = async <T>(baseUrl: string, path: string, init?: RequestInit): Promise<{ response: Response; json: T; text: string }> => {
  const result = await fetchText(baseUrl, path, init);

  return { ...result, json: JSON.parse(result.text) as T };
};

const expectWorkbenchSecurityHeaders = (response: Response): void => {
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
  expect(response.headers.get("x-frame-options")).toBe("DENY");
};

const terminalStates = new Set(["succeeded", "failed", "cancelled"]);

const waitForHttpJob = async (baseUrl: string, jobId: string): Promise<WorkbenchJobSnapshot> => {
  const started = Date.now();
  let lastJob: WorkbenchJobSnapshot | undefined;

  while (Date.now() - started < 10_000) {
    const { json } = await fetchJson<{ job: WorkbenchJobSnapshot }>(baseUrl, `/api/jobs/${encodeURIComponent(jobId)}`);

    lastJob = json.job;
    if (terminalStates.has(json.job.state)) {
      return json.job;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(`Timed out waiting for ${jobId}; last state was ${lastJob?.state ?? "unknown"}.`);
};

describe("workbench HTTP server", () => {
  it("starts on a random local port and serves health without leaking live secrets", async () => {
    const liveToken = "server-test-super-secret-token";
    const liveUrl = "https://splunk.example.test/mcp";
    const config = {
      ...createWorkbenchConfig(
        {
          SPLUNKREADY_LIVE_ENABLED: "true",
          SPLUNKREADY_SPLUNK_MCP_URL: liveUrl,
          SPLUNKREADY_SPLUNK_MCP_TOKEN: liveToken
        },
        process.cwd()
      ),
      artifactRoot: await tempRoot(),
      port: 0
    };
    const server = await startWorkbenchServer(config);

    try {
      expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      expect(server.url).not.toContain(":0");

      const { response, text, json } = await fetchJson<{
        source: string;
        artifactRoot?: string;
        capabilities: { fixtureCertification: boolean; live: boolean };
        live: { available: boolean; missing: string[] };
      }>(server.url, "/api/health");

      expect(response.status).toBe(200);
      expectWorkbenchSecurityHeaders(response);
      expect(json).toMatchObject({
        source: "splunkready-workbench",
        capabilities: { fixtureCertification: true, live: true },
        live: { available: true, missing: [] }
      });
      expect(json.artifactRoot).toBeUndefined();
      expect(text).not.toContain(config.artifactRoot);
      expect(text).not.toContain(process.cwd());
      expect(text).not.toContain(liveToken);
      expect(text).not.toContain(liveUrl);
    } finally {
      await server.close();
    }
  });

  it("executes fixture certification through real HTTP job, event, artifact, and run-list routes", async () => {
    const { server } = await startTestWorkbench();

    try {
      const created = await fetchJson<{ job: WorkbenchJobSnapshot }>(server.url, "/api/jobs/fixture-certification", { method: "POST" });

      expect(created.response.status).toBe(202);
      expect(created.json.job).toMatchObject({
        workflow: "fixture-certification",
        artifactBase: `/api/artifacts/${created.json.job.runId}`
      });
      expect(["queued", "running"]).toContain(created.json.job.state);

      const completed = await waitForHttpJob(server.url, created.json.job.id);
      const events = await fetchJson<{ events: WorkbenchJobSnapshot["events"] }>(
        server.url,
        `/api/jobs/${encodeURIComponent(created.json.job.id)}/events`
      );
      const receipt = await fetchJson<{ verdict: string; generatedBy: string }>(
        server.url,
        `${completed.artifactBase}/receipt-after-001.json`
      );
      const runs = await fetchJson<{ runs: Array<{ runId: string; workflow: string; verdict: string; manifestStatus: string }> }>(
        server.url,
        "/api/artifacts"
      );

      expect(completed).toMatchObject({
        workflow: "fixture-certification",
        state: "succeeded"
      });
      expect(completed.artifacts).toEqual(expect.arrayContaining(["receipt-before-001.json", "receipt-after-001.json", "proof-manifest.json"]));
      expect(events.response.status).toBe(200);
      expect(events.json.events.map((event) => event.type)).toEqual(expect.arrayContaining(["phase", "artifact", "complete"]));
      expect(receipt.response.status).toBe(200);
      expect(receipt.json).toMatchObject({ verdict: "READY", generatedBy: "Agent Readiness Compiler" });
      expect(runs.response.status).toBe(200);
      expect(runs.json.runs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            runId: completed.runId,
            workflow: "fixture-certification",
            verdict: "READY",
            manifestStatus: "UNVERIFIED"
          })
        ])
      );
    } finally {
      await server.close();
    }
  });

  it("exports a fixture proof through real HTTP without serving the raw source directory", async () => {
    const { server } = await startTestWorkbench();

    try {
      const created = await fetchJson<{ job: WorkbenchJobSnapshot }>(server.url, "/api/jobs/fixture-certification", { method: "POST" });
      const source = await waitForHttpJob(server.url, created.json.job.id);
      const exported = await fetchJson<{ job: WorkbenchJobSnapshot }>(server.url, "/api/jobs/public-proof-export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceRunId: source.runId })
      });
      const completed = await waitForHttpJob(server.url, exported.json.job.id);
      const manifest = await fetchJson<{
        source: string;
        sourceRunId: string;
        redactionStatus: string;
        files: Array<{ path: string; redacted: boolean }>;
      }>(server.url, `${completed.artifactBase}/public-proof-export-manifest.json`);

      expect(exported.response.status).toBe(202);
      expect(completed).toMatchObject({
        workflow: "public-proof-export",
        state: "succeeded",
        artifactBase: `/api/artifacts/${completed.runId}`
      });
      expect(manifest.response.status).toBe(200);
      expect(manifest.json).toMatchObject({
        source: "splunkready-public-proof-export",
        sourceRunId: source.runId,
        redactionStatus: "REDACTED"
      });
      expect(manifest.json.files).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "receipt-after-001.json", redacted: true }),
          expect.objectContaining({ path: "proof-audit.json", redacted: true })
        ])
      );
      expect(manifest.text).not.toContain(server.url);
    } finally {
      await server.close();
    }
  });

  it("rejects HTTP artifact path traversal without serving files outside the managed run", async () => {
    const { server } = await startTestWorkbench();

    try {
      const created = await fetchJson<{ job: WorkbenchJobSnapshot }>(server.url, "/api/jobs/fixture-certification", { method: "POST" });
      const completed = await waitForHttpJob(server.url, created.json.job.id);
      const traversal = await fetchText(server.url, `/api/artifacts/${completed.runId}/nested%2F..%2F..%2Fpackage.json`);

      expect(traversal.response.status).toBe(400);
      expect(traversal.text).toContain("WORKBENCH_REQUEST_FAILED");
      expect(traversal.text).toContain("Artifact file path escapes run root.");
      expect(traversal.text).not.toContain('"scripts"');
    } finally {
      await server.close();
    }
  });

  it("serves the built UI and API from one packaged local origin", async () => {
    const staticUiRoot = await tempRoot();

    await mkdir(join(staticUiRoot, "assets"));
    await writeFile(
      join(staticUiRoot, "index.html"),
      '<!doctype html><div id="app"></div><script type="module" src="/assets/index-test.js"></script>',
      "utf8"
    );
    await writeFile(join(staticUiRoot, "assets", "index-test.js"), "document.body.dataset.splunkready = 'loaded';", "utf8");

    const { server } = await startTestWorkbench({}, { staticUiRoot });

    try {
      const shell = await fetchText(server.url, "/#certification-replay");
      const asset = await fetchText(server.url, "/assets/index-test.js");
      const missingJson = await fetchText(server.url, "/__splunkready_artifacts/receipt-after-001.json");
      const health = await fetchJson<{ source: string; capabilities: { fixtureCertification: boolean; live: boolean } }>(
        server.url,
        "/api/health"
      );
      const created = await fetchJson<{ job: WorkbenchJobSnapshot }>(server.url, "/api/jobs/fixture-certification", { method: "POST" });
      const completed = await waitForHttpJob(server.url, created.json.job.id);

      expect(shell.response.status).toBe(200);
      expectWorkbenchSecurityHeaders(shell.response);
      expect(shell.response.headers.get("content-type")).toContain("text/html");
      expect(shell.text).toContain('<div id="app"></div>');
      expect(asset.response.status).toBe(200);
      expectWorkbenchSecurityHeaders(asset.response);
      expect(asset.response.headers.get("content-type")).toContain("text/javascript");
      expect(asset.text).toContain("splunkready");
      expect(missingJson.response.status).toBe(204);
      expectWorkbenchSecurityHeaders(missingJson.response);
      expect(missingJson.text).toBe("");
      expect(health.json).toMatchObject({
        source: "splunkready-workbench",
        capabilities: { fixtureCertification: true, live: false }
      });
      expect(completed).toMatchObject({
        workflow: "fixture-certification",
        state: "succeeded",
        artifactBase: `/api/artifacts/${completed.runId}`
      });
    } finally {
      await server.close();
    }
  });

  it("serves the executable Vite UI shell while the same browser-facing server runs fixture certification", async () => {
    const { server } = await startTestWorkbench({}, { devUi: true });

    try {
      const shell = await fetchText(server.url, "/#certification-replay");

      expect(shell.response.status).toBe(200);
      expectWorkbenchSecurityHeaders(shell.response);
      expect(shell.response.headers.get("content-type")).toContain("text/html");
      expect(shell.text).toContain('<div id="app"></div>');
      expect(shell.text).toContain('/src/main.ts');

      const created = await fetchJson<{ job: WorkbenchJobSnapshot }>(server.url, "/api/jobs/fixture-certification", { method: "POST" });
      const completed = await waitForHttpJob(server.url, created.json.job.id);

      expect(completed).toMatchObject({
        workflow: "fixture-certification",
        state: "succeeded",
        artifactBase: `/api/artifacts/${completed.runId}`
      });
    } finally {
      await server.close();
    }
  }, 15_000);

  it("redacts dev UI middleware errors before returning them to the browser", async () => {
    const secret = "dev-ui-secret-token";
    const { server } = await startTestWorkbench(
      {},
      {
        devUiServer: {
          middlewares(_request, _response, next) {
            next(new Error(`Bearer ${secret} failed`));
          },
          async close() {}
        }
      }
    );

    try {
      const result = await fetchText(server.url, "/");

      expect(result.response.status).toBe(500);
      expectWorkbenchSecurityHeaders(result.response);
      expect(result.text).toBe("Bearer [REDACTED] failed");
      expect(result.text).not.toContain(secret);
    } finally {
      await server.close();
    }
  });

  it("redacts top-level server fallback errors before returning them to the browser", async () => {
    const secret = "fallback-secret-token";
    const { server } = await startTestWorkbench(
      {},
      {
        devUiServer: {
          middlewares() {
            throw new Error(`TOKEN=${secret} failed`);
          },
          async close() {}
        }
      }
    );

    try {
      const result = await fetchText(server.url, "/");

      expect(result.response.status).toBe(500);
      expectWorkbenchSecurityHeaders(result.response);
      expect(result.text).toBe("TOKEN=[REDACTED] failed");
      expect(result.text).not.toContain(secret);
    } finally {
      await server.close();
    }
  });
});
