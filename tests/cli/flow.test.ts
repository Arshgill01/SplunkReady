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

const parseCliJsonOutput = (stdout: string): { command: string; status: string; artifacts: string[]; messages?: string[] } =>
  JSON.parse(stdout) as { command: string; status: string; artifacts: string[]; messages?: string[] };

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
            "splunk_get_knowledge_objects",
            "splunk_run_query",
            "splunk_run_saved_search",
            "saia_explain_spl",
            "saia_optimize_spl"
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
          results: [{ sourcetype: "XmlWinEventLog:Security" }],
          total_rows: 1
        },
        splunk_get_knowledge_objects: {
          results: [
            {
              id: "saved-search-live-auth",
              type: "saved_searches",
              name: "ES - Lateral Movement Auth Chain",
              app: "SplunkEnterpriseSecuritySuite"
            }
          ],
          total_rows: 1
        },
        splunk_run_query: {
          results: [],
          total_rows: 0
        },
        splunk_run_saved_search: {
          results: [
            { eventRef: "live-evt-102", user: "svc-finance", dest: "win-finance-07" },
            { eventRef: "live-evt-118", user: "svc-finance", dest: "win-finance-07" },
            { eventRef: "live-evt-141", user: "svc-finance", dest: "win-finance-07" }
          ],
          total_rows: 3
        },
        saia_explain_spl: {
          explanation: "The SPL uses a broad index wildcard and a non-contract field."
        },
        saia_optimize_spl: {
          optimizedQuery: "| savedsearch \"ES - Lateral Movement Auth Chain\"",
          rationale: "Prefer the validated saved search from the live contract."
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

const startMockGeminiServer = async () => {
  const prompts: string[] = [];
  const server = createServer((request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      const parsed = JSON.parse(body) as { contents: Array<{ parts: Array<{ text: string }> }> };
      const prompt = parsed.contents.flatMap((content) => content.parts).map((part) => part.text).join("\n");
      prompts.push(prompt);
      const payload =
        prompts.length === 1
          ? {
              rationale: "No contract was injected, so use a broad exploratory SPL query.",
              toolCalls: [
                {
                  toolName: "splunk_run_query",
                  input: {
                    query: "search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now",
                    timeWindow: { earliest: "-24h", latest: "now" },
                    maxRows: 10
                  }
                }
              ]
            }
          : prompts.length === 2
            ? { finalAnswer: "No evidence was found by the broad search." }
            : prompts.length === 3
              ? {
                  rationale: "Compiled policy is injected, so discover and run the preferred saved search.",
                  toolCalls: [
                    {
                      toolName: "splunk_get_knowledge_objects",
                      input: { types: ["saved_searches"], query: "Lateral Movement" }
                    },
                    {
                      toolName: "splunk_run_saved_search",
                      input: {
                        app: "SplunkEnterpriseSecuritySuite",
                        name: "ES - Lateral Movement Auth Chain",
                        maxRows: 10
                      }
                    }
                  ]
                }
              : {
                  finalAnswer:
                    "Evidence supports the investigation: 3 result(s) from saved-search-lateral-movement and SplunkEnterpriseSecuritySuite:ES - Lateral Movement Auth Chain, evidence evt-102, evt-118, evt-141, live-evt-102, live-evt-118, live-evt-141."
                };

      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }));
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Mock Gemini server did not expose a TCP port.");
  }

  return {
    prompts,
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
      "readiness-profile.json",
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
    const readinessProfile = JSON.parse(await readFile(join(outDir, "readiness-profile.json"), "utf8")) as {
      contractRef: { id: string; mode: string };
      deploymentSignals: { savedSearchCount: number; restrictedIndexCount: number };
      llmUsage: { passFailAuthority: string };
      ruleBindings: Array<{ ruleId: string; contractRefs: string[]; rationale: string }>;
    };
    const afterTrace = JSON.parse(await readFile(join(outDir, "trace-after.json"), "utf8")) as Array<{
      toolName: string | null;
      toolInput?: { name?: string };
    }>;
    const policyPatch = JSON.parse(await readFile(join(outDir, "policy-patch.json"), "utf8")) as {
      splAssistance?: Array<{ ruleId: string; explanation: string; optimizedQuery: string }>;
    };
    const policyPatchMarkdown = await readFile(join(outDir, "policy-patch.md"), "utf8");
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
    expect(policyPatch.splAssistance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "SPL-001",
          explanation: "The query searches all indexes and references src_ip, which is not canonical in this fixture.",
          optimizedQuery: "search index=wineventlog host=win-finance-07 src=* earliest=-24h latest=now"
        })
      ])
    );
    expect(policyPatchMarkdown).toContain("SAIA Explanation:");
    expect(policyPatchMarkdown).toContain("SAIA Optimized Query:");
    expect(readinessProfile).toMatchObject({
      contractRef: { id: "contract-acme-soc-dev", mode: "fixture" },
      deploymentSignals: { savedSearchCount: 10, restrictedIndexCount: 1 },
      llmUsage: { passFailAuthority: "deterministic-rule-engine" }
    });
    expect(readinessProfile.ruleBindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "KO-001",
          contractRefs: expect.arrayContaining(["contract-acme-soc-dev.savedSearches"])
        }),
        expect.objectContaining({
          ruleId: "SAF-003",
          contractRefs: expect.arrayContaining(["contract-acme-soc-dev.mcpTools"])
        })
      ])
    );
  });

  it("emits machine-readable JSON output for CI/CD commands", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-cli-json-"));

    const compile = parseCliJsonOutput((await runCli(["compile", "--out", outDir, "--json"])).stdout);
    expect(compile).toMatchObject({
      command: "compile",
      status: "PASS",
      artifacts: expect.arrayContaining([join(outDir, "environment-contract.json")])
    });

    const evaluate = parseCliJsonOutput((await runCli(["evaluate", "--out", outDir, "--json"])).stdout);
    expect(evaluate).toMatchObject({
      command: "evaluate",
      status: "PASS",
      artifacts: expect.arrayContaining([join(outDir, "trace-before.json"), join(outDir, "violations-before.json")])
    });

    const receipt = parseCliJsonOutput((await runCli(["receipt", "--out", outDir, "--json"])).stdout);
    expect(receipt).toMatchObject({
      command: "receipt",
      status: "PASS",
      artifacts: expect.arrayContaining([join(outDir, "receipt-before-001.json"), join(outDir, "policy-patch.json")])
    });

    const gradeTrace = parseCliJsonOutput(
      (
        await runCli([
          "grade-trace",
          "--trace",
          join(outDir, "trace-before.json"),
          "--out",
          outDir,
          "--agent-name",
          "Captured Agent",
          "--agent-version",
          "trace-001",
          "--json"
        ])
      ).stdout
    );
    expect(gradeTrace).toMatchObject({
      command: "grade-trace",
      status: "PASS",
      artifacts: expect.arrayContaining([join(outDir, "receipt-external-001.json")])
    });

    const rerun = parseCliJsonOutput((await runCli(["rerun", "--out", outDir, "--json"])).stdout);
    expect(rerun).toMatchObject({
      command: "rerun",
      status: "PASS",
      artifacts: expect.arrayContaining([join(outDir, "receipt-after-001.json")])
    });
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
      "readiness-profile.json",
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
    expect(policyPatchMarkdown).toContain("SAIA Explanation:");
    expect(policyPatchMarkdown).toContain("SAIA Optimized Query:");
    expect(beforeViolations.map((violation) => violation.ruleId)).toEqual(expect.arrayContaining(requiredRuleIds));
    for (const ruleId of requiredRuleIds) {
      expect(beforeReceiptMarkdown).toContain(ruleId);
      expect(shell).toContain(ruleId);
    }
    expect(shell).toContain('id="certification-replay"');
    expect(shell).toContain('id="rerun-receipts"');
    expect(shell).toContain("Definitive benign conclusion is not supported by adequate evidence.");
  });

  it("grades an externally supplied trace against the compiled Splunk contract", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-external-trace-"));

    await expect(runCli(["compile", "--out", outDir])).resolves.toMatchObject({
      stdout: expect.stringContaining("PASS compile")
    });
    await expect(runCli(["evaluate", "--out", outDir])).resolves.toMatchObject({
      stdout: expect.stringContaining("PASS evaluate")
    });
    await expect(
      runCli([
        "grade-trace",
        "--trace",
        join(outDir, "trace-before.json"),
        "--out",
        outDir,
        "--agent-name",
        "Captured Agent",
        "--agent-version",
        "trace-001"
      ])
    ).resolves.toMatchObject({
      stdout: expect.stringContaining("PASS grade-trace")
    });

    const receipt = JSON.parse(await readFile(join(outDir, "receipt-external-001.json"), "utf8")) as {
      agent: { name: string; version: string };
      verdict: string;
      score: number;
      violations: string[];
      traceRefs: string[];
      policyPatchSummary: unknown[];
      notes: string;
    };
    const violations = JSON.parse(await readFile(join(outDir, "violations-external.json"), "utf8")) as Array<{
      ruleId: string;
    }>;
    const markdown = await readFile(join(outDir, "receipt-external-001.md"), "utf8");

    expect(receipt.agent).toEqual({ name: "Captured Agent", version: "trace-001" });
    expect(receipt.verdict).toBe("NOT READY");
    expect(receipt.score).toBe(0);
    expect(receipt.policyPatchSummary).toEqual([]);
    expect(receipt.traceRefs).toContain("mission-security-lateral-movement-readiness-trace-001");
    expect(receipt.notes).toContain("externally supplied trace");
    expect(violations.map((violation) => violation.ruleId)).toEqual(
      expect.arrayContaining(["SPL-001", "SPL-003", "KO-001", "EVD-001", "ANS-001"])
    );
    expect(markdown).toContain("Captured Agent trace-001");
    expect(markdown).toContain("deterministic rule engine decides pass/fail");
  });

  it("uses the Gemini-backed specimen for evaluate and rerun when LLM mode is enabled", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-llm-cli-"));
    const gemini = await startMockGeminiServer();
    const llmEnv = {
      SPLUNKREADY_LLM_ENABLED: "true",
      GEMINI_API_KEY: "test-gemini-key",
      GEMINI_MODEL: "gemini-test",
      SPLUNKREADY_GEMINI_ENDPOINT_BASE_URL: gemini.url
    };

    try {
      await expect(runCli(["compile", "--out", outDir])).resolves.toMatchObject({
        stdout: expect.stringContaining("PASS compile")
      });
      await expect(runCli(["evaluate", "--out", outDir], process.cwd(), llmEnv)).resolves.toMatchObject({
        stdout: expect.stringContaining("PASS evaluate")
      });
      await expect(runCli(["receipt", "--out", outDir], process.cwd(), llmEnv)).resolves.toMatchObject({
        stdout: expect.stringContaining("receipt-before-001.json")
      });
      await expect(runCli(["rerun", "--out", outDir], process.cwd(), llmEnv)).resolves.toMatchObject({
        stdout: expect.stringContaining("receipt-after-001.json")
      });
    } finally {
      await gemini.close();
    }

    const beforeTrace = JSON.parse(await readFile(join(outDir, "trace-before.json"), "utf8")) as Array<{
      type: string;
      toolName: string | null;
      toolInput?: { query?: string };
    }>;
    const afterTrace = JSON.parse(await readFile(join(outDir, "trace-after.json"), "utf8")) as Array<{
      type: string;
      toolName: string | null;
      toolInput?: { name?: string; maxRows?: number };
    }>;
    const beforeViolations = JSON.parse(await readFile(join(outDir, "violations-before.json"), "utf8")) as Array<{
      ruleId: string;
    }>;
    const afterReceipt = JSON.parse(await readFile(join(outDir, "receipt-after-001.json"), "utf8")) as {
      agent: { name: string; version: string };
      verdict: string;
      score: number;
    };

    expect(gemini.prompts).toHaveLength(4);
    expect(gemini.prompts[0]).toContain("no compiled Splunk contract has been injected");
    expect(gemini.prompts[2]).toContain("Compiled Splunk contract injected by policy");
    expect(gemini.prompts[2]).toContain("Compiled agent policy");
    expect(gemini.prompts[2]).toContain("Do not stop after discovery.");
    expect(beforeTrace[0]).toMatchObject({
      type: "tool_call",
      toolName: "splunk_run_query",
      toolInput: { query: "search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now" }
    });
    expect(afterTrace.map((event) => event.toolName)).toEqual([
      "splunk_get_knowledge_objects",
      "splunk_get_knowledge_objects",
      "splunk_run_saved_search",
      "splunk_run_saved_search",
      null
    ]);
    expect(afterTrace[2]?.toolInput).toMatchObject({ name: "ES - Lateral Movement Auth Chain", maxRows: 10 });
    expect(beforeViolations.map((violation) => violation.ruleId)).toEqual(
      expect.arrayContaining(["SPL-001", "SPL-003", "KO-001", "EVD-001", "ANS-001"])
    );
    expect(afterReceipt).toMatchObject({
      agent: { name: "Gemini Splunk MCP Agent", version: "gemini-test" },
      verdict: "READY",
      score: 100
    });
  });

  it("uses the live adapter for Gemini compile, evaluate, receipt assistance, and rerun in live mode", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-live-llm-cli-"));
    const gemini = await startMockGeminiServer();
    const mcp = await startMockMcpServer();
    const env = {
      SPLUNKREADY_LIVE_ENABLED: "true",
      SPLUNKREADY_SPLUNK_MCP_URL: mcp.url,
      SPLUNKREADY_SPLUNK_MCP_TOKEN: "test-token",
      SPLUNKREADY_SPLUNK_APP: "search",
      SPLUNKREADY_LLM_ENABLED: "true",
      GEMINI_API_KEY: "test-gemini-key",
      GEMINI_MODEL: "gemini-test",
      SPLUNKREADY_GEMINI_ENDPOINT_BASE_URL: gemini.url
    };

    try {
      await expect(runCli(["compile", "--mode", "live", "--out", outDir], process.cwd(), env)).resolves.toMatchObject({
        stdout: expect.stringContaining("PASS compile")
      });
      await expect(runCli(["evaluate", "--mode", "live", "--out", outDir], process.cwd(), env)).resolves.toMatchObject({
        stdout: expect.stringContaining("PASS evaluate")
      });
      await expect(runCli(["receipt", "--mode", "live", "--out", outDir], process.cwd(), env)).resolves.toMatchObject({
        stdout: expect.stringContaining("policy-patch.json")
      });
      await expect(runCli(["rerun", "--mode", "live", "--out", outDir], process.cwd(), env)).resolves.toMatchObject({
        stdout: expect.stringContaining("receipt-after-001.json")
      });
    } finally {
      await gemini.close();
      await mcp.close();
    }

    const contract = JSON.parse(await readFile(join(outDir, "environment-contract.json"), "utf8")) as { mode: string };
    const beforeTrace = JSON.parse(await readFile(join(outDir, "trace-before.json"), "utf8")) as Array<{
      toolName: string | null;
      queryRef?: string | null;
    }>;
    const afterTrace = JSON.parse(await readFile(join(outDir, "trace-after.json"), "utf8")) as Array<{
      toolName: string | null;
      queryRef?: string | null;
      evidenceRefs?: string[];
    }>;
    const afterReceipt = JSON.parse(await readFile(join(outDir, "receipt-after-001.json"), "utf8")) as {
      verdict: string;
      score: number;
    };
    const patchMarkdown = await readFile(join(outDir, "policy-patch.md"), "utf8");

    expect(contract.mode).toBe("live");
    expect(beforeTrace.map((event) => event.toolName)).toContain("splunk_run_query");
    expect(afterTrace.map((event) => event.toolName)).toEqual([
      "splunk_get_knowledge_objects",
      "splunk_get_knowledge_objects",
      "splunk_run_saved_search",
      "splunk_run_saved_search",
      null
    ]);
    expect(afterTrace.find((event) => event.toolName === "splunk_run_saved_search" && event.queryRef)).toMatchObject({
      queryRef: "SplunkEnterpriseSecuritySuite:ES - Lateral Movement Auth Chain",
      evidenceRefs: ["live-evt-102", "live-evt-118", "live-evt-141"]
    });
    expect(afterReceipt).toMatchObject({ verdict: "READY", score: 100 });
    expect(patchMarkdown).toContain("SAIA Explanation:");
    expect(patchMarkdown).toContain("SAIA Optimized Query:");
    expect(mcp.calls.map((call) => call.params.name)).toEqual(
      expect.arrayContaining(["splunk_run_query", "splunk_run_saved_search", "saia_explain_spl", "saia_optimize_spl"])
    );
  });

  it("rejects an externally supplied trace for the wrong mission", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-external-trace-mismatch-"));

    await expect(runCli(["compile", "--out", outDir])).resolves.toMatchObject({
      stdout: expect.stringContaining("PASS compile")
    });
    await expect(
      runCli(["grade-trace", "--trace", "fixtures/acme-soc-dev/traces/naive-failure.json", "--out", outDir])
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("Trace missionId mismatch")
    });
  });

  it("returns an actionable error when evaluate runs before compile", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-cli-missing-"));

    await expect(runCli(["evaluate", "--out", outDir])).rejects.toMatchObject({
      stderr: expect.stringContaining("Unable to read environment contract")
    });
  });

  it("blocks unsafe agent queries before Splunk execution when evaluate firewall is enabled", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-cli-firewall-"));

    await expect(runCli(["compile", "--out", outDir])).resolves.toMatchObject({
      stdout: expect.stringContaining("PASS compile")
    });
    await expect(runCli(["evaluate", "--out", outDir, "--firewall"])).rejects.toMatchObject({
      stderr: expect.stringContaining("FIREWALL_POLICY_BLOCKED")
    });
    expect(await exists(join(outDir, "trace-before.json"))).toBe(false);
  });

  it("allows a compliant policy-backed rerun when rerun firewall is enabled", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-cli-rerun-firewall-"));

    await expect(runCli(["compile", "--out", outDir])).resolves.toMatchObject({
      stdout: expect.stringContaining("PASS compile")
    });
    await expect(runCli(["evaluate", "--out", outDir])).resolves.toMatchObject({
      stdout: expect.stringContaining("PASS evaluate")
    });
    await expect(runCli(["receipt", "--out", outDir])).resolves.toMatchObject({
      stdout: expect.stringContaining("policy-patch.json")
    });
    await expect(runCli(["rerun", "--out", outDir, "--firewall"])).resolves.toMatchObject({
      stdout: expect.stringContaining("receipt-after-001.json")
    });

    const afterReceipt = JSON.parse(await readFile(join(outDir, "receipt-after-001.json"), "utf8")) as {
      verdict: string;
      score: number;
    };
    expect(afterReceipt).toMatchObject({ verdict: "READY", score: 100 });
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
    expect(await exists(join(outDir, "live-smoke-readiness-profile.json"))).toBe(false);
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
    const profile = JSON.parse(await readFile(join(outDir, "live-smoke-readiness-profile.json"), "utf8")) as {
      id: string;
      contractRef: { mode: string };
      sourceRefs: string[];
      deploymentSignals: { savedSearchCount: number; allowedTools: string[] };
      llmUsage: { passFailAuthority: string };
      ruleBindings: Array<{ ruleId: string; evidence: Array<{ ref: string }> }>;
    };
    const summary = JSON.parse(await readFile(join(outDir, "live-smoke-summary.json"), "utf8")) as {
      readinessProfileId: string;
      allowedTools: string[];
      notCalledTools: string[];
      readOnlyToolsOnly: boolean;
      destructiveOperations: boolean;
    };

    expect(contract.mode).toBe("live");
    expect(contract.savedSearches).toEqual([{ app: "SplunkEnterpriseSecuritySuite", name: "ES - Lateral Movement Auth Chain" }]);
    expect(profile).toMatchObject({
      contractRef: { mode: "live" },
      deploymentSignals: { savedSearchCount: 1 },
      llmUsage: { passFailAuthority: "deterministic-rule-engine" }
    });
    expect(profile.sourceRefs).toEqual(
      expect.arrayContaining(["splunk_get_info", "splunk_get_knowledge_objects", "mission:mission-security-lateral-movement-readiness"])
    );
    expect(profile.ruleBindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "KO-001",
          evidence: expect.arrayContaining([expect.objectContaining({ ref: "contract-acme-soc-prod.savedSearches" })])
        })
      ])
    );
    expect(summary).toMatchObject({
      readinessProfileId: profile.id,
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
      "splunk_get_knowledge_objects",
      "splunk_get_knowledge_objects",
      "splunk_get_knowledge_objects",
      "splunk_get_knowledge_objects",
      "splunk_get_knowledge_objects",
      "splunk_get_knowledge_objects",
      "splunk_get_knowledge_objects"
    ]);
    expect(
      server.calls
        .filter((call) => call.params.name === "splunk_get_knowledge_objects")
        .map((call) => (call.params.arguments as { type?: string }).type)
    ).toEqual(["saved_searches", "macros", "lookups", "views", "panels", "field_aliases", "data_models"]);
    expect(server.calls.every((call) => call.method === "tools/call")).toBe(true);
    expect(server.calls.find((call) => call.params.name === "splunk_get_metadata")?.params.arguments).toMatchObject({
      type: "sourcetypes",
      index: "*",
      earliest_time: "-15m",
      latest_time: "now"
    });
    expect(server.calls.find((call) => call.params.name === "splunk_get_knowledge_objects")?.params.arguments).toMatchObject({
      type: "saved_searches"
    });
  });

  it("scans bounded live saved-search candidates without mutating Splunk", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-live-candidates-"));
    const server = await startMockMcpServer();
    const env = {
      SPLUNKREADY_LIVE_ENABLED: "true",
      SPLUNKREADY_SPLUNK_MCP_URL: server.url,
      SPLUNKREADY_SPLUNK_MCP_TOKEN: "test-token",
      SPLUNKREADY_SPLUNK_APP: "search"
    };

    try {
      await expect(runCli(["compile", "--mode", "live", "--out", outDir], process.cwd(), env)).resolves.toMatchObject({
        stdout: expect.stringContaining("PASS compile")
      });
      await expect(
        runCli(["live-candidates", "--out", outDir, "--candidate-limit", "1"], process.cwd(), env)
      ).resolves.toMatchObject({
        stdout: expect.stringContaining("PASS live-candidates")
      });
    } finally {
      await server.close();
    }

    const report = JSON.parse(await readFile(join(outDir, "live-candidates.json"), "utf8")) as {
      mode: string;
      checked: number;
      maxRowsPerSavedSearch: number;
      mutation: boolean;
      candidatesWithRows: Array<{ ref: string; resultCount: number; evidenceRefs: string[] }>;
    };

    expect(report).toMatchObject({
      mode: "live",
      checked: 1,
      maxRowsPerSavedSearch: 5,
      mutation: false
    });
    expect(report.candidatesWithRows).toEqual([
      expect.objectContaining({
        ref: "SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain",
        resultCount: 3,
        evidenceRefs: ["live-evt-102", "live-evt-118", "live-evt-141"]
      })
    ]);
    expect(server.calls.map((call) => call.params.name)).toContain("splunk_run_saved_search");
  });
});
