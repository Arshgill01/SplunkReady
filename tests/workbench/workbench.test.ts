import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
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

class DelayedCreateArtifactStore extends WorkbenchArtifactStore {
  private releaseCreateRun: (() => void) | undefined;
  readonly createRunStarted: Promise<void>;

  constructor(root: string) {
    super(root);
    let markStarted: (() => void) | undefined;
    this.createRunStarted = new Promise((resolve) => {
      markStarted = resolve;
    });
    this.releaseCreateRun = markStarted;
  }

  async createRunDirectory() {
    this.releaseCreateRun?.();
    this.releaseCreateRun = undefined;
    await new Promise((resolve) => setTimeout(resolve, 50));

    return super.createRunDirectory();
  }
}

class FailOnceCreateArtifactStore extends WorkbenchArtifactStore {
  private failed = false;

  async createRunDirectory() {
    if (!this.failed) {
      this.failed = true;
      throw new Error("temporary allocation failure");
    }

    return super.createRunDirectory();
  }
}

describe("workbench backend", () => {
  it("keeps the workbench backend decoupled from direct CLI imports", async () => {
    const sources = await Promise.all([
      readFile("src/workbench/jobs.ts", "utf8"),
      readFile("src/workbench/routes.ts", "utf8")
    ]);

    for (const source of sources) {
      expect(source).not.toContain("../cli.js");
    }
  });

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
    expect(health).not.toContain(config.artifactRoot);
    expect(health).not.toContain(process.cwd());
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

  it("redacts route-level API failures before returning JSON", async () => {
    const secret = "route-level-secret-token";
    const config = await testConfig();
    const runner = new WorkbenchJobRunner({ config, artifactStore: new WorkbenchArtifactStore(config.artifactRoot) });
    const store = {
      async listRuns() {
        throw new Error(`Bearer ${secret} failed`);
      }
    } as unknown as WorkbenchArtifactStore;

    const response = await callApi(config, runner, store, { method: "GET", path: "/api/artifacts" });

    expect(response.status).toBe(400);
    expect(response.json).toMatchObject({
      error: {
        code: "WORKBENCH_REQUEST_FAILED",
        message: "Bearer [REDACTED] failed"
      }
    });
    expect(response.body).not.toContain(secret);
  });

  it("blocks artifact path traversal under the managed root", async () => {
    const store = new WorkbenchArtifactStore(await tempRoot());
    const run = await store.createRunDirectory();

    await expect(async () => store.resolveFile(run.runId, "../receipt.json")).rejects.toThrow(
      "Artifact file path escapes run root."
    );
    await expect(async () => store.resolveFile("../outside", "receipt.json")).rejects.toThrow("Invalid artifact run id.");
  });

  it("does not follow symlinks when reading managed artifacts", async () => {
    const root = await tempRoot();
    const store = new WorkbenchArtifactStore(root);
    const run = await store.createRunDirectory();
    const outside = join(root, "outside-secret.txt");

    await writeFile(outside, "secret outside run\n", "utf8");
    await symlink(outside, store.resolveFile(run.runId, "linked-secret.txt"));

    await expect(store.readFile(run.runId, "linked-secret.txt")).resolves.toBeUndefined();
    await expect(store.listRunFiles(run.runId)).resolves.not.toContain("linked-secret.txt");
  });

  it("serves preset artifact bundle files without allowing traversal", async () => {
    const root = await tempRoot();
    const store = new WorkbenchArtifactStore(join(root, "workbench-runs"));

    await mkdir(join(root, "mcp-proof"), { recursive: true });
    await writeFile(join(root, "mcp-proof", "mcp-proof-summary.json"), '{"status":"PASS"}\n', "utf8");

    await expect(store.readBundleFile("mcp-proof", "mcp-proof-summary.json")).resolves.toEqual(
      Buffer.from('{"status":"PASS"}\n')
    );
    await expect(async () => store.readBundleFile("../outside", "mcp-proof-summary.json")).rejects.toThrow(
      "Invalid artifact bundle id."
    );
    await expect(async () => store.readBundleFile("mcp-proof", "../package.json")).rejects.toThrow(
      "Artifact bundle file path escapes artifact root."
    );
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

  it("returns isolated job snapshots from public read APIs", async () => {
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

    const completed = await waitForJob(runner, (await runner.createJob("fixture-certification")).id);
    const listed = runner.listJobs()[0];
    const fetched = runner.getJob(completed.id);

    expect(listed).toBeDefined();
    expect(fetched).toBeDefined();

    listed!.state = "failed";
    listed!.artifacts.push("corrupted.json");
    listed!.events[0]!.message = "corrupted";
    fetched!.state = "cancelled";
    fetched!.events.push({ id: 999, type: "error", message: "corrupted", at: new Date().toISOString() });

    const reloaded = runner.getJob(completed.id);

    expect(reloaded).toMatchObject({
      state: "succeeded",
      artifacts: ["receipt-after-001.json"]
    });
    expect(reloaded?.events.map((event) => event.message)).toEqual(
      expect.arrayContaining(["Queued fixture certification.", "fixture certification completed."])
    );
    expect(reloaded?.events.map((event) => event.message)).not.toContain("corrupted");
  });

  it("reserves a concurrency slot while allocating a run directory", async () => {
    const config = await testConfig();
    const store = new DelayedCreateArtifactStore(config.artifactRoot);
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

    const first = runner.createJob("fixture-certification");
    await store.createRunStarted;
    await expect(runner.createJob("fixture-certification")).rejects.toThrow("Workbench job limit reached.");
    const completed = await waitForJob(runner, (await first).id);

    expect(completed.state).toBe("succeeded");
    expect(runner.listJobs()).toHaveLength(1);
  });

  it("releases the pending job slot after run allocation fails", async () => {
    const config = await testConfig();
    const store = new FailOnceCreateArtifactStore(config.artifactRoot);
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

    await expect(runner.createJob("fixture-certification")).rejects.toThrow("temporary allocation failure");
    const completed = await waitForJob(runner, (await runner.createJob("fixture-certification")).id);

    expect(completed.state).toBe("succeeded");
    expect(runner.listJobs()).toHaveLength(1);
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

  it("generates the operator-owned live security kit without live credentials", async () => {
    const config = await testConfig({
      liveAvailable: false,
      liveMissing: ["SPLUNKREADY_LIVE_ENABLED", "SPLUNKREADY_SPLUNK_MCP_URL", "SPLUNKREADY_SPLUNK_MCP_TOKEN"]
    });
    const store = new WorkbenchArtifactStore(config.artifactRoot);
    const runner = new WorkbenchJobRunner({ config, artifactStore: store });
    const response = await callApi(config, runner, store, { method: "POST", path: "/api/jobs/live-security-kit" });
    const started = response.json as { job: { id: string; workflow: string } };
    const completed = await waitForJob(runner, started.job.id);
    const manifest = JSON.parse(
      await readFile(join(config.artifactRoot, completed.runId, "live-security-kit.json"), "utf8")
    ) as {
      mutation: boolean;
      operatorActionRequired: boolean;
      validation: { status: string };
      operatorWarnings: string[];
      cleanupGuidance: string[];
    };
    const list = await callApi(config, runner, store, { method: "GET", path: "/api/artifacts" });

    expect(response.status).toBe(202);
    expect(started.job.workflow).toBe("live-security-kit");
    expect(completed).toMatchObject({ workflow: "live-security-kit", state: "succeeded" });
    expect(completed.artifacts).toEqual(
      expect.arrayContaining([
        "live-security-kit.json",
        "SplunkEnterpriseSecuritySuite/default/savedsearches.conf",
        "SplunkEnterpriseSecuritySuite/default/indexes.conf",
        "lateral-movement-events.csv",
        "README.md"
      ])
    );
    expect(manifest).toMatchObject({
      mutation: false,
      operatorActionRequired: true,
      validation: { status: "PASS" }
    });
    expect(manifest.operatorWarnings.join(" ")).toContain("no Splunk write operation");
    expect(manifest.cleanupGuidance.join(" ")).toContain("Cleanup is operator-owned");
    expect(list.json).toMatchObject({
      runs: [
        expect.objectContaining({
          runId: completed.runId,
          workflow: "live-security-kit",
          state: "succeeded",
          verdict: "NO RECEIPT",
          proofAuditStatus: "not loaded",
          manifestStatus: "MISSING"
        })
      ]
    });
  });

  it("lists artifact runs with receipt, audit, manifest, mission, and rule summaries", async () => {
    const config = await testConfig({ maxRequestBytes: 200_000 });
    const store = new WorkbenchArtifactStore(config.artifactRoot);
    const runner = new WorkbenchJobRunner({ config, artifactStore: store });
    const staleEmptyRun = await store.createRunDirectory();
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
    expect((list.json as { runs: Array<{ runId: string }> }).runs.map((run) => run.runId)).not.toContain(staleEmptyRun.runId);
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
    expect((list.json as { runs: Array<{ createdAt: string }> }).runs[0]?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
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

  it("generates a certification index from selected managed proof runs", async () => {
    const config = await testConfig({ maxRequestBytes: 200_000 });
    const store = new WorkbenchArtifactStore(config.artifactRoot);
    const runner = new WorkbenchJobRunner({ config, artifactStore: store });
    const passTrace = JSON.parse(await readFile("examples/sample-external-trace-pass.json", "utf8")) as unknown;
    const failTrace = JSON.parse(await readFile("examples/sample-external-trace.json", "utf8")) as unknown;
    const passResponse = await callApi(config, runner, store, {
      method: "POST",
      path: "/api/jobs/external-trace-certification",
      body: JSON.stringify({ trace: passTrace, agentName: "Passing Agent", agentVersion: "pass" })
    });
    const passRun = await waitForJob(runner, (passResponse.json as { job: { id: string } }).job.id);
    const failResponse = await callApi(config, runner, store, {
      method: "POST",
      path: "/api/jobs/external-trace-certification",
      body: JSON.stringify({ trace: failTrace, agentName: "Failing Agent", agentVersion: "fail" })
    });
    const failRun = await waitForJob(runner, (failResponse.json as { job: { id: string } }).job.id);
    const indexResponse = await callApi(config, runner, store, {
      method: "POST",
      path: "/api/jobs/certification-index",
      body: JSON.stringify({ runIds: [passRun.runId, failRun.runId] })
    });
    const started = indexResponse.json as { job: { id: string; inputSummary: string } };
    const completed = await waitForJob(runner, started.job.id);
    const index = JSON.parse(
      await readFile(join(config.artifactRoot, completed.runId, "certification-index.json"), "utf8")
    ) as {
      status: string;
      mutation: boolean;
      proofDirs: string[];
      totals: { proofs: number; pass: number; fail: number };
      entries: Array<{
        proofDir: string;
        domains: string[];
        missions: string[];
        href: string;
        status: string;
        manifestStatus: string;
      }>;
    };
    const manifest = JSON.parse(await readFile(join(config.artifactRoot, completed.runId, "ui-artifacts.json"), "utf8")) as {
      defaultArtifact: string;
      artifacts: Array<{ label: string; path: string }>;
    };
    const list = await callApi(config, runner, store, { method: "GET", path: "/api/artifacts" });

    expect(indexResponse.status).toBe(202);
    expect(started.job.inputSummary).toBe("2 managed proof run(s)");
    expect(completed).toMatchObject({
      workflow: "certification-index",
      state: "succeeded",
      artifacts: ["certification-index.json", "ui-artifacts.json"]
    });
    expect(index).toMatchObject({
      status: "FAIL",
      mutation: false,
      proofDirs: [`/api/artifacts/${passRun.runId}`, `/api/artifacts/${failRun.runId}`],
      totals: { proofs: 2, pass: 1, fail: 1 }
    });
    expect(index.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          proofDir: `/api/artifacts/${passRun.runId}`,
          domains: ["security"],
          missions: ["mission-security-lateral-movement-readiness"],
          href: `?artifacts=${encodeURIComponent(`/api/artifacts/${passRun.runId}`)}#receipt`,
          status: "PASS",
          manifestStatus: "PASS"
        }),
        expect.objectContaining({
          proofDir: `/api/artifacts/${failRun.runId}`,
          status: "FAIL",
          manifestStatus: "PASS"
        })
      ])
    );
    expect(manifest).toMatchObject({
      defaultArtifact: `/api/artifacts/${completed.runId}`,
      artifacts: expect.arrayContaining([
        { label: "Certification index", path: `/api/artifacts/${completed.runId}` },
        expect.objectContaining({ path: `/api/artifacts/${passRun.runId}` }),
        expect.objectContaining({ path: `/api/artifacts/${failRun.runId}` })
      ])
    });
    expect((list.json as { runs: unknown[] }).runs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          runId: completed.runId,
          workflow: "certification-index",
          state: "succeeded",
          verdict: "NO RECEIPT",
          manifestStatus: "MISSING"
        })
      ])
    );
  });

  it("rejects unmanaged certification index paths before allocating a job", async () => {
    const config = await testConfig({ maxRequestBytes: 1_000 });
    const store = new WorkbenchArtifactStore(config.artifactRoot);
    const runner = new WorkbenchJobRunner({ config, artifactStore: store });
    const response = await callApi(config, runner, store, {
      method: "POST",
      path: "/api/jobs/certification-index",
      body: JSON.stringify({ runIds: ["run-valid", "../artifacts/live-security-ui"] })
    });

    expect(response.status).toBe(400);
    expect(response.json).toMatchObject({
      error: {
        code: "WORKBENCH_REQUEST_FAILED",
        message: "Certification index accepts managed artifact run IDs only."
      }
    });
    expect(runner.listJobs()).toHaveLength(0);
  });

  it("fails certification index jobs when a selected proof manifest is stale", async () => {
    const config = await testConfig({ maxRequestBytes: 1_000 });
    const store = new WorkbenchArtifactStore(config.artifactRoot);
    const runner = new WorkbenchJobRunner({ config, artifactStore: store });
    const cleanRun = await store.createRunDirectory();
    const staleRun = await store.createRunDirectory();

    await writeFile(join(cleanRun.path, "proof-manifest.json"), `${JSON.stringify(emptyProofManifest(cleanRun.path), null, 2)}\n`, "utf8");
    await writeFile(join(staleRun.path, "proof-manifest.json"), `${JSON.stringify(emptyProofManifest(staleRun.path), null, 2)}\n`, "utf8");
    await writeFile(join(staleRun.path, "receipt.json"), "{}\n", "utf8");

    const response = await callApi(config, runner, store, {
      method: "POST",
      path: "/api/jobs/certification-index",
      body: JSON.stringify({ runIds: [cleanRun.runId, staleRun.runId] })
    });
    const started = response.json as { job: { id: string } };
    const completed = await waitForJob(runner, started.job.id);

    expect(response.status).toBe(202);
    expect(completed).toMatchObject({
      workflow: "certification-index",
      state: "failed",
      error: expect.stringContaining("Cannot index unverifiable proof bundle")
    });
    expect(completed.error).toContain("unexpected receipt.json");
  });

  it("exports a redacted public proof bundle from a managed live artifact run", async () => {
    const config = await testConfig({ maxRequestBytes: 2_000 });
    const store = new WorkbenchArtifactStore(config.artifactRoot);
    const runner = new WorkbenchJobRunner({ config, artifactStore: store });
    const sourceRun = await store.createRunDirectory();
    const secretText = "Bearer live-secret-token TOKEN=live-secret-token https://splunk.local:8089 10.1.2.3 /Users/alice/.splunkready";
    const receipt = {
      id: "receipt-live-001",
      agent: { name: "Live MCP Agent", version: "0.1.0" },
      environment: { id: "contract-live", name: "live-prod" },
      mode: "live",
      contractVersion: "2026.06.01",
      missionSuiteVersion: "security-readiness-1",
      verdict: "READY",
      score: 100,
      passedMissions: ["mission-security-lateral-movement-readiness"],
      failedMissions: [],
      criticalViolations: [],
      violations: [],
      traceRefs: ["trace-live-call"],
      evidenceRefs: ["evt-live-001"],
      policyPatchSummary: [],
      rerunComparison: {},
      generatedBy: "Agent Readiness Compiler"
    };
    const trace = [
      {
        id: "trace-live-call",
        missionId: "mission-security-lateral-movement-readiness",
        timestamp: "2026-06-01T06:31:00.000Z",
        actor: "specimen_agent",
        type: "tool_call",
        toolName: "splunk_run_query",
        toolInput: { query: `search index=wineventlog src=${secretText}` },
        toolOutputSummary: secretText,
        queryRef: "query-live-001",
        timeWindow: { earliest: "-24h", latest: "now" },
        resultCount: null,
        evidenceRefs: ["evt-live-001"],
        error: { rawBody: secretText }
      }
    ];

    await writeFile(join(sourceRun.path, "receipt-after-001.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
    await writeFile(join(sourceRun.path, "trace-after.json"), `${JSON.stringify(trace, null, 2)}\n`, "utf8");
    await writeFile(
      join(sourceRun.path, "proof-audit.json"),
      `${JSON.stringify(
        {
          status: "PASS",
          proofType: "live-security",
          proofDir: sourceRun.path,
          mode: "live",
          mutation: false,
          checks: [{ id: "redaction-source", status: "PASS", detail: secretText }]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeFile(join(sourceRun.path, "proof-manifest.json"), `${JSON.stringify(emptyProofManifest(sourceRun.path), null, 2)}\n`, "utf8");

    const response = await callApi(config, runner, store, {
      method: "POST",
      path: "/api/jobs/public-proof-export",
      body: JSON.stringify({ sourceRunId: sourceRun.runId })
    });
    const started = response.json as { job: { id: string; inputSummary: string } };
    const completed = await waitForJob(runner, started.job.id);
    const exportRoot = join(config.artifactRoot, completed.runId);
    const manifest = JSON.parse(await readFile(join(exportRoot, "public-proof-export-manifest.json"), "utf8")) as {
      source: string;
      sourceRunId: string;
      redactionStatus: string;
      aggregateSha256: string;
      files: Array<{ path: string; sizeBytes: number; sha256: string; redacted: boolean; schemaValidated: boolean }>;
    };
    const uiArtifacts = JSON.parse(await readFile(join(exportRoot, "ui-artifacts.json"), "utf8")) as {
      source: string;
      generatedAt: string;
      defaultArtifact: string;
      artifacts: Array<{ label: string; path: string }>;
    };
    const exportedTrace = JSON.parse(await readFile(join(exportRoot, "trace-after.json"), "utf8")) as Array<{ error: unknown }>;
    const exportedFiles = await store.listRunFiles(completed.runId);
    const exportedText = (
      await Promise.all(exportedFiles.map((fileName) => readFile(join(exportRoot, fileName), "utf8")))
    ).join("\n");
    const aggregateInput = manifest.files
      .map((file) => `${file.path}:${file.sizeBytes}:${file.sha256}`)
      .sort()
      .join("\n");

    expect(response.status).toBe(202);
    expect(started.job.inputSummary).toBe(sourceRun.runId);
    expect(completed).toMatchObject({
      workflow: "public-proof-export",
      state: "succeeded",
      artifacts: expect.arrayContaining([
        "receipt-after-001.json",
        "trace-after.json",
        "proof-audit.json",
        "source-proof-manifest.json",
        "public-proof-summary.json",
        "public-proof-export-manifest.json",
        "ui-artifacts.json",
        "proof-manifest.json"
      ])
    });
    expect(manifest).toMatchObject({
      source: "splunkready-public-proof-export",
      sourceRunId: sourceRun.runId,
      redactionStatus: "REDACTED"
    });
    expect(manifest.aggregateSha256).toBe(createHash("sha256").update(aggregateInput).digest("hex"));
    for (const file of manifest.files) {
      const content = await readFile(join(exportRoot, file.path));

      expect(file.sha256).toBe(createHash("sha256").update(content).digest("hex"));
      expect(file.sizeBytes).toBe(content.byteLength);
      expect(file.redacted).toBe(true);
    }
    expect(manifest.files).toEqual(expect.arrayContaining([expect.objectContaining({ path: "receipt-after-001.json", schemaValidated: true })]));
    expect(uiArtifacts).toMatchObject({
      source: "splunkready-ui-artifacts",
      defaultArtifact: `/api/artifacts/${completed.runId}`,
      artifacts: [{ label: `Redacted export ${sourceRun.runId}`, path: `/api/artifacts/${completed.runId}` }]
    });
    expect(uiArtifacts.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(exportedTrace[0].error).toEqual({ rawBody: "[REDACTED]" });
    expect(exportedText).toContain("[REDACTED]");
    expect(exportedText).not.toContain("live-secret-token");
    expect(exportedText).not.toContain("10.1.2.3");
    expect(exportedText).not.toContain("splunk.local");
    expect(exportedText).not.toContain("/Users/alice");
  });

  it("rejects unmanaged public proof export paths before allocating a job", async () => {
    const config = await testConfig({ maxRequestBytes: 1_000 });
    const store = new WorkbenchArtifactStore(config.artifactRoot);
    const runner = new WorkbenchJobRunner({ config, artifactStore: store });
    const response = await callApi(config, runner, store, {
      method: "POST",
      path: "/api/jobs/public-proof-export",
      body: JSON.stringify({ sourceRunId: "../artifacts/live-security-ui" })
    });

    expect(response.status).toBe(400);
    expect(response.json).toMatchObject({
      error: {
        code: "WORKBENCH_REQUEST_FAILED",
        message: "Public proof export accepts managed artifact run IDs only."
      }
    });
    expect(runner.listJobs()).toHaveLength(0);
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
    const crossSiteFetch = await callApi(config, runner, store, {
      method: "POST",
      path: "/api/jobs/fixture-certification",
      headers: { "sec-fetch-site": "cross-site" }
    });
    const sameOriginFetch = await callApi(config, runner, store, {
      method: "GET",
      path: "/api/health",
      headers: { "sec-fetch-site": "same-origin" }
    });
    const tooLarge = await callApi(config, runner, store, {
      method: "POST",
      path: "/api/jobs/fixture-certification",
      body: "too large"
    });

    expect(badOrigin.status).toBe(403);
    expect(badOrigin.json).toMatchObject({ error: { code: "WORKBENCH_ORIGIN_FORBIDDEN" } });
    expect(crossSiteFetch.status).toBe(403);
    expect(crossSiteFetch.json).toMatchObject({ error: { code: "WORKBENCH_ORIGIN_FORBIDDEN" } });
    expect(sameOriginFetch.status).toBe(200);
    expect(tooLarge.status).toBe(400);
    expect(tooLarge.json).toMatchObject({ error: { code: "WORKBENCH_REQUEST_FAILED" } });
  });
});
