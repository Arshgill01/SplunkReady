import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

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
  for (let index = 0; index < 200; index += 1) {
    const job = runner.getJob(id);

    if (job && (job.state === "succeeded" || job.state === "failed")) {
      return job;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(`Timed out waiting for ${id}.`);
};

const emptyProofManifest = (proofDir: string) => ({
  source: "splunkready-proof-manifest",
  generatedAt: "2026-06-01T06:30:00.000Z",
  proofDir,
  aggregateSha256: createHash("sha256").update("").digest("hex"),
  files: []
});

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

  it("certifies an uploaded external trace under the managed artifact root", async () => {
    const config = await testConfig({ maxRequestBytes: 200_000 });
    const store = new WorkbenchArtifactStore(config.artifactRoot);
    const runner = new WorkbenchJobRunner({ config, artifactStore: store });
    const trace = JSON.parse(await readFile("examples/sample-external-trace-pass.json", "utf8")) as unknown;
    const response = await callApi(config, runner, store, {
      method: "POST",
      path: "/api/jobs/external-trace-certification",
      body: JSON.stringify({ trace, agentName: "Uploaded Trace Agent", agentVersion: "sample-pass" })
    });
    const started = response.json as { job: { id: string; workflow: string; inputSummary: string } };
    const completed = await waitForJob(runner, started.job.id);
    const receipt = JSON.parse(
      await readFile(join(config.artifactRoot, completed.runId, "receipt-external-001.json"), "utf8")
    ) as { verdict: string; agent: { name: string } };

    expect(response.status).toBe(202);
    expect(started.job.workflow).toBe("external-trace-certification");
    expect(started.job.inputSummary).toContain("trace event");
    expect(completed.state).toBe("succeeded");
    expect(completed.artifacts).toEqual(
      expect.arrayContaining([
        "uploaded-external-trace.json",
        "environment-contract.json",
        "receipt-external-001.json",
        "proof-audit.json",
        "proof-manifest.json"
      ])
    );
    expect(receipt).toMatchObject({ verdict: "READY", agent: { name: "Uploaded Trace Agent" } });
  });

  it("rejects malformed external trace uploads before allocating a job", async () => {
    const config = await testConfig({ maxRequestBytes: 2_000 });
    const store = new WorkbenchArtifactStore(config.artifactRoot);
    const runner = new WorkbenchJobRunner({ config, artifactStore: store });
    const response = await callApi(config, runner, store, {
      method: "POST",
      path: "/api/jobs/external-trace-certification",
      body: JSON.stringify({ trace: [{ id: "not-a-trace-event" }] })
    });

    expect(response.status).toBe(400);
    expect(response.json).toMatchObject({
      error: {
        code: "WORKBENCH_REQUEST_FAILED",
        message: expect.stringContaining("Invalid external trace upload")
      }
    });
    expect(runner.listJobs()).toHaveLength(0);
  });

  it("certifies an uploaded MCP transcript with a server-appended final answer", async () => {
    const config = await testConfig({ maxRequestBytes: 200_000 });
    const store = new WorkbenchArtifactStore(config.artifactRoot);
    const runner = new WorkbenchJobRunner({ config, artifactStore: store });
    const transcript = await readFile("examples/sample-mcp-transcript-pass.jsonl", "utf8");
    const response = await callApi(config, runner, store, {
      method: "POST",
      path: "/api/jobs/mcp-transcript-certification",
      body: JSON.stringify({
        transcript,
        finalAnswer:
          "Evidence supports suspicious lateral movement. Provenance saved-search-lateral-movement returned 3 rows with evidence evt-102, evt-118, and evt-141.",
        strictImport: true,
        agentName: "Uploaded Transcript Agent",
        agentVersion: "jsonrpc-pass"
      })
    });
    const started = response.json as { job: { id: string; inputSummary: string } };
    const completed = await waitForJob(runner, started.job.id);
    const imported = JSON.parse(
      await readFile(join(config.artifactRoot, completed.runId, "mcp-transcript-import.json"), "utf8")
    ) as { finalAnswers: number; strictImport: boolean };
    const receipt = JSON.parse(
      await readFile(join(config.artifactRoot, completed.runId, "receipt-external-001.json"), "utf8")
    ) as { verdict: string; evidenceRefs: string[] };

    expect(response.status).toBe(202);
    expect(started.job.inputSummary).toContain("strictImport=true");
    expect(completed.state).toBe("succeeded");
    expect(completed.artifacts).toEqual(
      expect.arrayContaining([
        "uploaded-mcp-transcript.jsonl",
        "trace-imported.json",
        "mcp-transcript-import.json",
        "receipt-external-001.json",
        "proof-audit.json",
        "proof-manifest.json"
      ])
    );
    expect(imported).toMatchObject({ strictImport: true, finalAnswers: 2 });
    expect(receipt.verdict).toBe("READY");
    expect(receipt.evidenceRefs).toEqual(expect.arrayContaining(["evt-102", "evt-118", "evt-141"]));
  });

  it("runs policy-backed rerun and firewall-check as server-owned fixture workflows", async () => {
    const config = await testConfig({ maxRequestBytes: 200_000 });
    const store = new WorkbenchArtifactStore(config.artifactRoot);
    const runner = new WorkbenchJobRunner({ config, artifactStore: store });
    const rerunResponse = await callApi(config, runner, store, { method: "POST", path: "/api/jobs/policy-backed-rerun" });
    const rerunStarted = rerunResponse.json as { job: { id: string; workflow: string } };
    const rerunCompleted = await waitForJob(runner, rerunStarted.job.id);
    const afterReceipt = JSON.parse(
      await readFile(join(config.artifactRoot, rerunCompleted.runId, "receipt-after-001.json"), "utf8")
    ) as { verdict: string; score: number; rerunComparison: { beforeVerdict?: string; afterVerdict?: string } };
    const firewallResponse = await callApi(config, runner, store, { method: "POST", path: "/api/jobs/firewall-check" });
    const firewallStarted = firewallResponse.json as { job: { id: string; workflow: string } };
    const firewallCompleted = await waitForJob(runner, firewallStarted.job.id);
    const block = JSON.parse(
      await readFile(join(config.artifactRoot, firewallCompleted.runId, "firewall-block-before.json"), "utf8")
    ) as { code: string; blockedBeforeSplunk: boolean; mutation: boolean };

    expect(rerunResponse.status).toBe(202);
    expect(rerunStarted.job.workflow).toBe("policy-backed-rerun");
    expect(rerunCompleted).toMatchObject({ workflow: "policy-backed-rerun", state: "succeeded" });
    expect(rerunCompleted.artifacts).toEqual(
      expect.arrayContaining(["receipt-before-001.json", "policy-patch.json", "receipt-after-001.json", "proof-audit.json"])
    );
    expect(afterReceipt).toMatchObject({
      verdict: "READY",
      score: 100,
      rerunComparison: { beforeVerdict: "NOT READY", afterVerdict: "READY" }
    });
    expect(firewallResponse.status).toBe(202);
    expect(firewallStarted.job.workflow).toBe("firewall-check");
    expect(firewallCompleted).toMatchObject({ workflow: "firewall-check", state: "succeeded" });
    expect(firewallCompleted.artifacts).toEqual(
      expect.arrayContaining(["firewall-block-before.json", "proof-audit.json", "proof-manifest.json"])
    );
    expect(block).toMatchObject({
      code: "FIREWALL_POLICY_BLOCKED",
      blockedBeforeSplunk: true,
      mutation: false
    });
  });

  it("lists artifact runs with receipt, audit, manifest, mission, and rule summaries", async () => {
    const config = await testConfig({ maxRequestBytes: 200_000 });
    const store = new WorkbenchArtifactStore(config.artifactRoot);
    const runner = new WorkbenchJobRunner({ config, artifactStore: store });
    const trace = JSON.parse(await readFile("examples/sample-external-trace.json", "utf8")) as unknown;
    const response = await callApi(config, runner, store, {
      method: "POST",
      path: "/api/jobs/external-trace-certification",
      body: JSON.stringify({ trace, agentName: "Uploaded Trace Agent", agentVersion: "sample-fail" })
    });
    const started = response.json as { job: { id: string } };
    const completed = await waitForJob(runner, started.job.id);
    const list = await callApi(config, runner, store, { method: "GET", path: "/api/artifacts" });

    expect(response.status).toBe(202);
    expect(completed.state).toBe("succeeded");
    expect(list.status).toBe(200);
    expect(list.json).toMatchObject({
      runs: [
        {
          runId: completed.runId,
          artifactBase: `/api/artifacts/${completed.runId}`,
          workflow: "external-trace-certification",
          state: "succeeded",
          verdict: "NOT READY",
          score: 0,
          proofAuditStatus: "FAIL",
          manifestStatus: "UNVERIFIED",
          missionIds: ["mission-security-lateral-movement-readiness"],
          ruleIds: expect.arrayContaining(["SPL-001"])
        }
      ]
    });
  });

  it("verifies managed proof manifests through the artifact API without hiding FAIL reports", async () => {
    const config = await testConfig();
    const store = new WorkbenchArtifactStore(config.artifactRoot);
    const runner = new WorkbenchJobRunner({ config, artifactStore: store });
    const passingRun = await store.createRunDirectory();
    const failingRun = await store.createRunDirectory();

    await writeFile(join(passingRun.path, "proof-manifest.json"), `${JSON.stringify(emptyProofManifest(passingRun.path), null, 2)}\n`, "utf8");
    await writeFile(join(failingRun.path, "proof-manifest.json"), `${JSON.stringify(emptyProofManifest(failingRun.path), null, 2)}\n`, "utf8");
    await writeFile(join(failingRun.path, "receipt.json"), "{}\n", "utf8");

    const pass = await callApi(config, runner, store, {
      method: "POST",
      path: `/api/artifacts/${passingRun.runId}/verify-manifest`
    });
    const fail = await callApi(config, runner, store, {
      method: "POST",
      path: `/api/artifacts/${failingRun.runId}/verify-manifest`
    });
    const failReport = JSON.parse(await readFile(join(failingRun.path, "proof-manifest-verification.json"), "utf8")) as {
      status: string;
      unexpectedFiles: string[];
    };

    expect(pass.status).toBe(200);
    expect(pass.json).toMatchObject({
      status: "PASS",
      artifact: "proof-manifest-verification.json",
      report: { status: "PASS", expectedFiles: 0, actualFiles: 0 },
      run: { runId: passingRun.runId, manifestStatus: "PASS" }
    });
    expect(fail.status).toBe(200);
    expect(fail.json).toMatchObject({
      status: "FAIL",
      report: { status: "FAIL", unexpectedFiles: ["receipt.json"] },
      run: { runId: failingRun.runId, manifestStatus: "FAIL" }
    });
    expect(failReport).toMatchObject({ status: "FAIL", unexpectedFiles: ["receipt.json"] });
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
