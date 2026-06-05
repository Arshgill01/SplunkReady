import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { WorkbenchArtifactStore } from "../../src/workbench/artifacts.js";
import { createWorkbenchConfig, healthFromConfig, type WorkbenchConfig } from "../../src/workbench/config.js";
import { WorkbenchJobRunner } from "../../src/workbench/jobs.js";
import { createWorkbenchApiHandler } from "../../src/workbench/routes.js";
import { redactText, redactUnknownError } from "../../src/workbench/redaction.js";

const tempRoot = async (): Promise<string> => mkdtemp(join(tmpdir(), "splunkready-workbench-test-"));

const testConfig = async (overrides: Partial<WorkbenchConfig> = {}): Promise<WorkbenchConfig> => ({
  ...createWorkbenchConfig({}, process.cwd()),
  artifactRoot: await tempRoot(),
  port: 0,
  maxConcurrentJobs: 1,
  maxRequestBytes: 32,
  ...overrides
});

const callApi = async (
  config: WorkbenchConfig,
  runner: WorkbenchJobRunner,
  store: WorkbenchArtifactStore,
  input: { method: string; path: string; body?: string; headers?: Record<string, string> }
): Promise<{ status: number; headers: Record<string, string | number | string[]>; body: string; json: unknown }> => {
  const handler = createWorkbenchApiHandler({ config, artifactStore: store, jobRunner: runner });
  const request = Readable.from([input.body ?? ""]) as IncomingMessage;
  request.method = input.method;
  request.url = input.path;
  request.headers = input.headers ?? {};

  return new Promise((resolve) => {
    const headers: Record<string, string | number | string[]> = {};
    const response = {
      statusCode: 200,
      setHeader(name: string, value: string | number | readonly string[]) {
        headers[name.toLowerCase()] = Array.isArray(value) ? value : (value as string | number | string[]);
      },
      end(chunk?: unknown) {
        const body = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk ?? "");
        resolve({
          status: this.statusCode,
          headers,
          body,
          json: body.trim().length > 0 ? JSON.parse(body) : undefined
        });
      }
    } as ServerResponse;

    void handler(request, response);
  });
};

const waitForJob = async (runner: WorkbenchJobRunner, id: string) => {
  for (let index = 0; index < 80; index += 1) {
    const job = runner.getJob(id);

    if (job && (job.state === "succeeded" || job.state === "failed")) {
      return job;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error(`Timed out waiting for ${id}.`);
};

describe("workbench backend", () => {
  it("reports health without leaking server secrets", async () => {
    const config = createWorkbenchConfig(
      {
        SPLUNKREADY_LIVE_ENABLED: "true",
        SPLUNKREADY_SPLUNK_MCP_URL: "https://splunk.example.test/mcp",
        SPLUNKREADY_SPLUNK_MCP_TOKEN: "super-secret-token"
      },
      process.cwd()
    );
    const health = JSON.stringify(healthFromConfig(config));

    expect(health).toContain("fixtureCertification");
    expect(health).toContain('"live":true');
    expect(health).toContain('"missing":[]');
    expect(health).not.toContain("super-secret-token");
    expect(health).not.toContain("splunk.example.test");
  });

  it("reports missing live server env names without exposing values", () => {
    const health = healthFromConfig(createWorkbenchConfig({}, process.cwd()));

    expect(health).toMatchObject({
      capabilities: { live: false },
      live: {
        available: false,
        missing: ["SPLUNKREADY_LIVE_ENABLED=true", "SPLUNKREADY_SPLUNK_MCP_URL", "SPLUNKREADY_SPLUNK_MCP_TOKEN"]
      }
    });
  });

  it("redacts secret-looking text and environment values", () => {
    const redacted = redactText("Bearer abcdefghijkl TOKEN=secret-value and exact-token", {
      SPLUNKREADY_SPLUNK_MCP_TOKEN: "exact-token"
    });

    expect(redacted).toContain("Bearer [REDACTED]");
    expect(redacted).toContain("TOKEN=[REDACTED]");
    expect(redacted).not.toContain("exact-token");
  });

  it("formats structured adapter errors instead of rendering object placeholders", () => {
    const redacted = redactUnknownError(
      {
        name: "SplunkAdapterError",
        code: "LIVE_ADAPTER_TRANSPORT_ERROR",
        message: "Live Splunk adapter call failed.",
        context: {
          mode: "live",
          toolName: "splunk_get_info",
          requestId: "request-1"
        },
        retryable: true,
        cause: new Error("Bearer exact-token failed")
      },
      { SPLUNKREADY_SPLUNK_MCP_TOKEN: "exact-token" }
    );

    expect(redacted).toBe(
      "LIVE_ADAPTER_TRANSPORT_ERROR while calling splunk_get_info: Live Splunk adapter call failed. Cause: Bearer [REDACTED] failed"
    );
    expect(redacted).not.toContain("[object Object]");
    expect(redacted).not.toContain("exact-token");
  });

  it("blocks artifact path traversal under the managed root", async () => {
    const store = new WorkbenchArtifactStore(await tempRoot());
    const run = await store.createRunDirectory();

    await expect(async () => store.resolveFile(run.runId, "../receipt.json")).rejects.toThrow(
      "Artifact file path escapes run root."
    );
    await expect(async () => store.resolveFile("../outside", "receipt.json")).rejects.toThrow("Invalid artifact run id.");
  });

  it("runs the allowlisted fixture workflow and records structured events", async () => {
    const config = await testConfig();
    const store = new WorkbenchArtifactStore(config.artifactRoot);
    const runner = new WorkbenchJobRunner({
      config,
      artifactStore: store,
      workflows: {
        "fixture-certification": async ({ outDir }) => {
          await writeFile(join(outDir, "receipt-after-001.json"), "{}\n", "utf8");

          return { artifacts: [join(outDir, "receipt-after-001.json")] };
        }
      }
    });
    const job = await runner.createJob("fixture-certification");
    const completed = await waitForJob(runner, job.id);

    expect(completed).toMatchObject({
      workflow: "fixture-certification",
      state: "succeeded",
      artifactBase: `/api/artifacts/${completed.runId}`
    });
    expect(completed.artifacts).toEqual(["receipt-after-001.json"]);
    expect(completed.events.map((event) => event.type)).toEqual(
      expect.arrayContaining(["phase", "artifact", "complete"])
    );
  });

  it("stores redacted failed-job diagnostics without corrupting earlier runs", async () => {
    const config = await testConfig();
    const store = new WorkbenchArtifactStore(config.artifactRoot);
    let calls = 0;
    const runner = new WorkbenchJobRunner({
      config,
      artifactStore: store,
      workflows: {
        "fixture-certification": async ({ outDir }) => {
          calls += 1;

          if (calls === 1) {
            await writeFile(join(outDir, "receipt-after-001.json"), "{}\n", "utf8");
            return { artifacts: [join(outDir, "receipt-after-001.json")] };
          }

          throw new Error("TOKEN=secret-value failed");
        }
      }
    });

    const first = await waitForJob(runner, (await runner.createJob("fixture-certification")).id);
    const second = await waitForJob(runner, (await runner.createJob("fixture-certification")).id);

    expect(first.state).toBe("succeeded");
    expect(second.state).toBe("failed");
    expect(second.error).toBe("TOKEN=[REDACTED] failed");
    expect(first.artifacts).toEqual(["receipt-after-001.json"]);
  });

  it("serves structured API responses and rejects unknown workflows", async () => {
    const config = await testConfig();
    const store = new WorkbenchArtifactStore(config.artifactRoot);
    const runner = new WorkbenchJobRunner({ config, artifactStore: store });
    const health = await callApi(config, runner, store, { method: "GET", path: "/api/health" });
    const unknownWorkflow = await callApi(config, runner, store, { method: "POST", path: "/api/jobs/unknown" });
    const unknownRoute = await callApi(config, runner, store, { method: "GET", path: "/api/nope" });

    expect(health.status).toBe(200);
    expect(health.json).toMatchObject({ source: "splunkready-workbench" });
    expect(unknownWorkflow.status).toBe(404);
    expect(unknownWorkflow.json).toMatchObject({
      error: { code: "WORKBENCH_WORKFLOW_NOT_FOUND" }
    });
    expect(unknownRoute.status).toBe(404);
    expect(unknownRoute.json).toMatchObject({ error: { code: "WORKBENCH_ROUTE_NOT_FOUND" } });
  });

  it("rejects live workflows when server live env is unavailable", async () => {
    const config = await testConfig();
    const store = new WorkbenchArtifactStore(config.artifactRoot);
    const runner = new WorkbenchJobRunner({ config, artifactStore: store });
    const response = await callApi(config, runner, store, { method: "POST", path: "/api/jobs/live-smoke" });
    const hostedResponse = await callApi(config, runner, store, {
      method: "POST",
      path: "/api/jobs/hosted-model-diagnostic"
    });

    expect(response.status).toBe(400);
    expect(response.json).toMatchObject({
      error: {
        code: "WORKBENCH_REQUEST_FAILED",
        message: expect.stringContaining("SPLUNKREADY_SPLUNK_MCP_TOKEN")
      }
    });
    expect(hostedResponse.status).toBe(400);
    expect(hostedResponse.json).toMatchObject({
      error: {
        code: "WORKBENCH_REQUEST_FAILED",
        message: expect.stringContaining("SPLUNKREADY_SPLUNK_MCP_TOKEN")
      }
    });
  });

  it("runs allowlisted live workflows from server-owned configuration", async () => {
    const config = await testConfig({ liveAvailable: true, liveMissing: [] });
    const store = new WorkbenchArtifactStore(config.artifactRoot);
    const runner = new WorkbenchJobRunner({
      config,
      artifactStore: store,
      workflows: {
        "live-smoke": async ({ outDir }) => {
          await writeFile(join(outDir, "live-smoke-summary.json"), "{\"status\":\"PASS\",\"mutation\":false}\n", "utf8");

          return { artifacts: [join(outDir, "live-smoke-summary.json")] };
        }
      }
    });
    const response = await callApi(config, runner, store, { method: "POST", path: "/api/jobs/live-smoke" });
    const started = response.json as { job: { id: string; workflow: string } };
    const completed = await waitForJob(runner, started.job.id);

    expect(response.status).toBe(202);
    expect(started.job.workflow).toBe("live-smoke");
    expect(completed).toMatchObject({
      workflow: "live-smoke",
      state: "succeeded",
      artifacts: ["live-smoke-summary.json"]
    });
    expect(completed.events.map((event) => event.message)).toEqual(
      expect.arrayContaining(["Queued live smoke.", "Running Agent Readiness Compiler live smoke.", "live smoke completed."])
    );
  });

  it("runs hosted-model diagnostic as an allowlisted server-owned live workflow", async () => {
    const config = await testConfig({ liveAvailable: true, liveMissing: [] });
    const store = new WorkbenchArtifactStore(config.artifactRoot);
    const runner = new WorkbenchJobRunner({
      config,
      artifactStore: store,
      workflows: {
        "hosted-model-diagnostic": async ({ outDir }) => {
          await writeFile(
            join(outDir, "hosted-model-diagnostic.json"),
            "{\"status\":\"BLOCKED\",\"mutation\":false,\"deterministicAuthority\":\"deterministic-rule-engine\"}\n",
            "utf8"
          );

          return { artifacts: [join(outDir, "hosted-model-diagnostic.json")] };
        }
      }
    });
    const response = await callApi(config, runner, store, {
      method: "POST",
      path: "/api/jobs/hosted-model-diagnostic"
    });
    const started = response.json as { job: { id: string; workflow: string } };
    const completed = await waitForJob(runner, started.job.id);

    expect(response.status).toBe(202);
    expect(started.job.workflow).toBe("hosted-model-diagnostic");
    expect(completed).toMatchObject({
      workflow: "hosted-model-diagnostic",
      state: "succeeded",
      artifacts: ["hosted-model-diagnostic.json"]
    });
    expect(completed.events.map((event) => event.message)).toEqual(
      expect.arrayContaining([
        "Queued hosted model diagnostic.",
        "Running Agent Readiness Compiler hosted model diagnostic.",
        "hosted model diagnostic completed."
      ])
    );
  });

  it("rejects non-local origins and oversized request bodies", async () => {
    const config = await testConfig({ maxRequestBytes: 4 });
    const store = new WorkbenchArtifactStore(config.artifactRoot);
    const runner = new WorkbenchJobRunner({ config, artifactStore: store });
    const badOrigin = await callApi(config, runner, store, {
      method: "GET",
      path: "/api/health",
      headers: { origin: "https://example.test" }
    });
    const tooLarge = await callApi(config, runner, store, {
      method: "POST",
      path: "/api/jobs/fixture-certification",
      body: "too large"
    });

    expect(badOrigin.status).toBe(403);
    expect(badOrigin.json).toMatchObject({ error: { code: "WORKBENCH_ORIGIN_FORBIDDEN" } });
    expect(tooLarge.status).toBe(400);
    expect(tooLarge.json).toMatchObject({ error: { code: "WORKBENCH_REQUEST_FAILED" } });
  });
});
