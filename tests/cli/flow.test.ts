import { mkdtemp, readdir, readFile, stat, writeFile } from "node:fs/promises";
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
}, 60_000);

const runCli = async (args: string[], cwd: string = process.cwd(), env: NodeJS.ProcessEnv = {}) =>
  execFileAsync(process.execPath, [cliPath, ...args], { cwd, env: { ...process.env, ...env } });

const exists = async (path: string): Promise<boolean> =>
  stat(path)
    .then(() => true)
    .catch(() => false);

interface ParsedCliJsonOutput {
  command: string;
  status: string;
  artifacts: string[];
  messages?: string[];
  error?: string;
}

const parseCliJsonOutput = (stdout: string): ParsedCliJsonOutput => JSON.parse(stdout) as ParsedCliJsonOutput;

const proofAuditArtifacts = (outDir: string): string[] => [join(outDir, "proof-audit.json"), join(outDir, "proof-manifest.json")];

const defaultSavedSearchRows = [
  { eventRef: "live-evt-102", user: "svc-finance", dest: "win-finance-07" },
  { eventRef: "live-evt-118", user: "svc-finance", dest: "win-finance-07" },
  { eventRef: "live-evt-141", user: "svc-finance", dest: "win-finance-07" }
];

const startMockMcpServer = async (
  options: {
    indexes?: Array<{ name: string; sensitive: boolean }>;
    savedSearches?: Array<{ id: string; type: string; name: string; app: string }>;
    savedSearchRows?: Array<Record<string, unknown>>;
    blockHostedModels?: boolean;
  } = {}
) => {
  const calls: Array<{ method: string; params: { name: string; arguments: unknown } }> = [];
  const savedSearchRows = options.savedSearchRows ?? defaultSavedSearchRows;
  const savedSearches = options.savedSearches ?? [
    {
      id: "saved-search-live-auth",
      type: "saved_searches",
      name: "ES - Lateral Movement Auth Chain",
      app: "SplunkEnterpriseSecuritySuite"
    }
  ];
  const server = createServer((request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      const parsed = JSON.parse(body) as { id: string; method: string; params: { name: string; arguments: unknown } };
      calls.push(parsed);

      if (options.blockHostedModels && parsed.params.name.startsWith("saia_")) {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            jsonrpc: "2.0",
            id: parsed.id,
            result: {
              isError: true,
              content: [{ type: "text", text: `Action forbidden: ${parsed.params.name} requires Splunk AI Assistant access.` }]
            }
          })
        );
        return;
      }

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
        splunk_get_indexes: options.indexes ?? [{ name: "wineventlog", sensitive: false }],
        splunk_get_metadata: {
          results: [{ sourcetype: "XmlWinEventLog:Security" }],
          total_rows: 1
        },
        splunk_get_knowledge_objects: {
          results: savedSearches,
          total_rows: savedSearches.length
        },
        splunk_run_query: {
          results: [],
          total_rows: 0
        },
        splunk_run_saved_search: {
          results: savedSearchRows,
          total_rows: savedSearchRows.length
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

    const proofAudit = parseCliJsonOutput((await runCli(["proof-audit", "--out", outDir, "--json"])).stdout);
    const proofAuditReport = JSON.parse(await readFile(join(outDir, "proof-audit.json"), "utf8")) as {
      status: string;
      proofType: string;
      failToPass: boolean;
    };
    const proofManifest = JSON.parse(await readFile(join(outDir, "proof-manifest.json"), "utf8")) as {
      source: string;
      proofDir: string;
      aggregateSha256: string;
      files: Array<{ path: string; sizeBytes: number; sha256: string }>;
    };

    expect(proofAudit).toMatchObject({
      command: "proof-audit",
      status: "PASS",
      artifacts: proofAuditArtifacts(outDir)
    });
    expect(proofAuditReport).toMatchObject({
      status: "WARN",
      proofType: "receipt",
      failToPass: true
    });
    expect(proofManifest).toMatchObject({
      source: "splunkready-proof-manifest",
      proofDir: outDir
    });
    expect(proofManifest.aggregateSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(proofManifest.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "proof-audit.json" }),
        expect.objectContaining({ path: "receipt-after-001.json" })
      ])
    );
    const manifestVerification = parseCliJsonOutput((await runCli(["verify-manifest", "--out", outDir, "--json"])).stdout);
    const manifestVerificationReport = JSON.parse(await readFile(join(outDir, "proof-manifest-verification.json"), "utf8")) as {
      status: string;
      expectedAggregateSha256: string;
      actualAggregateSha256: string;
      changedFiles: Array<{ path: string }>;
    };

    expect(manifestVerification).toMatchObject({
      command: "verify-manifest",
      status: "PASS",
      artifacts: [join(outDir, "proof-manifest-verification.json")]
    });
    expect(manifestVerificationReport).toMatchObject({
      status: "PASS",
      expectedAggregateSha256: proofManifest.aggregateSha256,
      actualAggregateSha256: proofManifest.aggregateSha256,
      changedFiles: []
    });
    await expect(runCli(["proof-audit", "--out", outDir, "--require-pass", "true"])).rejects.toMatchObject({
      stderr: expect.stringContaining("proof-audit strict gate failed with WARN")
    });

    const jsonFailure = await runCli(["proof-audit", "--out", outDir, "--require-pass", "true", "--json"]).then(
      () => {
        throw new Error("Expected proof-audit strict JSON gate to fail.");
      },
      (error: unknown) => error as { stderr: string }
    );
    const failure = parseCliJsonOutput(jsonFailure.stderr);

    expect(failure).toMatchObject({
      command: "proof-audit",
      status: "FAIL",
      artifacts: [],
      error: expect.stringContaining("proof-audit strict gate failed with WARN")
    });
  });

  it("runs a multi-mission fixture proof across security and observability", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-suite-proof-"));

    const output = parseCliJsonOutput((await runCli(["suite-proof", "--out", outDir, "--json"])).stdout);
    const summary = JSON.parse(await readFile(join(outDir, "suite-proof-summary.json"), "utf8")) as {
      status: string;
      mode: string;
      mutation: boolean;
      suiteId: string;
      suiteTitle: string;
      suitePath: string;
      missionCount: number;
      domains: string[];
      totals: { failToPass: number; readyAfterPatch: number; evidenceRefs: number };
      missions: Array<{
        missionId: string;
        domain: string;
        proofLoop: string;
        before: { verdict: string; score: number; violations: number };
        after: { verdict: string; score: number; violations: number; evidenceRefs: string[] };
      }>;
    };
    const markdown = await readFile(join(outDir, "suite-proof-summary.md"), "utf8");

    expect(output).toMatchObject({
      command: "suite-proof",
      status: "PASS",
      artifacts: expect.arrayContaining([
        join(outDir, "suite-proof-summary.json"),
        join(outDir, "suite-proof-summary.md"),
        join(outDir, "mission-security-lateral-movement-readiness", "receipt-after-001.json"),
        join(outDir, "mission-security-exfiltration-readiness", "receipt-after-001.json"),
        join(outDir, "mission-observability-latency-readiness", "receipt-after-001.json")
      ])
    });
    expect(summary).toMatchObject({
      status: "PASS",
      mode: "fixture",
      mutation: false,
      suiteId: "phase-live-multi-mission-proof",
      suiteTitle: "Phase Live multi-mission readiness proof",
      suitePath: "fixtures/acme-soc-dev/suites/phase-live-readiness-suite.json",
      missionCount: 3,
      domains: ["observability", "security"],
      totals: {
        failToPass: 3,
        readyAfterPatch: 3,
        evidenceRefs: 15
      }
    });
    expect(summary.missions.map((mission) => mission.missionId).sort()).toEqual([
      "mission-observability-latency-readiness",
      "mission-security-exfiltration-readiness",
      "mission-security-lateral-movement-readiness"
    ]);
    for (const mission of summary.missions) {
      expect(mission.proofLoop).toBe("fail-to-pass");
      expect(mission.before.verdict).toBe("NOT READY");
      expect(mission.before.violations).toBeGreaterThan(0);
      expect(mission.after).toMatchObject({ verdict: "READY", score: 100, violations: 0 });
      expect(mission.after.evidenceRefs.length).toBeGreaterThan(0);
    }
    expect(markdown).toContain("SplunkReady Suite Proof");
    expect(markdown).toContain("Phase Live multi-mission readiness proof");
    expect(markdown).toContain("mission-observability-latency-readiness");

    const auditOutput = parseCliJsonOutput(
      (await runCli(["proof-audit", "--out", outDir, "--require-pass", "true", "--json"])).stdout
    );
    const audit = JSON.parse(await readFile(join(outDir, "proof-audit.json"), "utf8")) as {
      status: string;
      proofType: string;
      mode: string;
      mutation: boolean;
      failToPass: boolean;
      readyAfterPatch: boolean;
      proofLoop: string;
      checks: Array<{ id: string; status: string }>;
    };

    expect(auditOutput).toMatchObject({
      command: "proof-audit",
      status: "PASS",
      artifacts: proofAuditArtifacts(outDir)
    });
    expect(audit).toMatchObject({
      status: "PASS",
      proofType: "suite",
      mode: "fixture",
      mutation: false,
      failToPass: true,
      readyAfterPatch: true,
      proofLoop: "fail-to-pass"
    });
    expect(audit.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "suite-summary-loaded", status: "PASS" }),
        expect.objectContaining({ id: "suite-status-pass", status: "PASS" }),
        expect.objectContaining({ id: "suite-mutation-false", status: "PASS" }),
        expect.objectContaining({ id: "suite-fail-to-pass", status: "PASS" }),
        expect.objectContaining({ id: "suite-ready-after-patch", status: "PASS" }),
        expect.objectContaining({ id: "suite-evidence-refs-present", status: "PASS" })
      ])
    );

    const strictOutDir = await mkdtemp(join(tmpdir(), "splunkready-suite-proof-strict-"));
    const strictOutput = parseCliJsonOutput(
      (await runCli(["suite-proof", "--out", strictOutDir, "--require-fail-to-pass", "true", "--json"])).stdout
    );

    expect(strictOutput).toMatchObject({
      command: "suite-proof",
      status: "PASS",
      artifacts: expect.arrayContaining([
        join(strictOutDir, "suite-proof-summary.json"),
        join(strictOutDir, "suite-proof-summary.md")
      ])
    });

    await expect(
      runCli(["suite-proof", "--out", strictOutDir, "--require-fail-to-pass", "maybe"])
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("--require-fail-to-pass must be true or false.")
    });

    const customSuiteDir = await mkdtemp(join(tmpdir(), "splunkready-custom-suite-"));
    const customSuitePath = join(customSuiteDir, "suite.json");

    await writeFile(
      customSuitePath,
      JSON.stringify(
        {
          id: "custom-observability-suite",
          title: "Custom observability proof suite",
          missionPaths: [join(process.cwd(), "fixtures/acme-soc-dev/missions/observability-latency-readiness.json")]
        },
        null,
        2
      ),
      "utf8"
    );

    const customOutDir = await mkdtemp(join(tmpdir(), "splunkready-suite-proof-custom-"));
    const customOutput = parseCliJsonOutput(
      (
        await runCli([
          "suite-proof",
          "--suite",
          customSuitePath,
          "--out",
          customOutDir,
          "--require-fail-to-pass",
          "true",
          "--json"
        ])
      ).stdout
    );
    const customSummary = JSON.parse(await readFile(join(customOutDir, "suite-proof-summary.json"), "utf8")) as {
      suiteId: string;
      suiteTitle: string;
      suitePath: string;
      missionCount: number;
      totals: { failToPass: number };
      missions: Array<{ missionId: string; proofLoop: string }>;
    };

    expect(customOutput).toMatchObject({
      command: "suite-proof",
      status: "PASS",
      artifacts: expect.arrayContaining([join(customOutDir, "suite-proof-summary.json")])
    });
    expect(customSummary).toMatchObject({
      suiteId: "custom-observability-suite",
      suiteTitle: "Custom observability proof suite",
      suitePath: customSuitePath,
      missionCount: 1,
      totals: { failToPass: 1 }
    });
    expect(customSummary.missions).toMatchObject([
      { missionId: "mission-observability-latency-readiness", proofLoop: "fail-to-pass" }
    ]);
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

  it("imports a Splunk MCP JSON-RPC transcript for external trace grading", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-mcp-transcript-"));

    await expect(runCli(["compile", "--out", outDir])).resolves.toMatchObject({
      stdout: expect.stringContaining("PASS compile")
    });

    const importOutput = parseCliJsonOutput(
      (
        await runCli([
          "import-mcp-transcript",
          "--transcript",
          "examples/sample-mcp-transcript.jsonl",
          "--out",
          outDir,
          "--strict-import",
          "true",
          "--json"
        ])
      ).stdout
    );

    expect(importOutput).toMatchObject({
      command: "import-mcp-transcript",
      status: "PASS",
      artifacts: expect.arrayContaining([join(outDir, "trace-imported.json"), join(outDir, "mcp-transcript-import.json")])
    });

    const summary = JSON.parse(await readFile(join(outDir, "mcp-transcript-import.json"), "utf8")) as {
      source: string;
      mutation: boolean;
      toolCalls: number;
      toolResults: number;
      finalAnswers: number;
      unmatchedToolCalls: number;
      strictImport: boolean;
      toolNames: string[];
      nextCommand: string;
    };
    const importedTrace = JSON.parse(await readFile(join(outDir, "trace-imported.json"), "utf8")) as Array<{
      id: string;
      type: string;
      toolName: string | null;
      parentId?: string;
      toolInput?: { query?: string } | null;
      timeWindow?: { earliest: string; latest: string } | null;
      resultCount: number | null;
    }>;

    expect(summary).toMatchObject({
      source: "mcp-jsonrpc-transcript",
      mutation: false,
      toolCalls: 1,
      toolResults: 1,
      finalAnswers: 1,
      unmatchedToolCalls: 0,
      strictImport: true,
      toolNames: ["splunk_run_query"]
    });
    expect(summary.nextCommand).toContain("grade-trace");
    expect(importedTrace).toHaveLength(3);
    expect(importedTrace[0]).toMatchObject({
      type: "tool_call",
      toolName: "splunk_run_query",
      toolInput: { query: "search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now" },
      timeWindow: { earliest: "-24h", latest: "now" }
    });
    expect(importedTrace[1]).toMatchObject({
      type: "tool_result",
      toolName: "splunk_run_query",
      parentId: importedTrace[0].id,
      timeWindow: { earliest: "-24h", latest: "now" },
      resultCount: 0
    });

    await expect(
      runCli([
        "grade-trace",
        "--trace",
        join(outDir, "trace-imported.json"),
        "--out",
        outDir,
        "--agent-name",
        "Transcript Agent",
        "--agent-version",
        "jsonrpc-001"
      ])
    ).resolves.toMatchObject({
      stdout: expect.stringContaining("PASS grade-trace")
    });

    const receipt = JSON.parse(await readFile(join(outDir, "receipt-external-001.json"), "utf8")) as {
      agent: { name: string; version: string };
      verdict: string;
      score: number;
      violations: string[];
    };

    expect(receipt.agent).toEqual({ name: "Transcript Agent", version: "jsonrpc-001" });
    expect(receipt.verdict).toBe("NOT READY");
    expect(receipt.score).toBe(0);
    expect(receipt.violations.length).toBeGreaterThan(0);

    const auditOutput = parseCliJsonOutput((await runCli(["proof-audit", "--out", outDir, "--json"])).stdout);
    const audit = JSON.parse(await readFile(join(outDir, "proof-audit.json"), "utf8")) as {
      status: string;
      proofType: string;
      checks: Array<{ id: string; status: string }>;
    };

    expect(auditOutput).toMatchObject({
      command: "proof-audit",
      status: "PASS",
      artifacts: proofAuditArtifacts(outDir)
    });
    expect(audit).toMatchObject({
      status: "FAIL",
      proofType: "external-trace"
    });
    expect(audit.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "external-receipt-loaded", status: "PASS" }),
        expect.objectContaining({ id: "external-trace-loaded", status: "PASS" }),
        expect.objectContaining({ id: "external-verdict-ready", status: "FAIL" }),
        expect.objectContaining({ id: "external-mcp-transcript-integrity", status: "PASS" })
      ])
    );
    await expect(runCli(["proof-audit", "--out", outDir, "--require-pass", "true"])).rejects.toMatchObject({
      stderr: expect.stringContaining("proof-audit strict gate failed with FAIL")
    });
  });

  it("certifies an MCP JSON-RPC transcript in one CI-oriented command", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-mcp-certify-pass-"));

    const output = parseCliJsonOutput(
      (
        await runCli([
          "certify-mcp-transcript",
          "--transcript",
          "examples/sample-mcp-transcript-pass.jsonl",
          "--out",
          outDir,
          "--strict-import",
          "true",
          "--require-pass",
          "true",
          "--agent-name",
          "External MCP Agent",
          "--agent-version",
          "jsonrpc-pass-001",
          "--json"
        ])
      ).stdout
    );
    const summary = JSON.parse(await readFile(join(outDir, "mcp-transcript-certification.json"), "utf8")) as {
      status: string;
      source: string;
      mutation: boolean;
      receipt: { verdict: string; score: number; violations: number; evidenceRefs: number };
      audit: { status: string; proofType: string; checks: Array<{ id: string; status: string }> };
      artifacts: Record<string, string>;
    };
    const importSummary = JSON.parse(await readFile(join(outDir, "mcp-transcript-import.json"), "utf8")) as {
      strictImport: boolean;
      toolCalls: number;
      toolResults: number;
      finalAnswers: number;
      toolNames: string[];
    };
    const receipt = JSON.parse(await readFile(join(outDir, "receipt-external-001.json"), "utf8")) as {
      verdict: string;
      score: number;
      violations: string[];
    };
    const importedTrace = JSON.parse(await readFile(join(outDir, "trace-imported.json"), "utf8")) as Array<{
      type: string;
      toolName: string | null;
      queryRef: string | null;
      timeWindow: { earliest: string; latest: string } | null;
    }>;

    expect(output).toMatchObject({
      command: "certify-mcp-transcript",
      status: "PASS",
      artifacts: expect.arrayContaining([
        join(outDir, "environment-contract.json"),
        join(outDir, "trace-imported.json"),
        join(outDir, "trace-external.json"),
        join(outDir, "receipt-external-001.json"),
        join(outDir, "proof-audit.json"),
        join(outDir, "mcp-transcript-certification.json")
      ])
    });
    expect(summary).toMatchObject({
      status: "PASS",
      source: "mcp-jsonrpc-transcript-certification",
      mutation: false,
      receipt: { verdict: "READY", score: 100, violations: 0, evidenceRefs: 6 },
      audit: { status: "PASS", proofType: "external-trace" }
    });
    expect(summary.audit.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "external-verdict-ready", status: "PASS" }),
        expect.objectContaining({ id: "external-mcp-transcript-integrity", status: "PASS" })
      ])
    );
    expect(importSummary).toMatchObject({
      strictImport: true,
      toolCalls: 2,
      toolResults: 2,
      finalAnswers: 1,
      toolNames: ["splunk_get_knowledge_objects", "splunk_run_saved_search"]
    });
    expect(receipt).toMatchObject({ verdict: "READY", score: 100, violations: [] });
    expect(importedTrace.find((event) => event.toolName === "splunk_run_saved_search" && event.type === "tool_result")).toMatchObject({
      queryRef: "saved-search-lateral-movement",
      timeWindow: { earliest: "-24h", latest: "now" }
    });
    expect(summary.artifacts.receipt).toBe(join(outDir, "receipt-external-001.json"));
  });

  it("keeps failed MCP transcript certification artifacts while enforcing require-pass", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-mcp-certify-fail-"));

    await expect(
      runCli([
        "certify-mcp-transcript",
        "--transcript",
        "examples/sample-mcp-transcript.jsonl",
        "--out",
        outDir,
        "--strict-import",
        "true",
        "--require-pass",
        "true",
        "--agent-name",
        "External MCP Agent",
        "--agent-version",
        "jsonrpc-fail-001"
      ])
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("certify-mcp-transcript strict gate failed with FAIL")
    });

    const summary = JSON.parse(await readFile(join(outDir, "mcp-transcript-certification.json"), "utf8")) as {
      status: string;
      receipt: { verdict: string; score: number; violations: number };
      audit: { status: string; proofType: string };
    };

    expect(summary).toMatchObject({
      status: "FAIL",
      receipt: { verdict: "NOT READY", score: 0 },
      audit: { status: "FAIL", proofType: "external-trace" }
    });
    expect(summary.receipt.violations).toBeGreaterThan(0);
    expect(await exists(join(outDir, "trace-imported.json"))).toBe(true);
    expect(await exists(join(outDir, "receipt-external-001.json"))).toBe(true);
    expect(await exists(join(outDir, "proof-audit.json"))).toBe(true);
  });

  it("builds a certification index across multiple proof directories", async () => {
    const passDir = await mkdtemp(join(tmpdir(), "splunkready-index-pass-"));
    const failDir = await mkdtemp(join(tmpdir(), "splunkready-index-fail-"));
    const indexDir = await mkdtemp(join(tmpdir(), "splunkready-index-"));

    const passOutput = parseCliJsonOutput(
      (
        await runCli([
          "certify-mcp-transcript",
          "--transcript",
          "examples/sample-mcp-transcript-pass.jsonl",
          "--out",
          passDir,
          "--strict-import",
          "true",
          "--require-pass",
          "true",
          "--agent-name",
          "External MCP Agent",
          "--agent-version",
          "jsonrpc-pass-001",
          "--json"
        ])
      ).stdout
    );

    expect(passOutput).toMatchObject({
      command: "certify-mcp-transcript",
      status: "PASS"
    });

    const failOutput = parseCliJsonOutput(
      (
        await runCli([
          "certify-mcp-transcript",
          "--transcript",
          "examples/sample-mcp-transcript.jsonl",
          "--out",
          failDir,
          "--strict-import",
          "true",
          "--agent-name",
          "External MCP Agent",
          "--agent-version",
          "jsonrpc-fail-001",
          "--json"
        ])
      ).stdout
    );

    expect(failOutput).toMatchObject({
      command: "certify-mcp-transcript",
      status: "PASS"
    });

    const output = parseCliJsonOutput(
      (
        await runCli([
          "certification-index",
          "--proof-dirs",
          `${passDir},${failDir}`,
          "--out",
          indexDir,
          "--json"
        ])
      ).stdout
    );
    const index = JSON.parse(await readFile(join(indexDir, "certification-index.json"), "utf8")) as {
      status: string;
      source: string;
      mutation: boolean;
      proofDirs: string[];
      totals: {
        proofs: number;
        ready: number;
        notReady: number;
        pass: number;
        warn: number;
        fail: number;
      };
      entries: Array<{
        label: string;
        proofDir: string;
        proofType: string;
        status: string;
        mutation: boolean | null;
        agent: { name: string; version: string };
        receipt: { id: string; verdict: string; score: number; violations: number; evidenceRefs: number } | null;
        manifest?: { aggregateSha256: string; files: number };
        href: string;
      }>;
    };
    const manifest = JSON.parse(await readFile(join(indexDir, "ui-artifacts.json"), "utf8")) as {
      source: string;
      defaultArtifact: string;
      artifacts: Array<{ label: string; path: string }>;
    };

    expect(output).toMatchObject({
      command: "certification-index",
      status: "PASS",
      artifacts: [join(indexDir, "certification-index.json"), join(indexDir, "ui-artifacts.json")]
    });
    expect(index).toMatchObject({
      status: "FAIL",
      source: "splunkready-certification-index",
      mutation: false,
      proofDirs: [passDir, failDir],
      totals: { proofs: 2, ready: 1, notReady: 1, pass: 1, warn: 0, fail: 1 }
    });
    expect(index.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "External MCP Agent",
          proofDir: passDir,
          proofType: "external-trace",
          status: "PASS",
          mutation: false,
          agent: { name: "External MCP Agent", version: "jsonrpc-pass-001" },
          receipt: expect.objectContaining({ id: "receipt-external-001", verdict: "READY", score: 100, violations: 0, evidenceRefs: 6 }),
          manifest: expect.objectContaining({ aggregateSha256: expect.stringMatching(/^[a-f0-9]{64}$/), files: expect.any(Number) }),
          href: `?artifacts=${encodeURIComponent(passDir)}#receipt`
        }),
        expect.objectContaining({
          label: "External MCP Agent",
          proofDir: failDir,
          proofType: "external-trace",
          status: "FAIL",
          mutation: false,
          agent: { name: "External MCP Agent", version: "jsonrpc-fail-001" },
          receipt: expect.objectContaining({ id: "receipt-external-001", verdict: "NOT READY", score: 0 }),
          manifest: expect.objectContaining({ aggregateSha256: expect.stringMatching(/^[a-f0-9]{64}$/), files: expect.any(Number) }),
          href: `?artifacts=${encodeURIComponent(failDir)}#receipt`
        })
      ])
    );
    expect(manifest).toMatchObject({
      source: "splunkready-ui-artifacts",
      defaultArtifact: indexDir,
      artifacts: [
        { label: "Certification index", path: indexDir },
        { label: "External MCP Agent - jsonrpc-pass-001 / PASS", path: passDir },
        { label: "External MCP Agent - jsonrpc-fail-001 / FAIL", path: failDir }
      ]
    });

    const strictFailDir = await mkdtemp(join(tmpdir(), "splunkready-index-strict-fail-"));
    const strictFailure = await runCli([
      "certification-index",
      "--proof-dirs",
      `${passDir},${failDir}`,
      "--out",
      strictFailDir,
      "--require-pass",
      "true",
      "--json"
    ]).then(
      () => {
        throw new Error("Expected certification-index strict gate to fail.");
      },
      (error: { stderr: string }) => parseCliJsonOutput(error.stderr)
    );
    const strictFailIndex = JSON.parse(await readFile(join(strictFailDir, "certification-index.json"), "utf8")) as {
      status: string;
      totals: { proofs: number; ready: number; notReady: number };
    };
    const strictFailManifest = JSON.parse(await readFile(join(strictFailDir, "ui-artifacts.json"), "utf8")) as {
      source: string;
      artifacts: Array<{ label: string; path: string }>;
    };

    expect(strictFailure).toMatchObject({
      command: "certification-index",
      status: "FAIL",
      artifacts: [],
      error: expect.stringContaining("certification-index strict gate failed with FAIL")
    });
    expect(strictFailIndex).toMatchObject({
      status: "FAIL",
      totals: { proofs: 2, ready: 1, notReady: 1 }
    });
    expect(strictFailManifest).toMatchObject({
      source: "splunkready-ui-artifacts",
      artifacts: expect.arrayContaining([{ label: "Certification index", path: strictFailDir }])
    });

    const strictPassDir = await mkdtemp(join(tmpdir(), "splunkready-index-strict-pass-"));
    const strictPassOutput = parseCliJsonOutput(
      (
        await runCli([
          "certification-index",
          "--proof-dirs",
          passDir,
          "--out",
          strictPassDir,
          "--require-pass",
          "true",
          "--json"
        ])
      ).stdout
    );

    expect(strictPassOutput).toMatchObject({
      command: "certification-index",
      status: "PASS",
      artifacts: [join(strictPassDir, "certification-index.json"), join(strictPassDir, "ui-artifacts.json")]
    });
  });

  it("requires proof directories for certification index generation", async () => {
    const indexDir = await mkdtemp(join(tmpdir(), "splunkready-index-missing-"));

    await expect(runCli(["certification-index", "--out", indexDir])).rejects.toMatchObject({
      stderr: expect.stringContaining("certification-index requires --proof-dirs <dir[,dir]>")
    });
  });

  it("strict-audits a READY external trace proof", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-external-ready-audit-"));

    await expect(runCli(["compile", "--out", outDir])).resolves.toMatchObject({
      stdout: expect.stringContaining("PASS compile")
    });
    await expect(
      runCli([
        "grade-trace",
        "--trace",
        "examples/sample-external-trace-pass.json",
        "--out",
        outDir,
        "--agent-name",
        "External MCP Agent",
        "--agent-version",
        "example-trace-pass-001"
      ])
    ).resolves.toMatchObject({
      stdout: expect.stringContaining("PASS grade-trace")
    });

    const auditOutput = parseCliJsonOutput(
      (await runCli(["proof-audit", "--out", outDir, "--require-pass", "true", "--json"])).stdout
    );
    const audit = JSON.parse(await readFile(join(outDir, "proof-audit.json"), "utf8")) as {
      status: string;
      proofType: string;
      checks: Array<{ id: string; status: string }>;
    };

    expect(auditOutput).toMatchObject({
      command: "proof-audit",
      status: "PASS",
      artifacts: proofAuditArtifacts(outDir)
    });
    expect(audit).toMatchObject({
      status: "PASS",
      proofType: "external-trace"
    });
    expect(audit.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "external-receipt-loaded", status: "PASS" }),
        expect.objectContaining({ id: "external-trace-loaded", status: "PASS" }),
        expect.objectContaining({ id: "external-violations-loaded", status: "PASS" }),
        expect.objectContaining({ id: "external-receipt-trace-refs", status: "PASS" }),
        expect.objectContaining({ id: "external-verdict-ready", status: "PASS" })
      ])
    );

    expect(parseCliJsonOutput((await runCli(["verify-manifest", "--out", outDir, "--json"])).stdout)).toMatchObject({
      command: "verify-manifest",
      status: "PASS",
      artifacts: [join(outDir, "proof-manifest-verification.json")]
    });

    await writeFile(join(outDir, "receipt-external-001.md"), "# tampered receipt\n", "utf8");
    const manifestFailure = await runCli(["verify-manifest", "--out", outDir, "--json"]).then(
      () => {
        throw new Error("Expected verify-manifest to fail after tampering with receipt-external-001.md.");
      },
      (error: { stderr: string }) => parseCliJsonOutput(error.stderr)
    );
    const manifestFailureReport = JSON.parse(await readFile(join(outDir, "proof-manifest-verification.json"), "utf8")) as {
      status: string;
      changedFiles: Array<{ path: string }>;
    };

    expect(manifestFailure).toMatchObject({
      command: "verify-manifest",
      status: "FAIL",
      error: expect.stringContaining("verify-manifest failed with FAIL")
    });
    expect(manifestFailureReport).toMatchObject({
      status: "FAIL",
      changedFiles: [expect.objectContaining({ path: "receipt-external-001.md" })]
    });
  });

  it("rejects incomplete MCP transcripts in strict import mode", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-mcp-transcript-strict-"));
    const transcriptPath = join(outDir, "incomplete-transcript.jsonl");

    await writeFile(
      transcriptPath,
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: "mcp-missing-response",
        method: "tools/call",
        params: {
          name: "splunk_run_query",
          arguments: {
            query: "search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now"
          }
        },
        timestamp: "2026-06-01T06:00:10.000Z"
      })}\n`,
      "utf8"
    );

    await expect(
      runCli(["import-mcp-transcript", "--transcript", transcriptPath, "--out", outDir, "--strict-import", "true"])
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("Strict MCP transcript import failed")
    });

    expect(await exists(join(outDir, "trace-imported.json"))).toBe(false);
    expect(await exists(join(outDir, "mcp-transcript-import.json"))).toBe(false);
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

  it("generates hosted-model proof without executing the SPL query", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-hosted-model-proof-"));
    const mcp = await startMockMcpServer();
    const env = {
      SPLUNKREADY_LIVE_ENABLED: "true",
      SPLUNKREADY_SPLUNK_MCP_URL: mcp.url,
      SPLUNKREADY_SPLUNK_MCP_TOKEN: "test-token"
    };

    try {
      const output = parseCliJsonOutput(
        (await runCli(["hosted-model-proof", "--mode", "live", "--out", outDir, "--json"], process.cwd(), env)).stdout
      );

      expect(output).toMatchObject({
        command: "hosted-model-proof",
        status: "PASS",
        artifacts: expect.arrayContaining([join(outDir, "environment-contract.json"), join(outDir, "hosted-model-proof.json")])
      });
    } finally {
      await mcp.close();
    }

    const proof = JSON.parse(await readFile(join(outDir, "hosted-model-proof.json"), "utf8")) as {
      status: string;
      mode: string;
      mutation: boolean;
      query: string;
      deterministicContext: { ruleIds: string[]; passFailAuthority: string };
      assistance: { explanation: string; optimizedQuery: string; rationale: string };
      toolCalls: string[];
    };

    expect(proof).toMatchObject({
      status: "PASS",
      mode: "live",
      mutation: false,
      query: "search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now",
      deterministicContext: {
        ruleIds: ["SPL-001", "SPL-003"],
        passFailAuthority: "deterministic-rule-engine"
      },
      assistance: {
        explanation: "The SPL uses a broad index wildcard and a non-contract field.",
        optimizedQuery: "| savedsearch \"ES - Lateral Movement Auth Chain\"",
        rationale: "Prefer the validated saved search from the live contract."
      },
      toolCalls: ["saia_explain_spl", "saia_optimize_spl"]
    });
    expect(mcp.calls.map((call) => call.params.name)).toEqual(
      expect.arrayContaining(["saia_explain_spl", "saia_optimize_spl"])
    );
    expect(mcp.calls.map((call) => call.params.name)).not.toEqual(expect.arrayContaining(["splunk_run_query"]));
  });

  it("runs a focused hosted-model diagnostic for SAIA permission checks", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-hosted-model-diagnostic-"));
    const mcp = await startMockMcpServer();
    const env = {
      SPLUNKREADY_LIVE_ENABLED: "true",
      SPLUNKREADY_SPLUNK_MCP_URL: mcp.url,
      SPLUNKREADY_SPLUNK_MCP_TOKEN: "test-token"
    };

    try {
      const output = parseCliJsonOutput(
        (await runCli(["hosted-model-diagnostic", "--mode", "live", "--out", outDir, "--json"], process.cwd(), env))
          .stdout
      );

      expect(output).toMatchObject({
        command: "hosted-model-diagnostic",
        status: "PASS",
        artifacts: expect.arrayContaining([
          join(outDir, "environment-contract.json"),
          join(outDir, "hosted-model-proof.json"),
          join(outDir, "hosted-model-diagnostic.json")
        ])
      });
    } finally {
      await mcp.close();
    }

    const diagnostic = JSON.parse(await readFile(join(outDir, "hosted-model-diagnostic.json"), "utf8")) as {
      status: string;
      mode: string;
      mutation: boolean;
      permission: { status: string; message: string };
      requiredTools: string[];
      availableTools: string[];
    };

    expect(diagnostic).toMatchObject({
      status: "PASS",
      mode: "live",
      mutation: false,
      permission: {
        status: "OK",
        message:
          "The current MCP credentials can invoke saia_explain_spl and saia_optimize_spl for advisory SPL remediation."
      },
      requiredTools: ["saia_explain_spl", "saia_optimize_spl"],
      availableTools: ["saia_explain_spl", "saia_optimize_spl"]
    });
    expect(mcp.calls.map((call) => call.params.name)).toEqual(
      expect.arrayContaining(["saia_explain_spl", "saia_optimize_spl"])
    );
    expect(mcp.calls.map((call) => call.params.name)).not.toEqual(expect.arrayContaining(["splunk_run_query"]));
  });

  it("writes a blocked hosted-model diagnostic and can strict-gate SAIA access", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-hosted-model-diagnostic-blocked-"));
    const mcp = await startMockMcpServer({ blockHostedModels: true });
    const env = {
      SPLUNKREADY_LIVE_ENABLED: "true",
      SPLUNKREADY_SPLUNK_MCP_URL: mcp.url,
      SPLUNKREADY_SPLUNK_MCP_TOKEN: "test-token"
    };

    try {
      const output = parseCliJsonOutput(
        (await runCli(["hosted-model-diagnostic", "--mode", "live", "--out", outDir, "--json"], process.cwd(), env))
          .stdout
      );

      expect(output).toMatchObject({
        command: "hosted-model-diagnostic",
        status: "PASS",
        artifacts: expect.arrayContaining([join(outDir, "hosted-model-diagnostic.json")])
      });
      await expect(
        runCli(
          ["hosted-model-diagnostic", "--mode", "live", "--out", outDir, "--require-pass", "true"],
          process.cwd(),
          env
        )
      ).rejects.toMatchObject({
        stderr: expect.stringContaining("hosted-model-diagnostic requires SAIA access")
      });

      const jsonFailure = await runCli(
        ["hosted-model-diagnostic", "--mode", "live", "--out", outDir, "--require-pass", "true", "--json"],
        process.cwd(),
        env
      ).then(
        () => {
          throw new Error("Expected hosted-model-diagnostic strict JSON gate to fail.");
        },
        (error: unknown) => error as { stderr: string }
      );
      const failure = parseCliJsonOutput(jsonFailure.stderr);

      expect(failure).toMatchObject({
        command: "hosted-model-diagnostic",
        status: "FAIL",
        artifacts: [],
        error: expect.stringContaining("hosted-model-diagnostic requires SAIA access")
      });
    } finally {
      await mcp.close();
    }

    const diagnostic = JSON.parse(await readFile(join(outDir, "hosted-model-diagnostic.json"), "utf8")) as {
      status: string;
      mutation: boolean;
      permission: { status: string; error: string; requiredActions: string[] };
    };
    const proof = JSON.parse(await readFile(join(outDir, "hosted-model-proof.json"), "utf8")) as {
      status: string;
      assistance: null;
    };

    expect(proof).toMatchObject({ status: "BLOCKED", assistance: null });
    expect(diagnostic).toMatchObject({
      status: "BLOCKED",
      mutation: false,
      permission: {
        status: "BLOCKED",
        error:
          "Hosted-model SAIA action forbidden. The current MCP token or Splunk user can access live read-only Splunk tools, but not saia_explain_spl/saia_optimize_spl."
      }
    });
    expect(diagnostic.permission.requiredActions).toEqual(
      expect.arrayContaining([
        "Grant the Splunk/MCP user permission to invoke saia_explain_spl.",
        "Grant the Splunk/MCP user permission to invoke saia_optimize_spl."
      ])
    );
    expect(mcp.calls.map((call) => call.params.name)).not.toEqual(expect.arrayContaining(["splunk_run_query"]));
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
    const mismatchTracePath = join(outDir, "wrong-mission-trace.json");
    const rawTrace = await readFile("fixtures/acme-soc-dev/traces/naive-failure.json", "utf8");
    const trace = JSON.parse(rawTrace) as Array<Record<string, unknown>>;
    const mismatchTrace = trace.map((event) => ({ ...event, missionId: "mission-wrong-for-test" }));

    await expect(runCli(["compile", "--out", outDir])).resolves.toMatchObject({
      stdout: expect.stringContaining("PASS compile")
    });
    await writeFile(mismatchTracePath, JSON.stringify(mismatchTrace, null, 2));
    await expect(
      runCli(["grade-trace", "--trace", mismatchTracePath, "--out", outDir])
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

    const blockReport = JSON.parse(await readFile(join(outDir, "firewall-block-before.json"), "utf8")) as {
      status: string;
      code: string;
      phase: string;
      mutation: boolean;
      blockedBeforeSplunk: boolean;
      toolName: string;
      query: string;
      violations: Array<{ ruleId: string }>;
    };

    expect(blockReport).toMatchObject({
      status: "BLOCKED",
      code: "FIREWALL_POLICY_BLOCKED",
      phase: "before",
      mutation: false,
      blockedBeforeSplunk: true,
      toolName: "splunk_run_query"
    });
    expect(blockReport.query).toContain("index=*");
    expect(blockReport.violations.map((violation) => violation.ruleId)).toEqual(
      expect.arrayContaining(["SPL-001", "SPL-003"])
    );

    const proofAuditOutput = parseCliJsonOutput(
      (await runCli(["proof-audit", "--out", outDir, "--require-pass", "true", "--json"])).stdout
    );

    const proofAudit = JSON.parse(await readFile(join(outDir, "proof-audit.json"), "utf8")) as {
      status: string;
      proofType: string;
      mutation: boolean;
      checks: Array<{ id: string; status: string }>;
    };

    expect(proofAuditOutput).toMatchObject({
      command: "proof-audit",
      status: "PASS",
      artifacts: proofAuditArtifacts(outDir)
    });
    expect(proofAudit).toMatchObject({
      status: "PASS",
      proofType: "firewall-block",
      mutation: false
    });
    expect(proofAudit.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "firewall-block-loaded", status: "PASS" }),
        expect.objectContaining({ id: "firewall-block-before-splunk", status: "PASS" }),
        expect.objectContaining({ id: "firewall-block-query", status: "PASS" })
      ])
    );
  });

  it("runs firewall-check as a passing CI-friendly pre-execution gate", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-cli-firewall-check-"));

    const output = parseCliJsonOutput((await runCli(["firewall-check", "--out", outDir, "--json"])).stdout);

    expect(output).toMatchObject({
      command: "firewall-check",
      status: "PASS",
      artifacts: [
        join(outDir, "environment-contract.json"),
        join(outDir, "missions.json"),
        join(outDir, "agent-policy.json"),
        join(outDir, "readiness-profile.json"),
        join(outDir, "firewall-block-before.json"),
        join(outDir, "proof-audit.json"),
        join(outDir, "proof-manifest.json")
      ]
    });
    expect(await exists(join(outDir, "trace-before.json"))).toBe(false);

    const blockReport = JSON.parse(await readFile(join(outDir, "firewall-block-before.json"), "utf8")) as {
      status: string;
      code: string;
      blockedBeforeSplunk: boolean;
      mutation: boolean;
      violations: Array<{ ruleId: string }>;
    };
    const proofAudit = JSON.parse(await readFile(join(outDir, "proof-audit.json"), "utf8")) as {
      status: string;
      proofType: string;
      checks: Array<{ id: string; status: string }>;
    };

    expect(blockReport).toMatchObject({
      status: "BLOCKED",
      code: "FIREWALL_POLICY_BLOCKED",
      blockedBeforeSplunk: true,
      mutation: false
    });
    expect(blockReport.violations.map((violation) => violation.ruleId)).toEqual(
      expect.arrayContaining(["SPL-001", "SPL-003"])
    );
    expect(proofAudit).toMatchObject({
      status: "PASS",
      proofType: "firewall-block"
    });
    expect(proofAudit.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "firewall-block-loaded", status: "PASS" }),
        expect.objectContaining({ id: "firewall-block-before-splunk", status: "PASS" }),
        expect.objectContaining({ id: "firewall-block-query", status: "PASS" })
      ])
    );
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
      derivedMission: { strategy: string; missionId?: string; artifacts: string[] };
    };
    const derivedMission = JSON.parse(await readFile(join(outDir, "live-derived-mission.json"), "utf8")) as {
      id: string;
      preferredSavedSearchRefs?: string[];
      expectedTools: string[];
      checks: string[];
    };
    const derivedProfile = JSON.parse(await readFile(join(outDir, "live-derived-readiness-profile.json"), "utf8")) as {
      contractRef: { mode: string };
      sourceRefs: string[];
      deploymentSignals: { savedSearchCount: number };
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
    expect(report.derivedMission).toMatchObject({
      strategy: "saved-search-with-evidence",
      missionId: "mission-live-saved-search-readiness",
      artifacts: [
        join(outDir, "live-derived-mission.json"),
        join(outDir, "live-derived-readiness-profile.json")
      ]
    });
    expect(derivedMission).toMatchObject({
      id: "mission-live-saved-search-readiness",
      expectedTools: ["splunk_get_knowledge_objects", "splunk_run_saved_search"],
      preferredSavedSearchRefs: ["SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain"]
    });
    expect(derivedMission.checks).toEqual(expect.arrayContaining(["KO-001", "KO-002", "EVD-001", "SAF-003"]));
    expect(derivedProfile).toMatchObject({
      contractRef: { mode: "live" },
      deploymentSignals: { savedSearchCount: 1 }
    });
    expect(derivedProfile.sourceRefs).toEqual(
      expect.arrayContaining(["mission:mission-live-saved-search-readiness"])
    );
    expect(server.calls.map((call) => call.params.name)).toContain("splunk_run_saved_search");
  });

  it("reports flagship live security readiness when the exact saved search returns evidence", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-live-security-ready-"));
    const server = await startMockMcpServer();
    const env = {
      SPLUNKREADY_LIVE_ENABLED: "true",
      SPLUNKREADY_SPLUNK_MCP_URL: server.url,
      SPLUNKREADY_SPLUNK_MCP_TOKEN: "test-token",
      SPLUNKREADY_SPLUNK_APP: "search"
    };

    try {
      const output = parseCliJsonOutput(
        (await runCli(["live-security-check", "--out", outDir, "--json"], process.cwd(), env)).stdout
      );

      expect(output).toMatchObject({
        command: "live-security-check",
        status: "PASS",
        artifacts: expect.arrayContaining([
          join(outDir, "environment-contract.json"),
          join(outDir, "live-security-readiness.json")
        ])
      });
    } finally {
      await server.close();
    }

    const report = JSON.parse(await readFile(join(outDir, "live-security-readiness.json"), "utf8")) as {
      status: string;
      mutation: boolean;
      requiredTools: { missing: string[] };
      requiredSavedSearch: {
        present: boolean;
        run: { attempted: boolean; resultCount: number; evidenceRefs: string[] };
      };
      nextActions: string[];
    };

    expect(report).toMatchObject({
      status: "READY_FOR_FLAGSHIP_LIVE_SECURITY_PROOF",
      mutation: false,
      requiredTools: { missing: [] },
      requiredSavedSearch: {
        present: true,
        run: {
          attempted: true,
          resultCount: 3,
          evidenceRefs: ["live-evt-102", "live-evt-118", "live-evt-141"]
        }
      }
    });
    expect(report.nextActions).toEqual(
      expect.arrayContaining([
        "Run live-proof with LLM mode enabled; the deployment has the saved-search evidence needed for the flagship live security path."
      ])
    );
    expect(server.calls.map((call) => call.params.name)).toContain("splunk_run_saved_search");
  });

  it("reports exact live security blockers without inventing a flagship pass", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-live-security-blocked-"));
    const server = await startMockMcpServer({
      savedSearches: [
        {
          id: "saved-search-errors",
          type: "saved_searches",
          name: "Errors in the last 24 hours",
          app: "search"
        }
      ],
      savedSearchRows: []
    });
    const env = {
      SPLUNKREADY_LIVE_ENABLED: "true",
      SPLUNKREADY_SPLUNK_MCP_URL: server.url,
      SPLUNKREADY_SPLUNK_MCP_TOKEN: "test-token",
      SPLUNKREADY_SPLUNK_APP: "search"
    };

    try {
      const output = parseCliJsonOutput(
        (await runCli(["live-security-check", "--out", outDir, "--json"], process.cwd(), env)).stdout
      );

      expect(output).toMatchObject({
        command: "live-security-check",
        status: "PASS",
        artifacts: expect.arrayContaining([
          join(outDir, "environment-contract.json"),
          join(outDir, "live-security-readiness.json")
        ])
      });
    } finally {
      await server.close();
    }

    const report = JSON.parse(await readFile(join(outDir, "live-security-readiness.json"), "utf8")) as {
      status: string;
      requiredSavedSearch: {
        present: boolean;
        nearbySavedSearches: string[];
        run: { attempted: boolean; reason: string };
      };
      blockers: string[];
    };

    expect(report).toMatchObject({
      status: "BLOCKED",
      requiredSavedSearch: {
        present: false,
        nearbySavedSearches: ["search::Errors in the last 24 hours"],
        run: {
          attempted: false,
          reason: "Exact flagship saved search is not present in the live contract."
        }
      }
    });
    expect(report.blockers).toEqual(
      expect.arrayContaining([
        "Install or create read-only saved search SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain for the lateral-movement mission."
      ])
    );
    expect(server.calls.map((call) => call.params.name)).not.toContain("splunk_run_saved_search");
  });

  it("generates an operator-owned live security setup kit without live credentials", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-live-security-kit-"));
    const output = parseCliJsonOutput(
      (await runCli(["live-security-kit", "--out", outDir, "--json"], process.cwd(), {
        SPLUNKREADY_LIVE_ENABLED: "",
        SPLUNKREADY_SPLUNK_MCP_URL: "",
        SPLUNKREADY_SPLUNK_MCP_TOKEN: ""
      })).stdout
    );

    expect(output).toMatchObject({
      command: "live-security-kit",
      status: "PASS",
      artifacts: expect.arrayContaining([
        join(outDir, "live-security-kit.json"),
        join(outDir, "SplunkEnterpriseSecuritySuite", "default", "savedsearches.conf"),
        join(outDir, "lateral-movement-events.csv"),
        join(outDir, "README.md")
      ])
    });

    const manifest = JSON.parse(await readFile(join(outDir, "live-security-kit.json"), "utf8")) as {
      mutation: boolean;
      operatorActionRequired: boolean;
      savedSearch: { ref: string };
      preferredIndex: string;
      sampleEvents: number;
      generatedAt: string;
    };
    const savedSearches = await readFile(
      join(outDir, "SplunkEnterpriseSecuritySuite", "default", "savedsearches.conf"),
      "utf8"
    );
    const indexes = await readFile(join(outDir, "SplunkEnterpriseSecuritySuite", "default", "indexes.conf"), "utf8");
    const sampleEvents = await readFile(join(outDir, "lateral-movement-events.csv"), "utf8");
    const readme = await readFile(join(outDir, "README.md"), "utf8");
    const eventTimes = sampleEvents
      .trim()
      .split("\n")
      .slice(1)
      .map((line) => new Date(line.split(",", 1)[0]?.replace(" ", "T") ?? ""));

    expect(manifest).toMatchObject({
      mutation: false,
      operatorActionRequired: true,
      savedSearch: { ref: "SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain" },
      preferredIndex: "wineventlog",
      sampleEvents: 3
    });
    expect(Date.now() - new Date(manifest.generatedAt).getTime()).toBeLessThan(24 * 60 * 60 * 1000);
    expect(savedSearches).toContain("[ES - Lateral Movement Auth Chain]");
    expect(savedSearches).toContain("index=wineventlog");
    expect(savedSearches).toContain("rex field=_raw");
    expect(savedSearches).toContain("eval sourcetype=coalesce(sourcetype, csv_sourcetype)");
    expect(savedSearches).toContain("dedup eventRef");
    expect(savedSearches).toContain("dispatch.earliest_time = -24h");
    expect(savedSearches).not.toContain("index=wineventlog earliest=-24h");
    expect(savedSearches).not.toContain("is_scheduled");
    expect(indexes).toContain("[wineventlog]");
    expect(sampleEvents).toContain("live-evt-102");
    expect(sampleEvents).not.toContain("2026-06-02 10:");
    expect(eventTimes).toHaveLength(3);
    for (const eventTime of eventTimes) {
      const ageMs = Date.now() - eventTime.getTime();

      expect(Number.isNaN(eventTime.getTime())).toBe(false);
      expect(ageMs).toBeGreaterThanOrEqual(0);
      expect(ageMs).toBeLessThan(24 * 60 * 60 * 1000);
    }
    expect(readme).toContain("SplunkReady generated these files locally; it did not connect to or mutate Splunk.");
    expect(readme).toContain("generated `SplunkEnterpriseSecuritySuite` app directory provides the app context");
    expect(readme).toContain("CSV timestamps are generated at kit creation time");
    expect(readme).toContain("live-security-check --out artifacts/live-security-check --json");
    expect(readme).toContain("live-security-proof --out artifacts/live-security-proof --json");
  });

  it("bundles proof, live security readiness, and operator kit artifacts for the Vite UI", async () => {
    const proofDir = await mkdtemp(join(tmpdir(), "splunkready-ui-proof-"));
    const securityCheckDir = await mkdtemp(join(tmpdir(), "splunkready-ui-security-check-"));
    const securityKitDir = await mkdtemp(join(tmpdir(), "splunkready-ui-security-kit-"));
    const hostedModelProofDir = await mkdtemp(join(tmpdir(), "splunkready-ui-hosted-model-proof-"));
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-ui-bundle-"));
    const server = await startMockMcpServer({
      savedSearches: [
        {
          id: "saved-search-errors",
          type: "saved_searches",
          name: "Errors in the last 24 hours",
          app: "search"
        }
      ],
      savedSearchRows: []
    });
    const env = {
      SPLUNKREADY_LIVE_ENABLED: "true",
      SPLUNKREADY_SPLUNK_MCP_URL: server.url,
      SPLUNKREADY_SPLUNK_MCP_TOKEN: "test-token",
      SPLUNKREADY_SPLUNK_APP: "search"
    };

    try {
      await expect(runCli(["compile", "--out", proofDir])).resolves.toMatchObject({
        stdout: expect.stringContaining("PASS compile")
      });
      await expect(runCli(["evaluate", "--out", proofDir])).resolves.toMatchObject({
        stdout: expect.stringContaining("PASS evaluate")
      });
      await expect(runCli(["receipt", "--out", proofDir])).resolves.toMatchObject({
        stdout: expect.stringContaining("PASS receipt")
      });
      await expect(runCli(["rerun", "--out", proofDir])).resolves.toMatchObject({
        stdout: expect.stringContaining("PASS rerun")
      });
      await expect(runCli(["live-security-check", "--out", securityCheckDir], process.cwd(), env)).resolves.toMatchObject({
        stdout: expect.stringContaining("PASS live-security-check")
      });
      await expect(runCli(["live-security-kit", "--out", securityKitDir])).resolves.toMatchObject({
        stdout: expect.stringContaining("PASS live-security-kit")
      });
      await expect(
        runCli(["hosted-model-proof", "--mode", "live", "--out", hostedModelProofDir], process.cwd(), env)
      ).resolves.toMatchObject({
        stdout: expect.stringContaining("PASS hosted-model-proof")
      });

      const output = parseCliJsonOutput(
        (
          await runCli([
            "live-security-ui-bundle",
            "--proof-dir",
            proofDir,
            "--security-check-dir",
            securityCheckDir,
            "--security-kit-dir",
            securityKitDir,
            "--hosted-model-proof-dir",
            hostedModelProofDir,
            "--out",
            outDir,
            "--json"
          ])
        ).stdout
      );

      expect(output).toMatchObject({
        command: "live-security-ui-bundle",
        status: "PASS",
        artifacts: expect.arrayContaining([
          join(outDir, "environment-contract.json"),
          join(outDir, "receipt-before-001.json"),
          join(outDir, "receipt-after-001.json"),
          join(outDir, "trace-before.json"),
          join(outDir, "trace-after.json"),
          join(outDir, "live-security-readiness.json"),
          join(outDir, "live-security-kit.json"),
          join(outDir, "hosted-model-proof.json"),
          join(outDir, "live-security-ui-bundle.json")
        ])
      });
    } finally {
      await server.close();
    }

    const bundledReceipt = JSON.parse(await readFile(join(outDir, "receipt-after-001.json"), "utf8")) as {
      verdict: string;
      score: number;
    };
    const readiness = JSON.parse(await readFile(join(outDir, "live-security-readiness.json"), "utf8")) as {
      status: string;
      mutation: boolean;
    };
    const kit = JSON.parse(await readFile(join(outDir, "live-security-kit.json"), "utf8")) as {
      mutation: boolean;
      operatorActionRequired: boolean;
    };
    const summary = JSON.parse(await readFile(join(outDir, "live-security-ui-bundle.json"), "utf8")) as {
      status: string;
      mutation: boolean;
      proofDir: string;
      securityCheckDir: string;
      securityKitDir: string;
      hostedModelProofDir: string;
      artifacts: string[];
    };
    const hostedModelProof = JSON.parse(await readFile(join(outDir, "hosted-model-proof.json"), "utf8")) as {
      status: string;
      mutation: boolean;
    };

    expect(bundledReceipt).toMatchObject({ verdict: "READY", score: 100 });
    expect(readiness).toMatchObject({ status: "BLOCKED", mutation: false });
    expect(kit).toMatchObject({ mutation: false, operatorActionRequired: true });
    expect(hostedModelProof).toMatchObject({ status: "PASS", mutation: false });
    expect(summary).toMatchObject({
      status: "PASS",
      mutation: false,
      proofDir,
      securityCheckDir,
      securityKitDir,
      hostedModelProofDir
    });
    expect(summary.artifacts).toEqual(
      expect.arrayContaining([join(outDir, "receipt-after-001.json"), join(outDir, "hosted-model-proof.json")])
    );
  });

  it("runs the flagship live security proof only when the exact live readiness check is green", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-live-security-proof-"));
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
      const output = parseCliJsonOutput(
        (await runCli(["live-security-proof", "--out", outDir, "--json"], process.cwd(), env)).stdout
      );

      expect(output).toMatchObject({
        command: "live-security-proof",
        status: "PASS",
        artifacts: expect.arrayContaining([
          join(outDir, "live-security-readiness.json"),
          join(outDir, "environment-contract.json"),
          join(outDir, "receipt-before-001.json"),
          join(outDir, "policy-patch.json"),
          join(outDir, "receipt-after-001.json"),
          join(outDir, "hosted-model-proof.json"),
          join(outDir, "live-proof-summary.json"),
          join(outDir, "live-security-proof-summary.json")
        ])
      });
    } finally {
      await gemini.close();
      await mcp.close();
    }

    const readiness = JSON.parse(await readFile(join(outDir, "live-security-readiness.json"), "utf8")) as {
      status: string;
      requiredSavedSearch: { run: { resultCount: number; evidenceRefs: string[] } };
    };
    const beforeReceipt = JSON.parse(await readFile(join(outDir, "receipt-before-001.json"), "utf8")) as {
      verdict: string;
      violations: string[];
    };
    const afterReceipt = JSON.parse(await readFile(join(outDir, "receipt-after-001.json"), "utf8")) as {
      verdict: string;
      score: number;
      evidenceRefs: string[];
    };
    const summary = JSON.parse(await readFile(join(outDir, "live-security-proof-summary.json"), "utf8")) as {
      mutation: boolean;
      readinessStatus: string;
      failToPass: boolean;
      readyAfterPatch: boolean;
      proofLoop: string;
      before: { verdict: string; violations: number };
      after: { verdict: string; score: number; evidenceRefs: string[] };
      hostedModels: {
        status: string;
        assistanceItems: number;
        availableTools: string[];
        missingTools: string[];
      };
    };
    const hostedModelProof = JSON.parse(await readFile(join(outDir, "hosted-model-proof.json"), "utf8")) as {
      status: string;
      mutation: boolean;
      assistance: { optimizedQuery: string } | null;
    };
    const uiSummary = JSON.parse(await readFile(join(outDir, "live-proof-summary.json"), "utf8")) as {
      mutation: boolean;
      derivedMission: { strategy: string; missionId: string };
      failToPass: boolean;
      readyWithoutPatch: boolean;
      proofLoop: string;
      hostedModels: {
        status: string;
        assistanceItems: number;
        availableTools: string[];
        missingTools: string[];
      };
    };

    expect(readiness).toMatchObject({
      status: "READY_FOR_FLAGSHIP_LIVE_SECURITY_PROOF",
      requiredSavedSearch: {
        run: {
          resultCount: 3,
          evidenceRefs: ["live-evt-102", "live-evt-118", "live-evt-141"]
        }
      }
    });
    expect(beforeReceipt.verdict).toBe("NOT READY");
    expect(beforeReceipt.violations.length).toBeGreaterThan(0);
    expect(afterReceipt).toMatchObject({ verdict: "READY", score: 100 });
    expect(hostedModelProof).toMatchObject({
      status: "PASS",
      mutation: false,
      assistance: {
        optimizedQuery: "| savedsearch \"ES - Lateral Movement Auth Chain\""
      }
    });
    expect(afterReceipt.evidenceRefs).toEqual([
      "saved_searches:SplunkEnterpriseSecuritySuite:ES - Lateral Movement Auth Chain",
      "live-evt-102",
      "live-evt-118",
      "live-evt-141"
    ]);
    expect(summary).toMatchObject({
      mutation: false,
      readinessStatus: "READY_FOR_FLAGSHIP_LIVE_SECURITY_PROOF",
      failToPass: true,
      readyAfterPatch: true,
      proofLoop: "fail-to-pass",
      before: { verdict: "NOT READY", violations: beforeReceipt.violations.length },
      after: {
        verdict: "READY",
        score: 100,
        evidenceRefs: [
          "saved_searches:SplunkEnterpriseSecuritySuite:ES - Lateral Movement Auth Chain",
          "live-evt-102",
          "live-evt-118",
          "live-evt-141"
        ]
      },
      hostedModels: {
        status: "invoked",
        assistanceItems: 3,
        availableTools: ["saia_explain_spl", "saia_optimize_spl"],
        missingTools: []
      }
    });
    expect(uiSummary).toMatchObject({
      mutation: false,
      derivedMission: {
        strategy: "saved-search-with-evidence",
        missionId: "mission-security-lateral-movement-readiness"
      },
      failToPass: true,
      readyWithoutPatch: false,
      proofLoop: "fail-to-pass",
      hostedModels: {
        status: "invoked",
        assistanceItems: 3,
        availableTools: ["saia_explain_spl", "saia_optimize_spl"],
        missingTools: []
      }
    });
    expect(mcp.calls.map((call) => call.params.name)).toEqual(
      expect.arrayContaining(["splunk_run_saved_search", "saia_explain_spl", "saia_optimize_spl"])
    );

    const auditOutput = parseCliJsonOutput((await runCli(["proof-audit", "--out", outDir, "--json"])).stdout);
    const audit = JSON.parse(await readFile(join(outDir, "proof-audit.json"), "utf8")) as {
      status: string;
      proofType: string;
      mode: string;
      mutation: boolean;
      failToPass: boolean;
      readyAfterPatch: boolean;
      proofLoop: string;
      hostedModelStatus: string;
      checks: Array<{ id: string; status: string }>;
    };

    expect(auditOutput).toMatchObject({
      command: "proof-audit",
      status: "PASS",
      artifacts: proofAuditArtifacts(outDir)
    });
    expect(audit).toMatchObject({
      status: "PASS",
      proofType: "live-security",
      mode: "live",
      mutation: false,
      failToPass: true,
      readyAfterPatch: true,
      proofLoop: "fail-to-pass",
      hostedModelStatus: "invoked"
    });
    expect(audit.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "contract-loaded", status: "PASS" }),
        expect.objectContaining({ id: "receipt-before-loaded", status: "PASS" }),
        expect.objectContaining({ id: "receipt-after-loaded", status: "PASS" }),
        expect.objectContaining({ id: "fail-to-pass", status: "PASS" }),
        expect.objectContaining({ id: "mutation-false", status: "PASS" }),
        expect.objectContaining({ id: "live-security-summary", status: "PASS" }),
        expect.objectContaining({ id: "hosted-model-status", status: "PASS" })
      ])
    );

    await expect(runCli(["proof-audit", "--out", outDir, "--require-pass", "true"])).resolves.toMatchObject({
      stdout: expect.stringContaining("PASS proof-audit")
    });
  });

  it("refuses flagship live security proof when readiness is blocked", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-live-security-proof-blocked-"));
    const mcp = await startMockMcpServer({
      savedSearches: [
        {
          id: "saved-search-errors",
          type: "saved_searches",
          name: "Errors in the last 24 hours",
          app: "search"
        }
      ],
      savedSearchRows: []
    });
    const env = {
      SPLUNKREADY_LIVE_ENABLED: "true",
      SPLUNKREADY_SPLUNK_MCP_URL: mcp.url,
      SPLUNKREADY_SPLUNK_MCP_TOKEN: "test-token",
      SPLUNKREADY_SPLUNK_APP: "search",
      SPLUNKREADY_LLM_ENABLED: "true",
      GEMINI_API_KEY: "test-gemini-key",
      GEMINI_MODEL: "gemini-test"
    };

    try {
      await expect(runCli(["live-security-proof", "--out", outDir], process.cwd(), env)).rejects.toMatchObject({
        stderr: expect.stringContaining("live-security-proof is blocked")
      });
    } finally {
      await mcp.close();
    }

    expect(await exists(join(outDir, "live-security-readiness.json"))).toBe(true);
    expect(await exists(join(outDir, "receipt-before-001.json"))).toBe(false);
    expect(await exists(join(outDir, "trace-before.json"))).toBe(false);
  });

  it("runs live proof end to end from a derived saved-search mission", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-live-proof-"));
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
      const output = parseCliJsonOutput(
        (await runCli(["live-proof", "--out", outDir, "--candidate-limit", "1", "--json"], process.cwd(), env)).stdout
      );

      expect(output).toMatchObject({
        command: "live-proof",
        status: "PASS",
        artifacts: expect.arrayContaining([
          join(outDir, "live-candidates.json"),
          join(outDir, "live-derived-mission.json"),
          join(outDir, "live-derived-readiness-profile.json"),
          join(outDir, "trace-before.json"),
          join(outDir, "receipt-before-001.json"),
          join(outDir, "policy-patch.json"),
          join(outDir, "trace-after.json"),
          join(outDir, "receipt-after-001.json"),
          join(outDir, "live-proof-summary.json")
        ])
      });
    } finally {
      await gemini.close();
      await mcp.close();
    }

    const missions = JSON.parse(await readFile(join(outDir, "missions.json"), "utf8")) as Array<{
      id: string;
      allowedTools: string[];
      preferredSavedSearchRefs?: string[];
    }>;
    const readinessProfile = JSON.parse(await readFile(join(outDir, "readiness-profile.json"), "utf8")) as {
      contractRef: { mode: string };
      sourceRefs: string[];
    };
    const candidateReport = JSON.parse(await readFile(join(outDir, "live-candidates.json"), "utf8")) as {
      derivedMission: { strategy: string; missionId: string };
    };
    const beforeReceipt = JSON.parse(await readFile(join(outDir, "receipt-before-001.json"), "utf8")) as {
      verdict: string;
      violations: string[];
    };
    const afterReceipt = JSON.parse(await readFile(join(outDir, "receipt-after-001.json"), "utf8")) as {
      verdict: string;
      score: number;
    };
    const summary = JSON.parse(await readFile(join(outDir, "live-proof-summary.json"), "utf8")) as {
      mutation: boolean;
      derivedMission: { strategy: string; missionId: string };
      before: { verdict: string; score: number; violations: number };
      after: { verdict: string; score: number; violations: number };
      failToPass: boolean;
      readyWithoutPatch: boolean;
      proofLoop: string;
    };

    expect(candidateReport.derivedMission).toMatchObject({
      strategy: "saved-search-with-evidence",
      missionId: "mission-live-saved-search-readiness"
    });
    expect(missions).toEqual([
      expect.objectContaining({
        id: "mission-live-saved-search-readiness",
        allowedTools: expect.arrayContaining(["splunk_run_query", "splunk_run_saved_search"]),
        preferredSavedSearchRefs: ["SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain"]
      })
    ]);
    expect(readinessProfile).toMatchObject({ contractRef: { mode: "live" } });
    expect(readinessProfile.sourceRefs).toEqual(
      expect.arrayContaining(["mission:mission-live-saved-search-readiness"])
    );
    expect(beforeReceipt.verdict).toBe("NOT READY");
    expect(beforeReceipt.violations.length).toBeGreaterThan(0);
    expect(afterReceipt).toMatchObject({ verdict: "READY", score: 100 });
    expect(summary).toMatchObject({
      mutation: false,
      derivedMission: {
        strategy: "saved-search-with-evidence",
        missionId: "mission-live-saved-search-readiness"
      },
      before: { verdict: "NOT READY", violations: beforeReceipt.violations.length },
      after: { verdict: "READY", score: 100, violations: 0 },
      failToPass: true,
      readyWithoutPatch: false,
      proofLoop: "fail-to-pass"
    });
    expect(gemini.prompts).toHaveLength(4);
    expect(mcp.calls.map((call) => call.params.name)).toEqual(
      expect.arrayContaining(["splunk_run_saved_search", "saia_explain_spl", "saia_optimize_spl"])
    );
  });

  it("derives a bounded internal mission when live saved-search candidates return no rows", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-live-candidates-fallback-"));
    const server = await startMockMcpServer({
      indexes: [
        { name: "_internal", sensitive: false },
        { name: "main", sensitive: false }
      ],
      savedSearchRows: []
    });
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
      candidatesWithRows: Array<{ ref: string; resultCount: number }>;
      derivedMission: { strategy: string; missionId?: string; artifacts: string[] };
    };
    const derivedMission = JSON.parse(await readFile(join(outDir, "live-derived-mission.json"), "utf8")) as {
      id: string;
      expectedTools: string[];
      authorizedIndexes?: string[];
      checks: string[];
    };

    expect(report.candidatesWithRows).toEqual([]);
    expect(report.derivedMission).toMatchObject({
      strategy: "internal-query-fallback",
      missionId: "mission-live-internal-query-readiness",
      artifacts: [
        join(outDir, "live-derived-mission.json"),
        join(outDir, "live-derived-readiness-profile.json")
      ]
    });
    expect(derivedMission).toMatchObject({
      id: "mission-live-internal-query-readiness",
      expectedTools: ["splunk_run_query"],
      authorizedIndexes: ["_internal"]
    });
    expect(derivedMission.checks).toEqual(expect.arrayContaining(["SPL-001", "SPL-002", "SPL-004", "EVD-001", "SAF-003"]));
    expect(server.calls.map((call) => call.params.name)).toContain("splunk_run_saved_search");
  });
});
