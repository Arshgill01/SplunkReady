import { mkdtemp, readdir, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { promisify } from "node:util";

import { beforeAll, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
let cliPath = "";

beforeAll(async () => {
  const buildDir = join(process.cwd(), "dist", "cli-flow-test");
  await execFileAsync("npx", ["tsc", "--outDir", join(buildDir, "dist")], { cwd: process.cwd() });
  cliPath = join(buildDir, "dist", "src", "cli.js");
}, 30_000);

const runCli = async (args: string[], cwd: string = process.cwd(), env: NodeJS.ProcessEnv = {}) =>
  execFileAsync(process.execPath, [cliPath, ...args], { cwd, env: { ...process.env, ...env } });

const exists = async (path: string): Promise<boolean> =>
  stat(path)
    .then(() => true)
    .catch(() => false);

const startMockMcpServer = async () => {
  const calls: Array<{ method: string; params: { name: string; arguments: unknown } }> = [];
  const server = createServer((request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      const parsed = JSON.parse(body) as { id: string; method: string; params: { name: string; arguments: unknown } };
      calls.push(parsed);
      const outputByToolName: Record<string, unknown> = {
        splunk_get_info: {
          mode: "live",
          deploymentName: "acme-soc-prod",
          readOnlyTools: [
            "splunk_get_info",
            "splunk_get_user_info",
            "splunk_get_indexes",
            "splunk_get_metadata",
            "splunk_get_knowledge_objects"
          ]
        },
        splunk_get_user_info: {
          username: "splunkready-smoke",
          roles: ["user"],
          defaultApp: "search",
          capabilities: ["search"]
        },
        splunk_get_indexes: [{ name: "wineventlog", sensitive: false }],
        splunk_get_metadata: {
          indexes: [{ name: "wineventlog", sensitive: false }],
          sourcetypes: [{ name: "XmlWinEventLog:Security", indexes: ["wineventlog"], fields: ["src", "dest", "user"] }],
          source: "live",
          warnings: []
        },
        splunk_get_knowledge_objects: {
          objects: [
            {
              id: "saved-search-live-auth",
              type: "saved_searches",
              name: "ES - Live Auth Chain",
              app: "SplunkEnterpriseSecuritySuite"
            }
          ],
          resultCount: 1,
          warnings: []
        }
      };

      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: parsed.id,
          result: { structuredContent: outputByToolName[parsed.params.name] }
        })
      );
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Mock MCP server did not expose a TCP port.");
  }

  return {
    calls,
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      })
  };
};

describe("SplunkReady CLI flow", () => {
  it("runs fixture compile, evaluate, receipt, and rerun commands with stable artifacts", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-cli-"));

    await expect(runCli(["compile", "--out", outDir])).resolves.toMatchObject({
      stdout: expect.stringContaining("PASS compile")
    });
    await expect(runCli(["evaluate", "--out", outDir])).resolves.toMatchObject({
      stdout: expect.stringContaining("PASS evaluate")
    });
    await expect(runCli(["receipt", "--out", outDir])).resolves.toMatchObject({
      stdout: expect.stringContaining("policy-patch.json")
    });
    await expect(runCli(["rerun", "--out", outDir])).resolves.toMatchObject({
      stdout: expect.stringContaining("receipt-after-001.json")
    });

    const expectedArtifacts = [
      "environment-contract.json",
      "missions.json",
      "agent-policy.json",
      "trace-before.json",
      "violations-before.json",
      "score-before.json",
      "receipt-before-001.json",
      "receipt-before-001.md",
      "policy-patch.json",
      "policy-patch.md",
      "trace-after.json",
      "violations-after.json",
      "score-after.json",
      "receipt-after-001.json",
      "receipt-after-001.md"
    ];

    for (const artifact of expectedArtifacts) {
      expect(await exists(join(outDir, artifact))).toBe(true);
    }

    const beforeTrace = JSON.parse(await readFile(join(outDir, "trace-before.json"), "utf8")) as Array<{
      toolName: string | null;
      toolInput?: { query?: string };
    }>;
    const afterTrace = JSON.parse(await readFile(join(outDir, "trace-after.json"), "utf8")) as Array<{
      toolName: string | null;
      toolInput?: { name?: string };
    }>;
    const beforeReceipt = JSON.parse(await readFile(join(outDir, "receipt-before-001.json"), "utf8")) as {
      verdict: string;
      traceRefs: string[];
    };
    const afterReceipt = JSON.parse(await readFile(join(outDir, "receipt-after-001.json"), "utf8")) as {
      verdict: string;
      score: number;
      violations: string[];
    };
    const afterViolations = JSON.parse(await readFile(join(outDir, "violations-after.json"), "utf8")) as unknown[];

    expect(beforeTrace[0]).toMatchObject({
      toolName: "splunk_run_query",
      toolInput: { query: "search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now" }
    });
    expect(afterTrace[2]).toMatchObject({
      toolName: "splunk_run_saved_search",
      toolInput: { name: "ES - Lateral Movement Auth Chain" }
    });
    expect(beforeReceipt.verdict).toBe("NOT READY");
    expect(beforeReceipt.traceRefs).toContain("mission-security-lateral-movement-readiness-trace-001");
    expect(afterReceipt).toMatchObject({ verdict: "READY", score: 100, violations: [] });
    expect(afterViolations).toEqual([]);
  });

  it("runs the clean fixture demo orchestration and writes rehearsal artifacts", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-demo-"));

    await expect(runCli(["demo", "--out", outDir])).resolves.toMatchObject({
      stdout: expect.stringContaining("PASS demo")
    });

    const expectedArtifacts = [
      "environment-contract.json",
      "missions.json",
      "agent-policy.json",
      "trace-before.json",
      "violations-before.json",
      "score-before.json",
      "receipt-before-001.json",
      "receipt-before-001.md",
      "policy-patch.json",
      "policy-patch.md",
      "trace-after.json",
      "violations-after.json",
      "score-after.json",
      "receipt-after-001.json",
      "receipt-after-001.md",
      "splunkready-shell.html",
      "demo-rehearsal.json",
      "demo-rehearsal.md"
    ];

    for (const artifact of expectedArtifacts) {
      expect(await exists(join(outDir, artifact))).toBe(true);
    }

    const rehearsal = JSON.parse(await readFile(join(outDir, "demo-rehearsal.json"), "utf8")) as {
      status: string;
      fitsUnderThreeMinutes: boolean;
      uiRoute: string;
      story: string;
      expectedArtifacts: string[];
    };
    const beforeReceipt = JSON.parse(await readFile(join(outDir, "receipt-before-001.json"), "utf8")) as {
      verdict: string;
    };
    const afterReceipt = JSON.parse(await readFile(join(outDir, "receipt-after-001.json"), "utf8")) as { verdict: string };
    const beforeViolations = JSON.parse(await readFile(join(outDir, "violations-before.json"), "utf8")) as Array<{
      ruleId: string;
    }>;
    const beforeReceiptMarkdown = await readFile(join(outDir, "receipt-before-001.md"), "utf8");
    const afterReceiptMarkdown = await readFile(join(outDir, "receipt-after-001.md"), "utf8");
    const policyPatchMarkdown = await readFile(join(outDir, "policy-patch.md"), "utf8");
    const demoRehearsalMarkdown = await readFile(join(outDir, "demo-rehearsal.md"), "utf8");
    const shell = await readFile(join(outDir, "splunkready-shell.html"), "utf8");
    const artifactNames = (await readdir(outDir)).sort();
    const expectedArtifactPaths = expectedArtifacts.map((artifact) => join(outDir, artifact)).sort();
    const requiredRuleIds = ["SPL-001", "SPL-003", "KO-001", "EVD-001", "ANS-001"];

    expect(rehearsal).toMatchObject({
      status: "PASS",
      fitsUnderThreeMinutes: true,
      story: "fail -> compile -> patch -> rerun -> pass"
    });
    expect(rehearsal.uiRoute).toContain("splunkready-shell.html#certification-replay");
    expect(demoRehearsalMarkdown).toContain("splunkready-shell.html#certification-replay");
    expect(await exists(rehearsal.uiRoute.split("#")[0] ?? "")).toBe(true);
    expect(artifactNames).toEqual([...expectedArtifacts].sort());
    expect([...rehearsal.expectedArtifacts].sort()).toEqual(expectedArtifactPaths);
    for (const artifactPath of rehearsal.expectedArtifacts) {
      expect(await exists(artifactPath)).toBe(true);
    }
    expect(beforeReceipt.verdict).toBe("NOT READY");
    expect(afterReceipt.verdict).toBe("READY");
    expect(beforeReceiptMarkdown).toContain("NOT READY");
    expect(afterReceiptMarkdown).toContain("READY");
    expect(policyPatchMarkdown).toContain("This patch does not change Splunk configuration.");
    expect(beforeViolations.map((violation) => violation.ruleId)).toEqual(expect.arrayContaining(requiredRuleIds));
    for (const ruleId of requiredRuleIds) {
      expect(beforeReceiptMarkdown).toContain(ruleId);
      expect(shell).toContain(ruleId);
    }
    expect(shell).toContain('id="certification-replay"');
    expect(shell).toContain('id="rerun-receipts"');
    expect(shell).toContain("Definitive benign conclusion is not supported by adequate evidence.");
  });

  it("returns an actionable error when evaluate runs before compile", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-cli-missing-"));

    await expect(runCli(["evaluate", "--out", outDir])).rejects.toMatchObject({
      stderr: expect.stringContaining("Unable to read environment contract")
    });
  });

  it("skips live smoke cleanly when credentials are absent", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-live-smoke-skip-"));

    await expect(
      runCli(["live-smoke", "--out", outDir], process.cwd(), {
        SPLUNKREADY_LIVE_ENABLED: undefined,
        SPLUNKREADY_SPLUNK_MCP_URL: undefined,
        SPLUNKREADY_SPLUNK_MCP_TOKEN: undefined
      })
    ).resolves.toMatchObject({
      stdout: expect.stringContaining("SKIP live-smoke")
    });
    const result = await runCli(["live-smoke", "--out", outDir], process.cwd(), {
      SPLUNKREADY_LIVE_ENABLED: undefined,
      SPLUNKREADY_SPLUNK_MCP_URL: undefined,
      SPLUNKREADY_SPLUNK_MCP_TOKEN: "super-secret-token"
    });
    expect(result.stdout).toContain("No live Splunk calls were made and no live artifacts were written.");
    expect(result.stdout).toContain("Fixture commands still run without live credentials.");
    expect(result.stdout).toContain("docs/live-adapter.md");
    expect(result.stdout).not.toContain("super-secret-token");
    await expect(
      runCli(["live-smoke", "--out", outDir, "--require-live", "true"], process.cwd(), {
        SPLUNKREADY_LIVE_ENABLED: undefined,
        SPLUNKREADY_SPLUNK_MCP_URL: undefined,
        SPLUNKREADY_SPLUNK_MCP_TOKEN: "super-secret-token"
      })
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("No live Splunk calls were made and no live artifacts were written.")
    });
    expect(await exists(join(outDir, "live-smoke-contract.json"))).toBe(false);
  });

  it("runs live smoke against a bounded read-only MCP endpoint", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-live-smoke-"));
    const server = await startMockMcpServer();

    try {
      await expect(
        runCli(["live-smoke", "--out", outDir], process.cwd(), {
          SPLUNKREADY_LIVE_ENABLED: "true",
          SPLUNKREADY_SPLUNK_MCP_URL: server.url,
          SPLUNKREADY_SPLUNK_MCP_TOKEN: "test-token",
          SPLUNKREADY_SPLUNK_APP: "search",
          SPLUNKREADY_SPLUNK_CAPABILITIES: "splunk_run_query,splunk_run_saved_search"
        })
      ).resolves.toMatchObject({
        stdout: expect.stringContaining("PASS live-smoke")
      });
    } finally {
      await server.close();
    }

    const contract = JSON.parse(await readFile(join(outDir, "live-smoke-contract.json"), "utf8")) as {
      mode: string;
      savedSearches: Array<{ name: string }>;
    };
    const summary = JSON.parse(await readFile(join(outDir, "live-smoke-summary.json"), "utf8")) as {
      allowedTools: string[];
      notCalledTools: string[];
      readOnlyToolsOnly: boolean;
      destructiveOperations: boolean;
    };

    expect(contract.mode).toBe("live");
    expect(contract.savedSearches).toEqual([{ app: "SplunkEnterpriseSecuritySuite", name: "ES - Live Auth Chain" }]);
    expect(summary).toMatchObject({
      allowedTools: [
        "splunk_get_info",
        "splunk_get_user_info",
        "splunk_get_indexes",
        "splunk_get_metadata",
        "splunk_get_knowledge_objects"
      ],
      readOnlyToolsOnly: true,
      destructiveOperations: false
    });
    expect(summary.notCalledTools).toEqual(
      expect.arrayContaining(["splunk_run_query", "splunk_run_saved_search", "saia_explain_spl", "saia_optimize_spl"])
    );
    expect(server.calls.map((call) => call.params.name)).toEqual([
      "splunk_get_info",
      "splunk_get_user_info",
      "splunk_get_indexes",
      "splunk_get_metadata",
      "splunk_get_knowledge_objects"
    ]);
    expect(server.calls.every((call) => call.method === "tools/call")).toBe(true);
    expect(server.calls.find((call) => call.params.name === "splunk_get_metadata")?.params.arguments).toMatchObject({
      indexes: ["wineventlog"],
      timeWindow: { earliest: "-15m", latest: "now" }
    });
  });
});
