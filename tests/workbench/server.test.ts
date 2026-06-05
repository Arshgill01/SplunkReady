import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createWorkbenchConfig, type WorkbenchConfig } from "../../src/workbench/config.js";
import { startWorkbenchServer, type StartedWorkbenchServer } from "../../src/workbench/server.js";
import type { WorkbenchJobSnapshot } from "../../src/workbench/events.js";

interface StartedTestWorkbench {
  config: WorkbenchConfig;
  server: StartedWorkbenchServer;
}

const tempRoot = async (): Promise<string> => mkdtemp(join(tmpdir(), "splunkready-workbench-server-test-"));

const startTestWorkbench = async (
  overrides: Partial<WorkbenchConfig> = {},
  options: { devUi?: boolean } = {}
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
        capabilities: { fixtureCertification: boolean; live: boolean };
        live: { available: boolean; missing: string[] };
      }>(server.url, "/api/health");

      expect(response.status).toBe(200);
      expect(json).toMatchObject({
        source: "splunkready-workbench",
        capabilities: { fixtureCertification: true, live: true },
        live: { available: true, missing: [] }
      });
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

  it("serves the executable Vite UI shell while the same browser-facing server runs fixture certification", async () => {
    const { server } = await startTestWorkbench({}, { devUi: true });

    try {
      const shell = await fetchText(server.url, "/#certification-replay");

      expect(shell.response.status).toBe(200);
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
  });
});
