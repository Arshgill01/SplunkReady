import { mkdtemp, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer } from "node:http";
import { promisify } from "node:util";

import { beforeAll, describe, expect, it } from "vitest";

import { validateLiveSecurityKit } from "../../src/live-security-kit/validator.js";

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

const readStdoutLine = (process: ChildProcessWithoutNullStreams, timeoutMs = 5_000): Promise<string> =>
  new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for stdout line. stderr=${stderr}`));
    }, timeoutMs);

    process.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
      const lineEnd = stdout.indexOf("\n");

      if (lineEnd >= 0) {
        clearTimeout(timeout);
        resolve(stdout.slice(0, lineEnd));
      }
    });

    process.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    process.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });

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
    hostedModelErrorText?: string;
    hostedModelErrorByToolName?: Partial<Record<string, string>>;
    saiaManagementRestStatus?: number;
    saiaManagementRestStatusByPath?: Partial<Record<string, number>>;
    restHandlerProbeErrorText?: string;
  } = {}
) => {
  const calls: Array<{ method: string; params: { name: string; arguments: unknown } }> = [];
  const managementCalls: Array<{ method: string; path: string }> = [];
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
    if (request.method === "GET" && request.url?.startsWith("/servicesNS/")) {
      const path = request.url.split("?")[0] ?? request.url;
      managementCalls.push({ method: "GET", path });
      const status = options.saiaManagementRestStatusByPath?.[path] ?? options.saiaManagementRestStatus ?? 200;
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify({ entry: [] }));
      return;
    }

    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      const parsed = JSON.parse(body) as { id: string; method: string; params: { name: string; arguments: unknown } };
      calls.push(parsed);

      const hostedModelErrorText = options.hostedModelErrorByToolName?.[parsed.params.name] ?? options.hostedModelErrorText;

      if ((options.blockHostedModels || hostedModelErrorText) && parsed.params.name.startsWith("saia_")) {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            jsonrpc: "2.0",
            id: parsed.id,
            result: {
              isError: true,
              content: [
                {
                  type: "text",
                  text:
                    hostedModelErrorText ??
                    `Action forbidden: ${parsed.params.name} requires Splunk AI Assistant access.`
                }
              ]
            }
          })
        );
        return;
      }

      if (options.restHandlerProbeErrorText && parsed.params.name === "splunk_run_query") {
        const query =
          parsed.params.arguments &&
          typeof parsed.params.arguments === "object" &&
          "query" in parsed.params.arguments &&
          typeof (parsed.params.arguments as { query?: unknown }).query === "string"
            ? (parsed.params.arguments as { query: string }).query
            : "";

        if (query.includes("Splunk_AI_Assistant_Cloud")) {
          response.writeHead(200, { "content-type": "application/json" });
          response.end(
            JSON.stringify({
              jsonrpc: "2.0",
              id: parsed.id,
              result: {
                isError: true,
                content: [{ type: "text", text: options.restHandlerProbeErrorText }]
              }
            })
          );
          return;
        }
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
            "saia_generate_spl",
            "saia_explain_spl",
            "saia_optimize_spl",
            "saia_ask_splunk_question"
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
        saia_generate_spl: {
          query: "search index=wineventlog host=win-finance-07 src=* earliest=-24h latest=now",
          rationale: "Generate a read-only search against the authorized Windows security index."
        },
        saia_explain_spl: {
          explanation: "The SPL uses a broad index wildcard and a non-contract field."
        },
        saia_optimize_spl: {
          optimizedQuery: "| savedsearch \"ES - Lateral Movement Auth Chain\"",
          rationale: "Prefer the validated saved search from the live contract."
        },
        saia_ask_splunk_question: {
          answer: "Use authorized indexes and saved searches to preserve deployment-specific guardrails."
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
    managementCalls,
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
  it("starts the stdio MCP server through the package CLI command", async () => {
    const child = spawn(process.execPath, [cliPath, "mcp"], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"]
    });

    try {
      child.stdin.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: "initialize",
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: { name: "cli-flow-test", version: "1.0.0" }
          }
        })}\n`
      );

      const response = JSON.parse(await readStdoutLine(child)) as {
        result: { protocolVersion: string; serverInfo: { name: string }; instructions: string };
      };

      expect(response.result.protocolVersion).toBe("2025-06-18");
      expect(response.result.serverInfo.name).toBe("splunkready");
      expect(response.result.instructions).toContain("Deterministic rules decide readiness");
    } finally {
      child.kill();
    }
  });

  it("starts the MCP recorder gateway and certifies a recorded dual-server session", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-mcp-recorder-"));
    const externalClientCwd = await mkdtemp(join(tmpdir(), "splunkready-external-client-cwd-"));
    const child = spawn(
      process.execPath,
      [
        cliPath,
        "mcp-recorder",
        "--server",
        "splunk=mock-splunk-mcp",
        "--server",
        "splunkready=mcp",
        "--fixture",
        join(process.cwd(), "fixtures/acme-soc-dev/adapter-fixture.json"),
        "--out",
        outDir
      ],
      {
        cwd: externalClientCwd,
        env: { ...process.env },
        stdio: ["pipe", "pipe", "pipe"]
      }
    );

    const sendRequest = async <T>(message: Record<string, unknown>, timeoutMs = 10_000): Promise<T> => {
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
      return JSON.parse(await readStdoutLine(child, timeoutMs)) as T;
    };

    try {
      const initialize = await sendRequest<{
        result: { capabilities: { tools: { listChanged: boolean } }; serverInfo: { name: string } };
      }>({
        id: "recorder-initialize",
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "cli-flow-test", version: "1.0.0" }
        }
      });
      expect(initialize.result.serverInfo.name).toBe("splunkready-mcp-recorder");
      expect(initialize.result.capabilities.tools.listChanged).toBe(false);

      const toolsList = await sendRequest<{ result: { tools: Array<{ name: string }> } }>({
        id: "recorder-tools",
        method: "tools/list"
      });
      const toolNames = toolsList.result.tools.map((tool) => tool.name);

      expect(toolNames).toEqual(
        expect.arrayContaining([
          "splunk__splunk_get_knowledge_objects",
          "splunk__splunk_run_saved_search",
          "splunkready__splunkready_certify_mcp_transcript",
          "splunkready__splunkready_certify_mcp_transcript_content",
          "splunkready_recorder_flush"
        ])
      );

      await sendRequest({
        id: "recorder-knowledge",
        method: "tools/call",
        params: {
          name: "splunk__splunk_get_knowledge_objects",
          arguments: { types: ["saved_searches"], app: "SplunkEnterpriseSecuritySuite" }
        }
      });
      await sendRequest({
        id: "recorder-saved-search",
        method: "tools/call",
        params: {
          name: "splunk__splunk_run_saved_search",
          arguments: {
            name: "ES - Lateral Movement Auth Chain",
            app: "SplunkEnterpriseSecuritySuite",
            tokens: { host: "win-finance-07", earliest: "-24h", latest: "now" },
            maxRows: 10
          }
        }
      });
      const transcript = await readFile("examples/sample-mcp-transcript-pass.jsonl", "utf8");
      await sendRequest(
        {
          id: "recorder-certify-content",
          method: "tools/call",
          params: {
            name: "splunkready__splunkready_certify_mcp_transcript_content",
            arguments: {
              transcript,
              finalAnswer:
                "Evidence supports suspicious lateral movement. Provenance saved-search-lateral-movement returned 3 rows with evidence evt-102, evt-118, and evt-141.",
              outDir: join(outDir, "downstream-certification"),
              strictImport: true,
              requirePass: true,
              agentName: "CLI flow recorder fixture",
              agentVersion: "test"
            }
          }
        },
        60_000
      );
      await sendRequest(
        {
          id: "recorder-certify-path",
          method: "tools/call",
          params: {
            name: "splunkready__splunkready_certify_mcp_transcript",
            arguments: {
              transcriptPath: "examples/sample-mcp-transcript-pass.jsonl",
              finalAnswer:
                "Evidence supports suspicious lateral movement. Provenance saved-search-lateral-movement returned 3 rows with evidence evt-102, evt-118, and evt-141.",
              outDir: join(outDir, "downstream-path-certification"),
              strictImport: true,
              requirePass: true,
              agentName: "CLI flow recorder fixture",
              agentVersion: "test"
            }
          }
        },
        60_000
      );
      const flush = await sendRequest<{
        result: {
          content: Array<{ type: string; text: string }>;
          structuredContent: { status: string; certification?: { status: string }; frameCount: number };
        };
      }>(
        {
          id: "recorder-flush",
          method: "tools/call",
          params: {
            name: "splunkready_recorder_flush",
            arguments: {
              finalAnswer:
                "Evidence supports suspicious lateral movement from win-finance-07 through admin-login-02 to dc-01 and finance-sql-03.",
              requirePass: true
            }
          }
        },
        60_000
      );

      expect(flush.result.structuredContent.status).toBe("PASS");
      expect(flush.result.structuredContent.certification?.status).toBe("PASS");
      expect(flush.result.structuredContent.frameCount).toBeGreaterThanOrEqual(7);
      expect(flush.result.content[0].type).toBe("text");
      expect(flush.result.content[0].text).toContain("\"status\": \"PASS\"");

      const sessionText = await readFile(join(outDir, "mcp-recorder-session.jsonl"), "utf8");
      const sessionFrames = sessionText
        .trim()
        .split(/\r?\n/)
        .map((line) => JSON.parse(line) as { serverId: string; message: unknown });
      const importSummary = JSON.parse(
        await readFile(join(outDir, "mcp-recorder-certification", "mcp-transcript-import.json"), "utf8")
      ) as { unmatchedToolCalls: number; skippedRecords: number; finalAnswers: number };

      expect(new Set(sessionFrames.map((frame) => frame.serverId))).toEqual(new Set(["splunk", "splunkready"]));
      expect(sessionText).toContain("splunk_run_saved_search");
      expect(sessionText).toContain("splunkready_certify_mcp_transcript_content");
      expect(sessionText).toContain("splunkready_recorder_flush");
      expect(sessionText).not.toMatch(/Bearer\s+(?!<redacted-token>)[A-Za-z0-9._~+/=-]+/);
      expect(sessionText).not.toMatch(/\/Users\/|\/private\/|\/tmp\//);
      expect(importSummary.unmatchedToolCalls).toBe(0);
      expect(importSummary.skippedRecords).toBe(0);
      expect(importSummary.finalAnswers).toBe(1);
    } finally {
      child.stdin.end();
      child.kill();
    }
  }, 120_000);

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
    const receiptChainOutput = parseCliJsonOutput(
      (await runCli(["verify-receipt-chain", "--dir", outDir, "--json"])).stdout
    );
    const receiptChain = JSON.parse(await readFile(join(outDir, "receipt-chain.json"), "utf8")) as {
      status: string;
      chainValid: boolean;
      mutation: boolean;
      deterministicAuthority: boolean;
      receiptCount: number;
      signature: { status: string; signatureBase64?: string };
      entries: Array<{ path: string; previousReceiptHash: string | null; receiptHash: string }>;
    };
    const keyDir = await mkdtemp(join(tmpdir(), "splunkready-cli-keys-"));
    const keysInit = parseCliJsonOutput((await runCli(["keys", "init", "--out", keyDir, "--json"])).stdout);
    const signReceipt = parseCliJsonOutput(
      (
        await runCli([
          "sign-receipt",
          "--dir",
          outDir,
          "--private-key",
          join(keyDir, "receipt-private-key.local.pem"),
          "--public-key",
          join(keyDir, "receipt-public-key.pem"),
          "--json"
        ])
      ).stdout
    );
    const verifySignedReceiptChain = parseCliJsonOutput(
      (await runCli(["verify-receipt-chain", "--dir", outDir, "--public-key", join(keyDir, "receipt-public-key.pem"), "--json"]))
        .stdout
    );
    const signedReceiptChain = JSON.parse(await readFile(join(outDir, "receipt-chain.json"), "utf8")) as {
      signature: { status: string; signatureBase64?: string };
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
    expect(receiptChainOutput).toMatchObject({
      command: "verify-receipt-chain",
      status: "PASS",
      artifacts: [join(outDir, "receipt-chain.json")]
    });
    expect(receiptChain).toMatchObject({
      status: "PASS",
      chainValid: true,
      mutation: false,
      deterministicAuthority: true,
      receiptCount: 3
    });
    expect(receiptChain.entries.map((entry) => entry.path)).toEqual([
      "receipt-before-001.json",
      "receipt-after-001.json",
      "receipt-external-001.json"
    ]);
    expect(receiptChain.entries[0].previousReceiptHash).toBeNull();
    expect(receiptChain.entries[1].previousReceiptHash).toBe(receiptChain.entries[0].receiptHash);
    expect(keysInit).toMatchObject({
      command: "keys-init",
      status: "PASS",
      artifacts: [join(keyDir, "receipt-public-key.pem"), join(keyDir, "receipt-private-key.local.pem")]
    });
    expect(signReceipt).toMatchObject({
      command: "sign-receipt",
      status: "PASS",
      artifacts: [join(outDir, "receipt-chain.json")]
    });
    expect(verifySignedReceiptChain).toMatchObject({
      command: "verify-receipt-chain",
      status: "PASS",
      artifacts: [join(outDir, "receipt-chain.json")]
    });
    expect(signedReceiptChain.signature.status).toBe("VERIFIED");
    expect(signedReceiptChain.signature.signatureBase64).toEqual(expect.any(String));
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

  it("publishes signed policy bundles and records policy identity in receipts", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-cli-policy-"));
    const evalDir = join(outDir, "eval");

    const publish = parseCliJsonOutput(
      (await runCli(["policy-publish", "--policy", "soc2-readiness", "--out", outDir, "--json"])).stdout
    );

    expect(publish).toMatchObject({
      command: "policy-publish",
      status: "PASS",
      artifacts: expect.arrayContaining([join(outDir, "soc2-readiness.policy-manifest.json")])
    });

    const manifest = JSON.parse(await readFile(join(outDir, "soc2-readiness.policy-manifest.json"), "utf8")) as {
      policyHash: string;
      deterministicAuthority: boolean;
      mutation: boolean;
      signature: { algorithm: string; status: string };
    };

    expect(manifest).toMatchObject({
      deterministicAuthority: true,
      mutation: false,
      signature: { algorithm: "ed25519", status: "SIGNED" }
    });
    expect(manifest.policyHash).toMatch(/^[a-f0-9]{64}$/);

    await runCli(["compile", "--out", evalDir, "--json"]);
    const evaluate = parseCliJsonOutput(
      (await runCli(["evaluate", "--out", evalDir, "--policy", "pci-dss-readiness", "--json"])).stdout
    );

    expect(evaluate).toMatchObject({
      command: "evaluate",
      status: "PASS",
      artifacts: expect.arrayContaining([join(evalDir, "policy-evaluation.json")])
    });

    await runCli(["receipt", "--out", evalDir, "--json"]);
    const receipt = JSON.parse(await readFile(join(evalDir, "receipt-before-001.json"), "utf8")) as {
      policy?: { id: string; name: string; version: string; hash: string };
    };
    const markdown = await readFile(join(evalDir, "receipt-before-001.md"), "utf8");

    expect(receipt.policy).toMatchObject({
      id: "pci-dss-readiness",
      name: "PCI DSS Splunk Agent Readiness",
      version: "2026.06.07",
      hash: expect.stringMatching(/^[a-f0-9]{64}$/)
    });
    expect(markdown).toContain("Policy: PCI DSS Splunk Agent Readiness 2026.06.07 (`pci-dss-readiness`)");
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
    const diagnostics = JSON.parse(await readFile(join(outDir, "compiler-diagnostics.json"), "utf8")) as {
      source: string;
      compiler: string;
      status: string;
      mode: string;
      mutation: boolean;
      passFailAuthority: string;
      advisoryOnly: { allowedRoles: string[]; prohibitedRoles: string[] };
      totals: {
        activeRules: number;
        beforeViolations: number;
        afterViolations: number;
        resolvedRules: number;
        evidenceRefsAfterPatch: number;
        traceRefsAfterPatch: number;
      };
      missions: Array<{
        missionId: string;
        readinessProfileId: string;
        before: { verdict: string; violations: number; traceRefs: number; evidenceRefs: number };
        after: { verdict: string; violations: number; traceRefs: number; evidenceRefs: number };
        ruleOutcomes: Array<{
          ruleId: string;
          severity: string;
          source: string;
          beforeViolations: number;
          afterViolations: number;
          resolved: boolean;
          contractRefs: string[];
          missionRefs: string[];
          evidenceRefs: string[];
          rationale: string;
        }>;
      }>;
    };
    const diagnosticsMarkdown = await readFile(join(outDir, "compiler-diagnostics.md"), "utf8");

    expect(output).toMatchObject({
      command: "suite-proof",
      status: "PASS",
      artifacts: expect.arrayContaining([
        join(outDir, "suite-proof-summary.json"),
        join(outDir, "suite-proof-summary.md"),
        join(outDir, "compiler-diagnostics.json"),
        join(outDir, "compiler-diagnostics.md"),
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
    expect(diagnostics).toMatchObject({
      source: "splunkready-suite-compiler-diagnostics",
      compiler: "Agent Readiness Compiler",
      status: "PASS",
      mode: "fixture",
      mutation: false,
      passFailAuthority: "deterministic-rule-engine",
      totals: {
        beforeViolations: expect.any(Number),
        afterViolations: 0,
        evidenceRefsAfterPatch: 15
      }
    });
    expect(diagnostics.totals.activeRules).toBeGreaterThan(0);
    expect(diagnostics.totals.resolvedRules).toBeGreaterThan(0);
    expect(diagnostics.advisoryOnly.prohibitedRoles).toEqual(expect.arrayContaining(["decide pass/fail readiness"]));
    expect(diagnostics.missions).toHaveLength(3);
    expect(diagnostics.missions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          missionId: "mission-security-lateral-movement-readiness",
          readinessProfileId: "readiness-profile-contract-acme-soc-dev-profile-2026-06-01",
          before: expect.objectContaining({ verdict: "NOT READY" }),
          after: expect.objectContaining({ verdict: "READY", violations: 0 }),
          ruleOutcomes: expect.arrayContaining([
            expect.objectContaining({
              ruleId: "SPL-001",
              source: "splunk_contract",
              beforeViolations: 1,
              afterViolations: 0,
              resolved: true,
              contractRefs: expect.arrayContaining(["contract-acme-soc-dev.forbiddenQueryPatterns"])
            }),
            expect.objectContaining({
              ruleId: "KO-001",
              source: "splunk_contract",
              evidenceRefs: expect.arrayContaining(["contract-acme-soc-dev.savedSearches"])
            })
          ])
        })
      ])
    );
    expect(diagnosticsMarkdown).toContain("SplunkReady Compiler Diagnostics");
    expect(diagnosticsMarkdown).toContain("Pass/fail authority: deterministic-rule-engine");
    expect(diagnosticsMarkdown).toContain("SPL-001");

    const receiptChainOutput = parseCliJsonOutput((await runCli(["verify-receipt-chain", "--dir", outDir, "--json"])).stdout);
    const replayOutput = parseCliJsonOutput((await runCli(["receipt-replay", "--dir", outDir, "--json"])).stdout);
    const receiptChain = JSON.parse(await readFile(join(outDir, "receipt-chain.json"), "utf8")) as {
      status: string;
      receiptCount: number;
      entries: Array<{ path: string; previousReceiptHash: string | null; receiptHash: string }>;
    };
    const receiptReplay = JSON.parse(await readFile(join(outDir, "receipt-replay.json"), "utf8")) as {
      status: string;
      replayedReceiptCount: number;
      entries: Array<{ replayMatches: boolean }>;
    };
    const firstReceipt = JSON.parse(
      await readFile(join(outDir, receiptChain.entries[0].path), "utf8")
    ) as { receiptHash: string; previousReceiptHash: string | null };
    const secondReceipt = JSON.parse(
      await readFile(join(outDir, receiptChain.entries[1].path), "utf8")
    ) as { receiptHash: string; previousReceiptHash: string | null };

    expect(receiptChainOutput).toMatchObject({
      command: "verify-receipt-chain",
      status: "PASS",
      artifacts: [join(outDir, "receipt-chain.json")]
    });
    expect(receiptChain).toMatchObject({ status: "PASS", receiptCount: 6 });
    expect(firstReceipt.receiptHash).toBe(receiptChain.entries[0].receiptHash);
    expect(firstReceipt.previousReceiptHash).toBeNull();
    expect(secondReceipt.previousReceiptHash).toBe(receiptChain.entries[0].receiptHash);
    expect(replayOutput).toMatchObject({
      command: "receipt-replay",
      status: "PASS",
      artifacts: [join(outDir, "receipt-replay.json")]
    });
    expect(receiptReplay).toMatchObject({ status: "PASS", replayedReceiptCount: 6 });
    expect(receiptReplay.entries.every((entry) => entry.replayMatches)).toBe(true);

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
        join(strictOutDir, "suite-proof-summary.md"),
        join(strictOutDir, "compiler-diagnostics.json")
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

  it("runs a one-command judge proof bundle", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-judge-proof-"));

    const output = parseCliJsonOutput(
      (await runCli(["judge-proof", "--out", outDir, "--json"], process.cwd(), {
        GEMINI_API_KEY: "",
        SPLUNKREADY_LLM_ENABLED: "false"
      })).stdout
    );
    const summary = JSON.parse(await readFile(join(outDir, "judge-proof-summary.json"), "utf8")) as {
      source: string;
      status: string;
      mode: string;
      mutation: boolean;
      llmActivation: {
        policy: string;
        includeRequested: boolean;
        enabledByEnv: boolean;
        configured: boolean;
        included: boolean;
      };
      proofDirs: { suite: string; firewall: string };
      gates: Array<{ id: string; status: string; artifacts: string[] }>;
      llmEvidence: {
        status: string;
        role: string;
        passFailAuthority: string;
        proofDir: string;
        artifacts: string[];
        reason: string;
        nextCommand: string;
      };
      certificationIndex: string;
      uiArtifacts: string;
      nextCommands: string[];
    };
    const index = JSON.parse(await readFile(join(outDir, "certification-index.json"), "utf8")) as {
      status: string;
      mutation: boolean;
      totals: { proofs: number; pass: number; warn: number; fail: number };
      entries: Array<{
        label: string;
        proofDir: string;
        proofType: string;
        status: string;
        manifestStatus: string;
        mutation: boolean | null;
        missions: string[];
        domains: string[];
        proofLoop?: string;
      }>;
    };
    const markdown = await readFile(join(outDir, "judge-proof-summary.md"), "utf8");

    expect(output).toMatchObject({
      command: "judge-proof",
      status: "PASS",
      artifacts: expect.arrayContaining([
        join(outDir, "judge-proof-summary.json"),
        join(outDir, "judge-proof-summary.md"),
        join(outDir, "certification-index.json"),
        join(outDir, "ui-artifacts.json"),
        join(outDir, "suite-proof", "compiler-diagnostics.json"),
        join(outDir, "suite-proof", "proof-audit.json"),
        join(outDir, "suite-proof", "proof-manifest-verification.json"),
        join(outDir, "firewall-check", "proof-audit.json"),
        join(outDir, "firewall-check", "proof-manifest-verification.json")
      ])
    });
    expect(summary).toMatchObject({
      source: "splunkready-judge-proof",
      status: "PASS",
      mode: "fixture",
      mutation: false,
      llmActivation: {
        policy: "include-when-requested-or-env-enabled",
        includeRequested: false,
        enabledByEnv: false,
        configured: false,
        included: false
      },
      proofDirs: {
        suite: join(outDir, "suite-proof"),
        firewall: join(outDir, "firewall-check")
      },
      certificationIndex: join(outDir, "certification-index.json"),
      uiArtifacts: join(outDir, "ui-artifacts.json"),
      llmEvidence: {
        status: "NOT_REQUESTED",
        role: "trace-producer",
        passFailAuthority: "deterministic-rule-engine",
        proofDir: join(outDir, "llm-proof"),
        artifacts: []
      }
    });
    expect(summary.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "suite-proof", status: "PASS" }),
        expect.objectContaining({ id: "suite-proof-manifest", status: "PASS" }),
        expect.objectContaining({ id: "firewall-check", status: "PASS" }),
        expect.objectContaining({ id: "firewall-check-manifest", status: "PASS" }),
        expect.objectContaining({ id: "certification-index", status: "PASS" })
      ])
    );
    expect(summary.llmEvidence.reason).toContain("credential-free");
    expect(summary.llmEvidence.nextCommand).toContain("--include-llm-proof true");
    expect(summary.nextCommands).toEqual(expect.arrayContaining(["npm run workbench", summary.llmEvidence.nextCommand]));
    expect(index).toMatchObject({
      status: "PASS",
      mutation: false,
      totals: { proofs: 2, pass: 2, warn: 0, fail: 0 }
    });
    expect(index.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Phase Live multi-mission readiness proof",
          proofDir: join(outDir, "suite-proof"),
          proofType: "suite",
          status: "PASS",
          manifestStatus: "PASS",
          mutation: false,
          domains: ["observability", "security"],
          proofLoop: "fail-to-pass"
        }),
        expect.objectContaining({
          label: "firewall-check",
          proofDir: join(outDir, "firewall-check"),
          proofType: "firewall-block",
          status: "PASS",
          manifestStatus: "PASS",
          mutation: false,
          missions: ["mission-security-lateral-movement-readiness"],
          domains: ["security"]
        })
      ])
    );
    expect(markdown).toContain("SplunkReady Judge Proof");
    expect(markdown).toContain("certification-index.json");
    expect(markdown).toContain("LLM specimen evidence: NOT_REQUESTED");
    expect(markdown).toContain("LLM activation: requested=false env=false configured=false included=false");
  });

  it("includes the model-produced LLM proof in the judge bundle when LLM mode is enabled", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-judge-proof-llm-"));
    const gemini = await startMockGeminiServer();
    const llmEnv = {
      GEMINI_API_KEY: "test-gemini-key",
      GEMINI_MODEL: "gemini-test",
      SPLUNKREADY_LLM_ENABLED: "true",
      SPLUNKREADY_GEMINI_ENDPOINT_BASE_URL: gemini.url
    };

    try {
      const output = parseCliJsonOutput(
        (await runCli(["judge-proof", "--out", outDir, "--json"], process.cwd(), llmEnv)).stdout
      );
      const summary = JSON.parse(await readFile(join(outDir, "judge-proof-summary.json"), "utf8")) as {
        status: string;
        llmActivation: {
          includeRequested: boolean;
          enabledByEnv: boolean;
          configured: boolean;
          included: boolean;
        };
        llmEvidence: {
          status: string;
          role: string;
          passFailAuthority: string;
          proofDir: string;
          summaryPath: string;
          artifacts: string[];
        };
      };

      expect(output).toMatchObject({
        command: "judge-proof",
        status: "PASS",
        artifacts: expect.arrayContaining([
          join(outDir, "judge-proof-summary.json"),
          join(outDir, "llm-proof", "llm-proof-summary.json"),
          join(outDir, "llm-proof", "trace-before.json"),
          join(outDir, "llm-proof", "trace-after.json")
        ])
      });
      expect(summary).toMatchObject({
        status: "PASS",
        llmActivation: {
          includeRequested: false,
          enabledByEnv: true,
          configured: true,
          included: true
        },
        llmEvidence: {
          status: "PASS",
          role: "trace-producer",
          passFailAuthority: "deterministic-rule-engine",
          proofDir: join(outDir, "llm-proof"),
          summaryPath: join(outDir, "llm-proof", "llm-proof-summary.json")
        }
      });
      expect(summary.llmEvidence.artifacts).toEqual(expect.arrayContaining([join(outDir, "llm-proof", "llm-proof-summary.json")]));
      expect(gemini.prompts).toHaveLength(4);
    } finally {
      await gemini.close();
    }
  }, 120_000);

  it("runs judge proof from outside the repository root with bundled defaults", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "splunkready-packaged-cwd-"));
    const outDir = join(cwd, "proof");

    const output = parseCliJsonOutput(
      (await runCli(["judge-proof", "--out", outDir, "--json"], cwd, {
        GEMINI_API_KEY: "",
        SPLUNKREADY_LLM_ENABLED: "false"
      })).stdout
    );
    const summary = JSON.parse(await readFile(join(outDir, "judge-proof-summary.json"), "utf8")) as {
      status: string;
      mode: string;
      mutation: boolean;
      gates: Array<{ id: string; status: string }>;
    };

    expect(output).toMatchObject({
      command: "judge-proof",
      status: "PASS",
      artifacts: expect.arrayContaining([
        join(outDir, "suite-proof", "suite-proof-summary.json"),
        join(outDir, "firewall-check", "firewall-block-before.json"),
        join(outDir, "judge-proof-summary.json")
      ])
    });
    expect(summary).toMatchObject({
      status: "PASS",
      mode: "fixture",
      mutation: false
    });
    expect(summary.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "suite-proof", status: "PASS" }),
        expect.objectContaining({ id: "certification-index", status: "PASS" })
      ])
    );
  }, 90_000);

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

  it("runs a one-command MCP server proof through stdio tools", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-mcp-proof-"));

    const output = parseCliJsonOutput((await runCli(["mcp-proof", "--out", outDir, "--json"])).stdout);
    const summary = JSON.parse(await readFile(join(outDir, "mcp-proof-summary.json"), "utf8")) as {
      status: string;
      source: string;
      mutation: boolean;
      handshake: { protocolVersion: string; serverName: string; instructions: string };
      tools: Array<{ name: string; destructiveHint: boolean; readOnlyHint: boolean }>;
      resources: Array<{ uri: string; name: string; mimeType: string }>;
      resourceTemplates: Array<{ uriTemplate: string; name: string; mimeType: string }>;
      prompts: Array<{ name: string; argumentCount: number }>;
      describe: { product: string; engine: string; mutation: boolean; deterministicAuthority: boolean };
      postureResource: { contents: Array<{ uri: string; text: string }> };
      clientConfigResource: { contents: Array<{ uri: string; text: string }> };
      dualServerClientConfigResource: { contents: Array<{ uri: string; text: string }> };
      claudeDesktopClientConfigResource: { contents: Array<{ uri: string; text: string }> };
      cursorClientConfigResource: { contents: Array<{ uri: string; text: string }> };
      antigravityClientConfigResource: { contents: Array<{ uri: string; text: string }> };
      zedClientConfigResource: { contents: Array<{ uri: string; text: string }> };
      certificationLoopResource: { contents: Array<{ uri: string; text: string }> };
      compositionScorecardResource: { contents: Array<{ uri: string; text: string }> };
      hostedModelDiagnosticResource: { contents: Array<{ uri: string; text: string }> };
      receiptTemplateResource: { contents: Array<{ uri: string; text: string }> };
      transcriptPrompt: { messages: Array<{ content: { text: string } }> };
      certificationLoopPrompt: { messages: Array<{ content: { text: string } }> };
      compositionReviewPrompt: { messages: Array<{ content: { text: string } }> };
      hostedModelDiagnosticPrompt: { messages: Array<{ content: { text: string } }> };
      transcriptCertification: { status: string; mutation: boolean; outDir: string; artifacts: string[] };
      inlineTranscriptCertification: { status: string; mutation: boolean; outDir: string; artifacts: string[] };
      mcpCompositionReview: {
        source: string;
        status: string;
        score: number;
        checks: Array<{ id: string; status: string; evidence: string }>;
        splunkToolNames: string[];
        splunkToolCallCount: number;
        evidenceRefs: string[];
        deterministicAuthority: boolean;
        mutation: boolean;
      };
      hostedModelAccess: {
        status: string;
        permissionStatus: string;
        mutation: boolean;
        outDir: string;
        requiredTools: string[];
        availableTools: string[];
        missingTools: string[];
        passedTools: string[];
        blockedTools: string[];
        toolResults: Array<{ toolName: string; status: string }>;
        remediation: { status: string; blockerClass: string; safeForPublicExport: boolean; mutation: boolean };
        artifacts: string[];
      };
      operatorLiveHostedModelStatus: {
        source: string;
        status: string;
        artifactPath: string;
        blockerClass: string;
        permissionStatus: string;
        permissionBlockerClass: string;
        requiredTools: string[];
        availableTools: string[];
        passedTools: string[];
        blockedTools: string[];
        restHandlerProbeStatus: string;
        summary: string;
        safeForPublicExport: boolean;
        deterministicAuthority: boolean;
        mutation: boolean;
      };
      agentDrivenWorkflow: {
        status: string;
        splunkMcpServerRole: string;
        splunkReadyMcpServerRole: string;
        stages: string[];
        deterministicAuthority: boolean;
        mutation: boolean;
      };
      splunkMcpBoundary: {
        status: string;
        transcriptKind: string;
        localMcpServerRole: string;
        splunkMcpServerRole: string;
        certifiedToolNames: string[];
        splunkToolCallCount: number;
        includesSavedSearchExecution: boolean;
        evidenceRefs: string[];
        receiptPath: string;
        deterministicAuthority: boolean;
        mutation: boolean;
      };
      mcpComposition: {
        status: string;
        score: number;
        servers: Array<{ name: string; role: string; evidence: string; existingMcpServer: boolean }>;
        checks: Array<{ id: string; status: string; evidence: string }>;
        deterministicAuthority: boolean;
        mutation: boolean;
      };
      officialSplunkMcpToolCoverage: {
        source: string;
        status: string;
        docs: { toolsUrl: string; configurationUrl: string };
        capturedCoreTools: string[];
        investigationTools: string[];
        hostedModelTools: string[];
        missionScopedOutTools: string[];
        checks: Array<{ id: string; status: string; evidence: string }>;
        deterministicAuthority: boolean;
        mutation: boolean;
      };
      clientWalkthrough: {
        source: string;
        status: string;
        artifactPath: string;
        markdownPath: string;
        deterministicAuthority: boolean;
        mutation: boolean;
        servers: Array<{ name: string; role: string; existingMcpServer: boolean }>;
        stages: Array<{ id: string; title: string; server: string; evidence: string }>;
        transcript: {
          path: string;
          splunkToolNames: string[];
          splunkToolCallCount: number;
          includesSavedSearchExecution: boolean;
          evidenceRefs: string[];
        };
        receipt: { path: string; status: string; authoritative: boolean };
      };
      clientSession: {
        source: string;
        status: string;
        artifactPath: string;
        markdownPath: string;
        protocol: string;
        requestCount: number;
        responseCount: number;
        methods: string[];
        resourceUris: string[];
        promptNames: string[];
        toolNames: string[];
        deterministicAuthority: boolean;
        mutation: boolean;
      };
      liveMockSplunkMcp: {
        source: string;
        status: string;
        artifactPath: string;
        markdownPath: string;
        routeState: string;
        toolNames: string[];
        evidenceRefs: string[];
        includesSavedSearchExecution: boolean;
        requestCount: number;
        responseCount: number;
        deterministicAuthority: boolean;
        mutation: boolean;
      };
      artifacts: string[];
    };
    const clientWalkthrough = JSON.parse(await readFile(join(outDir, "mcp-client-walkthrough.json"), "utf8")) as {
      source: string;
      status: string;
      mutation: boolean;
      deterministicAuthority: boolean;
      servers: Array<{ name: string; role: string; existingMcpServer: boolean }>;
      stages: Array<{ id: string; server: string; evidence: string }>;
      transcript: {
        splunkToolNames: string[];
        splunkToolCallCount: number;
        includesSavedSearchExecution: boolean;
        evidenceRefs: string[];
      };
      receipt: { status: string; authoritative: boolean };
    };
    const transcriptProofDir = join(outDir, "mcp-transcript-certification");
    const hostedModelAccessDir = join(outDir, "mcp-hosted-model-access");

    expect(output).toMatchObject({
      command: "mcp-proof",
      status: "PASS",
      artifacts: expect.arrayContaining([
        join(outDir, "mcp-proof-summary.json"),
        join(outDir, "mcp-proof-summary.md"),
        join(outDir, "mcp-client-walkthrough.json"),
        join(outDir, "mcp-client-walkthrough.md"),
        join(outDir, "mcp-client-session.jsonl"),
        join(outDir, "mcp-client-session.md"),
        join(transcriptProofDir, "receipt-external-001.json")
      ])
    });
    expect(summary).toMatchObject({
      source: "splunkready-mcp-proof",
      status: "PASS",
      mutation: false,
      handshake: {
        protocolVersion: "2025-06-18",
        serverName: "splunkready",
        instructions: expect.stringContaining("Deterministic rules decide readiness")
      },
      describe: {
        product: "SplunkReady",
        engine: "Agent Readiness Compiler",
        mutation: false,
        deterministicAuthority: true
      },
      transcriptCertification: {
        status: "PASS",
        mutation: false,
        outDir: transcriptProofDir
      },
      agentDrivenWorkflow: {
        status: "PASS",
        deterministicAuthority: true,
        mutation: false
      },
      splunkMcpBoundary: {
        status: "PASS",
        transcriptKind: "captured-splunk-mcp-jsonrpc",
        certifiedToolNames: ["splunk_get_knowledge_objects", "splunk_run_saved_search"],
        splunkToolCallCount: 2,
        includesSavedSearchExecution: true,
        evidenceRefs: ["evt-102", "evt-118", "evt-141"],
        receiptPath: join(transcriptProofDir, "receipt-external-001.json"),
        deterministicAuthority: true,
        mutation: false
      },
      mcpComposition: {
        status: "PASS",
        score: 100,
        servers: [
          expect.objectContaining({ name: "splunk", existingMcpServer: true }),
          expect.objectContaining({ name: "splunkready", existingMcpServer: false })
        ],
        checks: [
          expect.objectContaining({ id: "dual-server-client-config", status: "PASS" }),
          expect.objectContaining({ id: "external-mcp-client-configs", status: "PASS" }),
          expect.objectContaining({ id: "discoverable-resources-and-prompts", status: "PASS" }),
          expect.objectContaining({ id: "existing-splunk-mcp-boundary", status: "PASS" }),
          expect.objectContaining({ id: "official-splunk-mcp-tool-coverage", status: "PASS" }),
          expect.objectContaining({ id: "saved-search-evidence", status: "PASS" }),
          expect.objectContaining({ id: "readiness-receipt-authority", status: "PASS" }),
          expect.objectContaining({ id: "composition-review-tool", status: "PASS" }),
          expect.objectContaining({ id: "no-splunkready-mutation", status: "PASS" }),
          expect.objectContaining({ id: "hosted-model-advisory-access", status: "PASS" })
        ],
        deterministicAuthority: true,
        mutation: false
      },
      mcpCompositionReview: {
        source: "splunkready-mcp-composition-review",
        status: "PASS",
        score: 100,
        splunkToolNames: ["splunk_get_knowledge_objects", "splunk_run_saved_search"],
        splunkToolCallCount: 2,
        evidenceRefs: ["evt-102", "evt-118", "evt-141"],
        deterministicAuthority: true,
        mutation: false
      },
      officialSplunkMcpToolCoverage: {
        source: "splunkready-official-splunk-mcp-tool-coverage",
        status: "PASS",
        docs: {
          toolsUrl: expect.stringContaining("mcp-server-tools"),
          configurationUrl: expect.stringContaining("connecting-to-the-mcp-server-and-settings")
        },
        capturedCoreTools: ["splunk_get_knowledge_objects"],
        investigationTools: ["splunk_get_knowledge_objects", "splunk_run_saved_search"],
        hostedModelTools: [
          "saia_generate_spl",
          "saia_explain_spl",
          "saia_optimize_spl",
          "saia_ask_splunk_question"
        ],
        missionScopedOutTools: ["splunk_get_info"],
        checks: [
          expect.objectContaining({ id: "splunk-knowledge-object-context", status: "PASS" }),
          expect.objectContaining({ id: "splunk-investigation-execution", status: "PASS" }),
          expect.objectContaining({ id: "mission-scoped-tool-boundary", status: "PASS" }),
          expect.objectContaining({ id: "saia-hosted-model-tools", status: "PASS" })
        ],
        deterministicAuthority: true,
        mutation: false
      },
      clientWalkthrough: {
        source: "splunkready-mcp-client-walkthrough",
        status: "PASS",
        artifactPath: join(outDir, "mcp-client-walkthrough.json"),
        markdownPath: join(outDir, "mcp-client-walkthrough.md"),
        deterministicAuthority: true,
        mutation: false,
        transcript: {
          path: "examples/sample-mcp-transcript-pass.jsonl",
          splunkToolNames: ["splunk_get_knowledge_objects", "splunk_run_saved_search"],
          splunkToolCallCount: 2,
          includesSavedSearchExecution: true,
          evidenceRefs: ["evt-102", "evt-118", "evt-141"]
        },
        receipt: {
          path: join(transcriptProofDir, "receipt-external-001.json"),
          status: "PASS",
          authoritative: true
        }
      },
      clientSession: {
        source: "splunkready-mcp-client-session",
        status: "PASS",
        artifactPath: join(outDir, "mcp-client-session.jsonl"),
        markdownPath: join(outDir, "mcp-client-session.md"),
        protocol: "stdio-jsonrpc",
        methods: expect.arrayContaining([
          "initialize",
          "tools/list",
          "resources/list",
          "resources/templates/list",
          "resources/read",
          "prompts/list",
          "prompts/get",
          "tools/call"
        ]),
        resourceUris: expect.arrayContaining([
          "splunkready://client-config/splunk-and-splunkready",
          "splunkready://client-config/claude-desktop",
          "splunkready://client-config/cursor",
          "splunkready://client-config/antigravity",
          "splunkready://client-config/zed",
          "splunkready://workflows/splunk-mcp-certification-loop",
          "splunkready://workflows/mcp-composition-scorecard",
          "splunkready://workflows/hosted-model-diagnostic",
          "splunkready://receipts/pass"
        ]),
        promptNames: expect.arrayContaining([
          "splunkready_splunk_mcp_certification_loop",
          "splunkready_mcp_composition_review",
          "splunkready_hosted_model_diagnostic"
        ]),
        toolNames: expect.arrayContaining([
          "splunkready_describe_certification",
          "splunkready_certify_mcp_transcript",
          "splunkready_certify_mcp_transcript_content",
          "splunkready_review_mcp_composition",
          "splunkready_check_hosted_model_access"
        ]),
        deterministicAuthority: true,
        mutation: false
      },
      liveMockSplunkMcp: {
        source: "splunkready-live-mock-splunk-mcp",
        status: "NOT_REQUESTED",
        artifactPath: join(outDir, "mock-splunk-mcp-session.jsonl"),
        markdownPath: join(outDir, "mock-splunk-mcp-session.md"),
        routeState: "ok",
        toolNames: [],
        evidenceRefs: [],
        includesSavedSearchExecution: false,
        requestCount: 0,
        responseCount: 0,
        deterministicAuthority: true,
        mutation: false
      }
    });
    expect(summary.clientSession.requestCount).toBeGreaterThanOrEqual(24);
    expect(summary.clientSession.responseCount).toBe(summary.clientSession.requestCount);
    expect(summary.splunkMcpBoundary.localMcpServerRole).toContain("certification interface");
    expect(summary.splunkMcpBoundary.splunkMcpServerRole).toContain("Splunk MCP Server boundary");
    expect(summary.tools.map((tool) => tool.name)).toEqual([
      "splunkready_describe_certification",
      "splunkready_certify_external_trace",
      "splunkready_certify_mcp_transcript",
      "splunkready_certify_mcp_transcript_content",
      "splunkready_review_mcp_composition",
      "splunkready_check_hosted_model_access"
    ]);
    expect(summary.resources.map((resource) => resource.uri)).toEqual([
      "splunkready://certification/posture",
      "splunkready://examples/external-trace-pass",
      "splunkready://examples/mcp-transcript-pass",
      "splunkready://examples/pass-receipt",
      "splunkready://client-config/stdio",
      "splunkready://client-config/splunk-and-splunkready",
      "splunkready://client-config/claude-desktop",
      "splunkready://client-config/cursor",
      "splunkready://client-config/antigravity",
      "splunkready://client-config/zed",
      "splunkready://workflows/splunk-mcp-certification-loop",
      "splunkready://workflows/mcp-composition-scorecard",
      "splunkready://workflows/hosted-model-diagnostic"
    ]);
    expect(summary.resourceTemplates.map((template) => template.uriTemplate)).toEqual([
      "splunkready://receipts/{receiptId}"
    ]);
    expect(summary.prompts.map((prompt) => prompt.name)).toEqual([
      "splunkready_certify_mcp_transcript",
      "splunkready_capture_trace",
      "splunkready_explain_receipt",
      "splunkready_splunk_mcp_certification_loop",
      "splunkready_mcp_composition_review",
      "splunkready_hosted_model_diagnostic"
    ]);
    expect(summary.postureResource.contents[0].text).toContain("\"advisoryLlmOnly\": true");
    expect(summary.clientConfigResource.contents[0].text).toContain("\"splunkready\"");
    expect(summary.dualServerClientConfigResource.contents[0].text).toContain("\"splunk\"");
    expect(summary.dualServerClientConfigResource.contents[0].text).toContain("\"splunkready\"");
    expect(summary.dualServerClientConfigResource.contents[0].text).toContain("\"command\": \"npx\"");
    expect(summary.dualServerClientConfigResource.contents[0].text).toContain("\"mcp-remote\"");
    expect(summary.dualServerClientConfigResource.contents[0].text).toContain("SPLUNKREADY_SPLUNK_MCP_URL");
    expect(summary.dualServerClientConfigResource.contents[0].text).toContain(
      "Authorization: Bearer ${SPLUNKREADY_SPLUNK_MCP_TOKEN}"
    );
    expect(summary.dualServerClientConfigResource.contents[0].text).toContain(
      "\"certificationTool\": \"splunkready_certify_mcp_transcript\""
    );
    expect(summary.dualServerClientConfigResource.contents[0].text).toContain("SPLUNKREADY_SAIA_ENDPOINT");
    expect(summary.dualServerClientConfigResource.contents[0].text).toContain("SPLUNKREADY_SAIA_TOKEN");
    expect(summary.dualServerClientConfigResource.contents[0].text).toContain("SPLUNKREADY_SAIA_MCP_URL");
    expect(summary.dualServerClientConfigResource.contents[0].text).toContain("SPLUNKREADY_SAIA_MCP_TOKEN");
    expect(summary.dualServerClientConfigResource.contents[0].text).toContain("SAIA_MCP_URL");
    expect(summary.dualServerClientConfigResource.contents[0].text).toContain("SPLUNK_AI_ASSISTANT_MCP_URL");
    expect(summary.dualServerClientConfigResource.contents[0].text).toContain("SPLUNKREADY_SAIA_REALM");
    expect(summary.dualServerClientConfigResource.contents[0].text).toContain("SPLUNKREADY_SAIA_TENANT");
    expect(summary.dualServerClientConfigResource.contents[0].text).toContain(
      "\"hostedModelDiagnosticTool\": \"splunkready_check_hosted_model_access\""
    );
    expect(summary.claudeDesktopClientConfigResource.contents[0].text).toContain("\"command\": \"npx\"");
    expect(summary.claudeDesktopClientConfigResource.contents[0].text).toContain("\"mcp-remote\"");
    expect(summary.claudeDesktopClientConfigResource.contents[0].text).toContain("SPLUNKREADY_SPLUNK_MCP_URL");
    expect(summary.claudeDesktopClientConfigResource.contents[0].text).toContain(
      "Authorization: Bearer ${SPLUNKREADY_SPLUNK_MCP_TOKEN}"
    );
    expect(summary.claudeDesktopClientConfigResource.contents[0].text).toContain("\"command\": \"npm\"");
    expect(summary.claudeDesktopClientConfigResource.contents[0].text).toContain("\"cwd\": \"/path/to/SplunkReady\"");
    expect(summary.claudeDesktopClientConfigResource.contents[0].text).toContain("\"mcp\"");
    expect(summary.claudeDesktopClientConfigResource.contents[0].text).toContain("SPLUNKREADY_SAIA_ENDPOINT");
    expect(summary.claudeDesktopClientConfigResource.contents[0].text).toContain("SPLUNKREADY_SAIA_TOKEN");
    expect(summary.claudeDesktopClientConfigResource.contents[0].text).toContain("SPLUNKREADY_SAIA_MCP_URL");
    expect(summary.claudeDesktopClientConfigResource.contents[0].text).toContain("SPLUNKREADY_SAIA_MCP_TOKEN");
    expect(summary.claudeDesktopClientConfigResource.contents[0].text).toContain("SAIA_MCP_URL");
    expect(summary.claudeDesktopClientConfigResource.contents[0].text).toContain("SPLUNK_AI_ASSISTANT_MCP_URL");
    expect(summary.claudeDesktopClientConfigResource.contents[0].text).toContain("SPLUNKREADY_SAIA_REALM");
    expect(summary.claudeDesktopClientConfigResource.contents[0].text).toContain("SPLUNKREADY_SAIA_TENANT");
    expect(summary.claudeDesktopClientConfigResource.contents[0].text).toContain(
      "\"certificationTool\": \"splunkready_certify_mcp_transcript_content\""
    );
    expect(summary.claudeDesktopClientConfigResource.contents[0].text).toContain("\"mutation\": false");
    expect(summary.cursorClientConfigResource.contents[0].text).toContain("\"command\": \"npx\"");
    expect(summary.cursorClientConfigResource.contents[0].text).toContain("\"mcp-remote\"");
    expect(summary.cursorClientConfigResource.contents[0].text).toContain("SPLUNKREADY_SPLUNK_MCP_URL");
    expect(summary.cursorClientConfigResource.contents[0].text).toContain(
      "Authorization: Bearer ${SPLUNKREADY_SPLUNK_MCP_TOKEN}"
    );
    expect(summary.cursorClientConfigResource.contents[0].text).toContain("\"command\": \"npm\"");
    expect(summary.cursorClientConfigResource.contents[0].text).toContain("\"cwd\": \"/path/to/SplunkReady\"");
    expect(summary.cursorClientConfigResource.contents[0].text).toContain("\"preserveTranscript\"");
    expect(summary.cursorClientConfigResource.contents[0].text).toContain("SPLUNKREADY_SAIA_ENDPOINT");
    expect(summary.cursorClientConfigResource.contents[0].text).toContain("SPLUNKREADY_SAIA_TOKEN");
    expect(summary.cursorClientConfigResource.contents[0].text).toContain("SPLUNKREADY_SAIA_MCP_URL");
    expect(summary.cursorClientConfigResource.contents[0].text).toContain("SPLUNKREADY_SAIA_MCP_TOKEN");
    expect(summary.cursorClientConfigResource.contents[0].text).toContain("SAIA_MCP_URL");
    expect(summary.cursorClientConfigResource.contents[0].text).toContain("SPLUNK_AI_ASSISTANT_MCP_URL");
    expect(summary.cursorClientConfigResource.contents[0].text).toContain("SPLUNKREADY_SAIA_REALM");
    expect(summary.cursorClientConfigResource.contents[0].text).toContain("SPLUNKREADY_SAIA_TENANT");
    expect(summary.cursorClientConfigResource.contents[0].text).toContain(
      "\"hostedModelDiagnosticTool\": \"splunkready_check_hosted_model_access\""
    );
    expect(summary.cursorClientConfigResource.contents[0].text).toContain("\"certifyWith\": \"splunkready\"");
    expect(summary.cursorClientConfigResource.contents[0].text).toContain("\"mutation\": false");
    expect(summary.antigravityClientConfigResource.contents[0].text).toContain(
      "~/.gemini/antigravity/mcp_config.json"
    );
    expect(summary.antigravityClientConfigResource.contents[0].text).toContain("\"mcpServers\"");
    expect(summary.antigravityClientConfigResource.contents[0].text).toContain("\"mcp-remote\"");
    expect(summary.antigravityClientConfigResource.contents[0].text).toContain("\"command\": \"npm\"");
    expect(summary.antigravityClientConfigResource.contents[0].text).toContain("\"configShape\": \"mcpServers\"");
    expect(summary.antigravityClientConfigResource.contents[0].text).toContain(
      "\"certificationTool\": \"splunkready_certify_mcp_transcript_content\""
    );
    expect(summary.antigravityClientConfigResource.contents[0].text).toContain("\"mutation\": false");
    expect(summary.zedClientConfigResource.contents[0].text).toContain("~/.config/zed/settings.json");
    expect(summary.zedClientConfigResource.contents[0].text).toContain("\"context_servers\"");
    expect(summary.zedClientConfigResource.contents[0].text).toContain("\"mcp-remote\"");
    expect(summary.zedClientConfigResource.contents[0].text).toContain("\"command\": \"npm\"");
    expect(summary.zedClientConfigResource.contents[0].text).toContain("\"configShape\": \"context_servers\"");
    expect(summary.zedClientConfigResource.contents[0].text).toContain(
      "\"certificationTool\": \"splunkready_certify_mcp_transcript_content\""
    );
    expect(summary.zedClientConfigResource.contents[0].text).toContain("\"mutation\": false");
    expect(summary.certificationLoopResource.contents[0].text).toContain("Splunk MCP Certification Loop");
    expect(summary.certificationLoopResource.contents[0].text).toContain("Configure two MCP servers");
    expect(summary.compositionScorecardResource.contents[0].text).toContain("composition, not replacement");
    expect(summary.hostedModelDiagnosticResource.contents[0].text).toContain(
      "splunkready_check_hosted_model_access"
    );
    expect(summary.hostedModelDiagnosticResource.contents[0].text).toContain("saia_generate_spl");
    expect(summary.hostedModelDiagnosticResource.contents[0].text).toContain("saia_explain_spl");
    expect(summary.hostedModelDiagnosticResource.contents[0].text).toContain("saia_ask_splunk_question");
    expect(summary.hostedModelDiagnosticResource.contents[0].text).toContain("SPLUNKREADY_SAIA_ENDPOINT");
    expect(summary.hostedModelDiagnosticResource.contents[0].text).toContain("SPLUNKREADY_SAIA_TOKEN");
    expect(summary.hostedModelDiagnosticResource.contents[0].text).toContain("advisory only");
    expect(summary.receiptTemplateResource.contents[0].text).toContain("Verdict: READY");
    expect(summary.inlineTranscriptCertification).toMatchObject({
      status: "PASS",
      mutation: false,
      outDir: join(outDir, "mcp-inline-transcript-certification")
    });
    expect(summary.inlineTranscriptCertification.artifacts).toEqual(
      expect.arrayContaining([
        join(outDir, "mcp-inline-transcript-certification", "receipt-external-001.json"),
        join(outDir, "mcp-inline-transcript-certification", "uploaded-mcp-transcript.jsonl")
      ])
    );
    expect(summary.hostedModelAccess).toMatchObject({
      status: "PASS",
      permissionStatus: "OK",
      mutation: false,
      outDir: hostedModelAccessDir,
      requiredTools: [
        "saia_generate_spl",
        "saia_explain_spl",
        "saia_optimize_spl",
        "saia_ask_splunk_question"
      ],
      availableTools: [
        "saia_generate_spl",
        "saia_explain_spl",
        "saia_optimize_spl",
        "saia_ask_splunk_question"
      ],
      missingTools: [],
      passedTools: [
        "saia_generate_spl",
        "saia_explain_spl",
        "saia_optimize_spl",
        "saia_ask_splunk_question"
      ],
      blockedTools: [],
      remediation: { status: "CLEAR", blockerClass: "NONE", safeForPublicExport: true, mutation: false }
    });
    expect(summary.hostedModelAccess.toolResults.map((result: { toolName: string; status: string }) => `${result.toolName}:${result.status}`)).toEqual([
      "saia_generate_spl:PASS",
      "saia_explain_spl:PASS",
      "saia_optimize_spl:PASS",
      "saia_ask_splunk_question:PASS"
    ]);
    expect(summary.hostedModelAccess.artifacts).toEqual(
      expect.arrayContaining([
        join(hostedModelAccessDir, "hosted-model-proof.json"),
        join(hostedModelAccessDir, "hosted-model-diagnostic.json")
      ])
    );
    expect(summary.operatorLiveHostedModelStatus).toMatchObject({
      source: "splunkready-operator-live-hosted-model-status",
      artifactPath: "artifacts/live-hosted-model-diagnostic/hosted-model-diagnostic.json",
      safeForPublicExport: true,
      deterministicAuthority: true,
      mutation: false
    });
    expect(["NOT_PROVIDED", "PASS", "BLOCKED"]).toContain(summary.operatorLiveHostedModelStatus.status);
    expect(summary.operatorLiveHostedModelStatus.summary.length).toBeGreaterThan(0);
    expect(JSON.stringify(summary.operatorLiveHostedModelStatus)).not.toContain("Bearer");
    expect(JSON.stringify(summary.operatorLiveHostedModelStatus)).not.toContain("https://");
    expect(summary.describe).toMatchObject({
      resourceTemplates: ["splunkready://receipts/{receiptId}"]
    });
    expect(summary.transcriptPrompt.messages[0].content.text).toContain("strictImport=true");
    expect(summary.certificationLoopPrompt.messages[0].content.text).toContain("Splunk MCP server: splunk");
    expect(summary.certificationLoopPrompt.messages[0].content.text).toContain("two-server MCP client configuration");
    expect(summary.compositionReviewPrompt.messages[0].content.text).toContain("two MCP servers");
    expect(summary.hostedModelDiagnosticPrompt.messages[0].content.text).toContain(
      "splunkready_check_hosted_model_access"
    );
    expect(summary.hostedModelDiagnosticPrompt.messages[0].content.text).toContain("permissionStatus");
    expect(summary.hostedModelDiagnosticPrompt.messages[0].content.text).toContain("mutation=false");
    expect(summary.agentDrivenWorkflow.splunkMcpServerRole).toContain("read-only investigation");
    expect(summary.agentDrivenWorkflow.splunkReadyMcpServerRole).toContain("deterministic certification");
    expect(summary.agentDrivenWorkflow.stages).toHaveLength(4);
    expect(summary.clientWalkthrough.servers).toEqual([
      expect.objectContaining({ name: "splunk", existingMcpServer: true }),
      expect.objectContaining({ name: "splunkready", existingMcpServer: false })
    ]);
    expect(summary.clientWalkthrough.stages.map((stage) => stage.id)).toEqual([
      "client-discovers-two-servers",
      "splunk-mcp-investigates",
      "transcript-preserved",
      "splunkready-certifies",
      "receipt-is-authoritative"
    ]);
    expect(clientWalkthrough).toMatchObject({
      source: "splunkready-mcp-client-walkthrough",
      status: "PASS",
      mutation: false,
      deterministicAuthority: true,
      transcript: {
        splunkToolNames: ["splunk_get_knowledge_objects", "splunk_run_saved_search"],
        splunkToolCallCount: 2,
        includesSavedSearchExecution: true,
        evidenceRefs: ["evt-102", "evt-118", "evt-141"]
      },
      receipt: { status: "PASS", authoritative: true }
    });
    expect(clientWalkthrough.servers).toEqual([
      expect.objectContaining({ name: "splunk", existingMcpServer: true }),
      expect.objectContaining({ name: "splunkready", existingMcpServer: false })
    ]);
    expect(clientWalkthrough.stages.map((stage) => stage.server)).toEqual([
      "client",
      "splunk",
      "client",
      "splunkready",
      "splunkready"
    ]);
    expect(summary.tools.every((tool) => tool.destructiveHint === false)).toBe(true);
    expect(summary.artifacts).toEqual(
      expect.arrayContaining([
        join(outDir, "mcp-client-walkthrough.json"),
        join(outDir, "mcp-client-walkthrough.md"),
        join(outDir, "mcp-client-session.jsonl"),
        join(outDir, "mcp-client-session.md"),
        join(transcriptProofDir, "uploaded-mcp-transcript.jsonl"),
        join(transcriptProofDir, "trace-external.json"),
        join(transcriptProofDir, "receipt-external-001.json"),
        join(transcriptProofDir, "proof-audit.json")
      ])
    );

    expect(parseCliJsonOutput((await runCli(["verify-manifest", "--out", transcriptProofDir, "--json"])).stdout)).toMatchObject({
      command: "verify-manifest",
      status: "PASS",
      artifacts: [join(transcriptProofDir, "proof-manifest-verification.json")]
    });
  });

  it("runs MCP proof with a credential-free live mock Splunk MCP session", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-mcp-proof-live-mock-"));

    const output = parseCliJsonOutput((await runCli(["mcp-proof", "--out", outDir, "--live-mock", "--json"])).stdout);
    const summary = JSON.parse(await readFile(join(outDir, "mcp-proof-summary.json"), "utf8")) as {
      status: string;
      mutation: boolean;
      liveMockSplunkMcp: {
        status: string;
        routeState: string;
        toolNames: string[];
        evidenceRefs: string[];
        includesSavedSearchExecution: boolean;
        requestCount: number;
        responseCount: number;
        deterministicAuthority: boolean;
        mutation: boolean;
      };
    };
    const mockSession = await readFile(join(outDir, "mock-splunk-mcp-session.jsonl"), "utf8");
    const mockSessionMarkdown = await readFile(join(outDir, "mock-splunk-mcp-session.md"), "utf8");

    expect(output).toMatchObject({
      command: "mcp-proof",
      status: "PASS",
      artifacts: expect.arrayContaining([
        join(outDir, "mcp-proof-summary.json"),
        join(outDir, "mock-splunk-mcp-session.jsonl"),
        join(outDir, "mock-splunk-mcp-session.md")
      ])
    });
    expect(summary).toMatchObject({
      status: "PASS",
      mutation: false,
      liveMockSplunkMcp: {
        status: "PASS",
        routeState: "ok",
        toolNames: ["splunk_get_info", "splunk_get_knowledge_objects", "splunk_run_saved_search"],
        evidenceRefs: ["evt-102", "evt-118", "evt-141"],
        includesSavedSearchExecution: true,
        deterministicAuthority: true,
        mutation: false
      }
    });
    expect(summary.liveMockSplunkMcp.requestCount).toBeGreaterThanOrEqual(5);
    expect(summary.liveMockSplunkMcp.responseCount).toBe(summary.liveMockSplunkMcp.requestCount);
    expect(mockSession).toContain("splunk_run_saved_search");
    expect(mockSessionMarkdown).toContain("Saved-search execution: yes");
  }, 15_000);

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
        manifestStatus: string;
        mutation: boolean | null;
        agent: { name: string; version: string };
        receipt: { id: string; verdict: string; score: number; violations: number; evidenceRefs: number } | null;
        missions: string[];
        domains: string[];
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
          manifestStatus: "UNVERIFIED",
          mutation: false,
          agent: { name: "External MCP Agent", version: "jsonrpc-pass-001" },
          receipt: expect.objectContaining({ id: "receipt-external-001", verdict: "READY", score: 100, violations: 0, evidenceRefs: 6 }),
          missions: ["mission-security-lateral-movement-readiness"],
          domains: ["security"],
          manifest: expect.objectContaining({ aggregateSha256: expect.stringMatching(/^[a-f0-9]{64}$/), files: expect.any(Number) }),
          href: `?artifacts=${encodeURIComponent(passDir)}#receipt`
        }),
        expect.objectContaining({
          label: "External MCP Agent",
          proofDir: failDir,
          proofType: "external-trace",
          status: "FAIL",
          manifestStatus: "UNVERIFIED",
          mutation: false,
          agent: { name: "External MCP Agent", version: "jsonrpc-fail-001" },
          receipt: expect.objectContaining({ id: "receipt-external-001", verdict: "NOT READY", score: 0 }),
          missions: ["mission-security-lateral-movement-readiness"],
          domains: ["security"],
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

  it("runs a one-command LLM specimen proof with deterministic authority", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-llm-proof-"));
    const gemini = await startMockGeminiServer();
    const llmEnv = {
      GEMINI_API_KEY: "test-gemini-key",
      GEMINI_MODEL: "gemini-test",
      SPLUNKREADY_GEMINI_ENDPOINT_BASE_URL: gemini.url
    };

    try {
      const output = parseCliJsonOutput(
        (await runCli(["llm-proof", "--out", outDir, "--require-pass", "true", "--json"], process.cwd(), llmEnv)).stdout
      );

      expect(output).toMatchObject({
        command: "llm-proof",
        status: "PASS",
        artifacts: expect.arrayContaining([
          join(outDir, "trace-before.json"),
          join(outDir, "receipt-before-001.json"),
          join(outDir, "trace-after.json"),
          join(outDir, "receipt-after-001.json"),
          join(outDir, "proof-audit.json"),
          join(outDir, "llm-proof-summary.json")
        ])
      });
    } finally {
      await gemini.close();
    }

    const summary = JSON.parse(await readFile(join(outDir, "llm-proof-summary.json"), "utf8")) as {
      status: string;
      agent: { name: string; version: string };
      llmRole: string;
      passFailAuthority: string;
      before: { verdict: string; violations: number };
      after: { verdict: string; score: number; violations: number };
    };

    expect(gemini.prompts).toHaveLength(4);
    expect(summary).toMatchObject({
      status: "PASS",
      agent: { name: "Gemini Splunk MCP Agent", version: "gemini-test" },
      llmRole: "trace-producer",
      passFailAuthority: "deterministic-rule-engine",
      before: { verdict: "NOT READY", violations: 5 },
      after: { verdict: "READY", score: 100, violations: 0 }
    });
  });

  it("fails the one-command LLM proof before making model or Splunk calls when no Gemini key is configured", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-llm-proof-missing-key-"));

    await expect(runCli(["llm-proof", "--out", outDir], process.cwd(), { GEMINI_API_KEY: "" })).rejects.toMatchObject({
      stderr: expect.stringContaining("llm-proof requires GEMINI_API_KEY")
    });

    await expect(exists(join(outDir, "environment-contract.json"))).resolves.toBe(false);
    await expect(exists(join(outDir, "trace-before.json"))).resolves.toBe(false);
    await expect(exists(join(outDir, "llm-proof-summary.json"))).resolves.toBe(false);
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
      assistance: { generatedQuery: string; explanation: string; optimizedQuery: string; rationale: string; answer: string };
      toolCalls: string[];
      passedTools: string[];
      blockedTools: string[];
      toolResults: Array<{ toolName: string; status: string; contractAdvertised: boolean }>;
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
        generatedQuery: "search index=wineventlog host=win-finance-07 src=* earliest=-24h latest=now",
        explanation: "The SPL uses a broad index wildcard and a non-contract field.",
        optimizedQuery: "| savedsearch \"ES - Lateral Movement Auth Chain\"",
        rationale: "Prefer the validated saved search from the live contract.",
        answer: "Use authorized indexes and saved searches to preserve deployment-specific guardrails."
      },
      toolCalls: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"],
      passedTools: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"],
      blockedTools: []
    });
    expect(proof.toolResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ toolName: "saia_generate_spl", status: "PASS", contractAdvertised: true }),
        expect.objectContaining({ toolName: "saia_explain_spl", status: "PASS", contractAdvertised: true }),
        expect.objectContaining({ toolName: "saia_optimize_spl", status: "PASS", contractAdvertised: true }),
        expect.objectContaining({ toolName: "saia_ask_splunk_question", status: "PASS", contractAdvertised: true })
      ])
    );
    expect(mcp.calls.map((call) => call.params.name)).toEqual(
      expect.arrayContaining(["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"])
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
      blockerClass: string;
      requiredTools: string[];
      availableTools: string[];
      passedTools: string[];
      blockedTools: string[];
      toolResults: Array<{ toolName: string; status: string }>;
      remediation: { status: string; blockerClass: string; safeForPublicExport: boolean; mutation: boolean };
    };

    expect(diagnostic).toMatchObject({
      status: "PASS",
      mode: "live",
      mutation: false,
      blockerClass: "NONE",
      permission: {
        status: "OK",
        blockerClass: "NONE",
        message:
          "The current MCP credentials can invoke saia_generate_spl, saia_explain_spl, saia_optimize_spl, saia_ask_splunk_question for advisory SPL remediation."
      },
      requiredTools: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"],
      availableTools: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"],
      passedTools: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"],
      blockedTools: [],
      remediation: { status: "CLEAR", blockerClass: "NONE", safeForPublicExport: true, mutation: false }
    });
    expect(diagnostic.toolResults.map((result) => `${result.toolName}:${result.status}`)).toEqual([
      "saia_generate_spl:PASS",
      "saia_explain_spl:PASS",
      "saia_optimize_spl:PASS",
      "saia_ask_splunk_question:PASS"
    ]);
    expect(mcp.calls.map((call) => call.params.name)).toEqual(
      expect.arrayContaining(["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"])
    );
    expect(mcp.calls.map((call) => call.params.name)).not.toEqual(expect.arrayContaining(["splunk_run_query"]));
  });

  it("loads hosted-model live configuration from an explicit env file without writing secrets", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-hosted-model-diagnostic-env-file-"));
    const envDir = await mkdtemp(join(tmpdir(), "splunkready-env-file-"));
    const envFile = join(envDir, ".splunkready-test");
    const mcp = await startMockMcpServer();
    const saiaMcp = await startMockMcpServer();
    const token = "env-file-test-token";
    const saiaToken = "env-file-saia-token";

    await writeFile(
      envFile,
      [
        "SPLUNKREADY_LIVE_ENABLED=true",
        `SPLUNKREADY_SPLUNK_MCP_URL=${mcp.url}`,
        `SPLUNKREADY_SPLUNK_MCP_TOKEN=${token}`,
        `SPLUNKREADY_SAIA_MCP_URL=${saiaMcp.url}`,
        `SPLUNKREADY_SAIA_MCP_TOKEN=${saiaToken}`,
        "SAIA_REALM=us0",
        "SAIA_TENANT=tenant-1",
        "SPLUNKREADY_SAIA_ENABLED=true"
      ].join("\n"),
      "utf8"
    );

    try {
      const output = parseCliJsonOutput(
        (
          await runCli(
            [
              "hosted-model-diagnostic",
              "--mode",
              "live",
              "--env-file",
              envFile,
              "--out",
              outDir,
              "--require-pass",
              "true",
              "--json"
            ],
            process.cwd(),
            {
        SPLUNKREADY_LIVE_ENABLED: "",
        SPLUNKREADY_SPLUNK_MCP_URL: "",
        SPLUNKREADY_SPLUNK_MCP_TOKEN: "",
        SPLUNKREADY_SAIA_ENDPOINT: "",
        SPLUNKREADY_SAIA_TOKEN: "",
        SPLUNKREADY_SAIA_MCP_URL: "",
        SPLUNKREADY_SAIA_MCP_TOKEN: "",
        SAIA_MCP_URL: "",
        SAIA_MCP_TOKEN: "",
        SPLUNK_AI_ASSISTANT_MCP_URL: "",
        SPLUNK_AI_ASSISTANT_MCP_TOKEN: "",
        SPLUNKREADY_HOSTED_MODEL_MCP_URL: "",
        SPLUNKREADY_HOSTED_MODEL_MCP_TOKEN: "",
        SPLUNKREADY_SAIA_REALM: "",
        SPLUNKREADY_SAIA_TENANT: "",
        SPLUNKREADY_SAIA_SF_TOKEN: "",
        SPLUNKREADY_SAIA_ENABLED: ""
      }
          )
        ).stdout
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
      await saiaMcp.close();
    }

    const diagnosticText = await readFile(join(outDir, "hosted-model-diagnostic.json"), "utf8");
    const proofText = await readFile(join(outDir, "hosted-model-proof.json"), "utf8");
    const diagnostic = JSON.parse(diagnosticText) as {
      status: string;
      blockerClass: string;
      permission: { status: string; blockerClass: string };
      setup: {
        hostedModelTransport: string;
        requiredEnvironment: Array<{ name: string; status: string }>;
        optionalEnvironment: Array<{ name: string; status: string; sourceName?: string; aliases?: string[] }>;
      };
    };

    expect(diagnostic).toMatchObject({
      status: "PASS",
      blockerClass: "NONE",
      permission: { status: "OK", blockerClass: "NONE" },
      setup: {
        hostedModelTransport: "dedicated-saia-mcp",
        requiredEnvironment: [
          { name: "SPLUNKREADY_LIVE_ENABLED", status: "set" },
          { name: "SPLUNKREADY_SPLUNK_MCP_URL", status: "set" },
          { name: "SPLUNKREADY_SPLUNK_MCP_TOKEN", status: "set" }
        ]
      }
    });
    expect(diagnostic.setup.optionalEnvironment).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "SPLUNKREADY_SAIA_ENABLED", status: "set" }),
        expect.objectContaining({
          name: "SPLUNKREADY_SAIA_ENDPOINT",
          aliases: expect.arrayContaining(["SPLUNKREADY_SAIA_MCP_URL", "SAIA_MCP_URL", "SPLUNK_AI_ASSISTANT_MCP_URL"]),
          sourceName: "SPLUNKREADY_SAIA_MCP_URL",
          status: "set"
        }),
        expect.objectContaining({
          name: "SPLUNKREADY_SAIA_TOKEN",
          aliases: expect.arrayContaining(["SPLUNKREADY_SAIA_MCP_TOKEN", "SAIA_MCP_TOKEN", "SPLUNK_AI_ASSISTANT_MCP_TOKEN"]),
          sourceName: "SPLUNKREADY_SAIA_MCP_TOKEN",
          status: "set"
        }),
        expect.objectContaining({
          name: "SPLUNKREADY_SAIA_REALM",
          aliases: expect.arrayContaining(["SAIA_REALM"]),
          sourceName: "SAIA_REALM",
          status: "set"
        }),
        expect.objectContaining({
          name: "SPLUNKREADY_SAIA_TENANT",
          aliases: expect.arrayContaining(["SAIA_TENANT"]),
          sourceName: "SAIA_TENANT",
          status: "set"
        })
      ])
    );
    expect(diagnosticText).not.toContain(token);
    expect(diagnosticText).not.toContain(saiaToken);
    expect(diagnosticText).not.toContain("tenant-1");
    expect(proofText).not.toContain(token);
    expect(proofText).not.toContain(saiaToken);
    expect(proofText).not.toContain("tenant-1");
    expect(mcp.calls.map((call) => call.params.name)).not.toEqual(
      expect.arrayContaining(["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"])
    );
    expect(saiaMcp.calls.map((call) => call.params.name)).toEqual(
      expect.arrayContaining(["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"])
    );
    expect(mcp.calls.map((call) => call.params.name)).not.toEqual(expect.arrayContaining(["splunk_run_query"]));
  });

  it("records per-tool hosted-model results when one SAIA tool is blocked", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-hosted-model-diagnostic-partial-"));
    const mcp = await startMockMcpServer({
      hostedModelErrorByToolName: {
        saia_ask_splunk_question: "Action forbidden: saia_ask_splunk_question requires Splunk AI Assistant chat access."
      }
    });
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
        status: "BLOCKED",
        artifacts: expect.arrayContaining([join(outDir, "hosted-model-proof.json"), join(outDir, "hosted-model-diagnostic.json")])
      });
    } finally {
      await mcp.close();
    }

    const proof = JSON.parse(await readFile(join(outDir, "hosted-model-proof.json"), "utf8")) as {
      status: string;
      assistance: null;
      passedTools: string[];
      blockedTools: string[];
      toolResults: Array<{ toolName: string; status: string; error?: string }>;
      error: string;
    };
    const diagnostic = JSON.parse(await readFile(join(outDir, "hosted-model-diagnostic.json"), "utf8")) as {
      status: string;
      passedTools: string[];
      blockedTools: string[];
      toolResults: Array<{ toolName: string; status: string; error?: string }>;
      blockerClass: string;
      remediation: { status: string; blockerClass: string; operatorChecks: string[] };
      permission: { status: string; blockerClass: string; error: string };
    };

    expect(proof).toMatchObject({
      status: "BLOCKED",
      assistance: null,
      passedTools: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl"],
      blockedTools: ["saia_ask_splunk_question"],
      error: expect.stringContaining("saia_ask_splunk_question")
    });
    expect(diagnostic).toMatchObject({
      status: "BLOCKED",
      passedTools: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl"],
      blockedTools: ["saia_ask_splunk_question"],
      blockerClass: "SAIA_ACTION_FORBIDDEN",
      remediation: { status: "ACTION_REQUIRED", blockerClass: "SAIA_ACTION_FORBIDDEN" },
      permission: {
        status: "BLOCKED",
        blockerClass: "SAIA_ACTION_FORBIDDEN",
        error: expect.stringContaining("saia_ask_splunk_question")
      }
    });
    expect(diagnostic.remediation.operatorChecks).toEqual(
      expect.arrayContaining(["Grant the Splunk/MCP user permission or entitlement to invoke saia_ask_splunk_question."])
    );
    expect(proof.toolResults.map((result) => `${result.toolName}:${result.status}`)).toEqual([
      "saia_generate_spl:PASS",
      "saia_explain_spl:PASS",
      "saia_optimize_spl:PASS",
      "saia_ask_splunk_question:BLOCKED"
    ]);
    expect(diagnostic.toolResults.map((result) => `${result.toolName}:${result.status}`)).toEqual(
      proof.toolResults.map((result) => `${result.toolName}:${result.status}`)
    );
    expect(mcp.calls.map((call) => call.params.name)).toEqual(
      expect.arrayContaining(["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"])
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
        status: "BLOCKED",
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
      blockedTools: string[];
      blockerClass: string;
      remediation: { status: string; blockerClass: string; operatorChecks: string[]; rerunCommand: string };
      permission: { status: string; blockerClass: string; error: string; requiredActions: string[] };
    };
    const proof = JSON.parse(await readFile(join(outDir, "hosted-model-proof.json"), "utf8")) as {
      status: string;
      assistance: null;
      blockedTools: string[];
    };

    expect(proof).toMatchObject({
      status: "BLOCKED",
      assistance: null,
      blockedTools: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"]
    });
    expect(diagnostic).toMatchObject({
      status: "BLOCKED",
      mutation: false,
      blockedTools: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"],
      blockerClass: "SAIA_ACTION_FORBIDDEN",
      remediation: { status: "ACTION_REQUIRED", blockerClass: "SAIA_ACTION_FORBIDDEN" },
      permission: {
        status: "BLOCKED",
        blockerClass: "SAIA_ACTION_FORBIDDEN",
        error: expect.stringContaining("saia_generate_spl: Hosted-model SAIA action forbidden")
      }
    });
    expect(diagnostic.permission.requiredActions).toEqual(
      expect.arrayContaining([
        "Grant the Splunk/MCP user permission to invoke saia_generate_spl.",
        "Grant the Splunk/MCP user permission to invoke saia_explain_spl.",
        "Grant the Splunk/MCP user permission to invoke saia_optimize_spl.",
        "Grant the Splunk/MCP user permission to invoke saia_ask_splunk_question."
      ])
    );
    expect(diagnostic.remediation.operatorChecks).toEqual(
      expect.arrayContaining([
        "Grant the Splunk/MCP user permission or entitlement to invoke saia_generate_spl.",
        "Grant the Splunk/MCP user permission or entitlement to invoke saia_ask_splunk_question."
      ])
    );
    expect(diagnostic.remediation.rerunCommand).toContain("hosted-model-diagnostic --mode live");
    expect(mcp.calls.map((call) => call.params.name)).not.toEqual(expect.arrayContaining(["splunk_run_query"]));
  });

  it("distinguishes downstream SAIA cloud 404s from local route failures", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-hosted-model-diagnostic-not-found-"));
    const mcp = await startMockMcpServer({
      hostedModelErrorText: "404 Client Error: Not Found for url: https://splunk.example.invalid/saia/explain"
    });
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
        status: "BLOCKED",
        artifacts: expect.arrayContaining([join(outDir, "hosted-model-diagnostic.json")])
      });
    } finally {
      await mcp.close();
    }

    const diagnostic = JSON.parse(await readFile(join(outDir, "hosted-model-diagnostic.json"), "utf8")) as {
      status: string;
      mutation: boolean;
      blockerClass: string;
      remediation: { status: string; blockerClass: string; operatorChecks: string[]; rerunCommand: string };
      permission: { status: string; blockerClass: string; message: string; error: string; requiredActions: string[] };
    };

    expect(diagnostic).toMatchObject({
      status: "BLOCKED",
      mutation: false,
      blockerClass: "SAIA_CLOUD_ROUTE_NOT_FOUND",
      remediation: { status: "ACTION_REQUIRED", blockerClass: "SAIA_CLOUD_ROUTE_NOT_FOUND" },
      permission: {
        status: "BLOCKED",
        blockerClass: "SAIA_CLOUD_ROUTE_NOT_FOUND",
        message:
          "The MCP contract advertises hosted-model tools and splunkd serves the local SAIA routes, but the downstream Splunk AI Assistant cloud route returned not found.",
        error: expect.stringContaining("404 Client Error: Not Found")
      }
    });
    expect(diagnostic.permission.error).toContain("[REDACTED_URL]");
    expect(diagnostic.permission.error).not.toContain("splunk.example.invalid");
    expect(diagnostic.permission.requiredActions).toEqual(
      expect.arrayContaining([
        "Keep the Splunk MCP endpoint unchanged; local SAIA management routes are registered and served by splunkd.",
        "Confirm the tenant is entitled to the SAIA v2 hosted-model SPL endpoints used by Splunk AI Assistant."
      ])
    );
    expect(diagnostic.permission.requiredActions).not.toEqual(
      expect.arrayContaining(["Grant the Splunk/MCP user permission to invoke saia_explain_spl."])
    );
    expect(diagnostic.remediation.operatorChecks).toEqual(
      expect.arrayContaining([
        "Do not change the local Splunk MCP endpoint yet; SplunkReady proved the local SAIA management routes are served by splunkd.",
        "Confirm the tenant is provisioned for the SAIA v2 hosted-model SPL API used by generate, explain, optimize, and ask-splunk-question."
      ])
    );
    expect(diagnostic.remediation.rerunCommand).toContain("--env-file <operator-env-file>");
    expect(mcp.managementCalls.map((call) => call.path)).toEqual(
      expect.arrayContaining([
        "/servicesNS/-/Splunk_AI_Assistant_Cloud/generatespl",
        "/servicesNS/-/Splunk_AI_Assistant_Cloud/explainspl",
        "/servicesNS/-/Splunk_AI_Assistant_Cloud/optimizespl",
        "/servicesNS/-/Splunk_AI_Assistant_Cloud/ask"
      ])
    );
  });

  it("classifies SAIA app REST namespace 404s as unregistered REST handlers", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-hosted-model-diagnostic-rest-handlers-"));
    const mcp = await startMockMcpServer({
      hostedModelErrorText: "404 Client Error: Not Found for url: https://splunk.example.invalid/mcp/saia",
      saiaManagementRestStatus: 404
    });
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
        status: "BLOCKED",
        artifacts: expect.arrayContaining([join(outDir, "hosted-model-diagnostic.json")])
      });
    } finally {
      await mcp.close();
    }

    const diagnostic = JSON.parse(await readFile(join(outDir, "hosted-model-diagnostic.json"), "utf8")) as {
      status: string;
      mutation: boolean;
      blockerClass: string;
      remediation: { status: string; blockerClass: string; summary: string; operatorChecks: string[] };
      permission: { status: string; blockerClass: string; message: string; error: string; requiredActions: string[] };
      restHandlerProbe: {
        status: string;
        query: string;
        error: string;
        mutation: boolean;
        managementRoutes: Array<{ method: string; path: string; status: string; httpStatus: number }>;
      };
    };

    expect(diagnostic).toMatchObject({
      status: "BLOCKED",
      mutation: false,
      blockerClass: "SAIA_REST_HANDLERS_NOT_REGISTERED",
      remediation: {
        status: "ACTION_REQUIRED",
        blockerClass: "SAIA_REST_HANDLERS_NOT_REGISTERED",
        summary:
          "The MCP contract advertises hosted-model tools, but Splunk AI Assistant's splunkd REST handlers are not registered for the SAIA routes."
      },
      permission: {
        status: "BLOCKED",
        blockerClass: "SAIA_REST_HANDLERS_NOT_REGISTERED",
        message:
          "The MCP contract advertises hosted-model tools, but Splunk AI Assistant REST handlers are not registered with splunkd for the advertised SAIA routes.",
        error: expect.stringContaining("REST namespace Splunk_AI_Assistant_Cloud returned 404")
      }
    });
    expect(diagnostic.permission.error).toContain("[REDACTED_URL]");
    expect(diagnostic.permission.error).not.toContain("splunk.example.invalid");
    expect(diagnostic.restHandlerProbe).toMatchObject({
      status: "NOT_REGISTERED",
      mutation: false,
      query: "| rest /servicesNS/nobody/Splunk_AI_Assistant_Cloud",
      error: expect.stringContaining("Splunk_AI_Assistant_Cloud returned 404")
    });
    expect(diagnostic.restHandlerProbe.managementRoutes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: "GET",
          path: "/servicesNS/-/Splunk_AI_Assistant_Cloud/generatespl",
          status: "NOT_REGISTERED",
          httpStatus: 404
        })
      ])
    );
    expect(diagnostic.permission.requiredActions).toEqual(
      expect.arrayContaining([
        "Restart splunkd after installing or activating Splunk AI Assistant so its Python REST handlers register with splunkd.",
        "Probe the Splunk AI Assistant app REST namespace from the operator shell; the Splunk_AI_Assistant_Cloud namespace must not return 404.",
        "If restart does not register the namespace, reinstall Splunk_AI_Assistant_Cloud v2.0.0 or later and confirm the app contains its Python REST handlers."
      ])
    );
    expect(diagnostic.remediation.operatorChecks).toEqual(
      expect.arrayContaining([
        "Restart splunkd after the Splunk AI Assistant install, upgrade, or cloud-connect activation.",
        "Confirm `$SPLUNK_HOME/etc/apps/Splunk_AI_Assistant_Cloud/bin/` contains the app's Python REST handler files."
      ])
    );
    expect(mcp.managementCalls.map((call) => call.path)).toEqual(
      expect.arrayContaining([
        "/servicesNS/-/Splunk_AI_Assistant_Cloud/generatespl",
        "/servicesNS/-/Splunk_AI_Assistant_Cloud/ask"
      ])
    );
    expect(mcp.calls.map((call) => call.params.name)).not.toEqual(expect.arrayContaining(["splunk_run_query"]));
  });

  it("classifies partially registered SAIA app REST routes separately from total handler absence", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-hosted-model-diagnostic-partial-routes-"));
    const mcp = await startMockMcpServer({
      hostedModelErrorText: "404 Client Error: Not Found for url: https://splunk.example.invalid/mcp/saia",
      saiaManagementRestStatusByPath: {
        "/servicesNS/nobody/Splunk_AI_Assistant_Cloud": 200,
        "/servicesNS/-/Splunk_AI_Assistant_Cloud/generatespl": 400,
        "/servicesNS/-/Splunk_AI_Assistant_Cloud/explainspl": 400,
        "/servicesNS/-/Splunk_AI_Assistant_Cloud/optimizespl": 400,
        "/servicesNS/-/Splunk_AI_Assistant_Cloud/ask": 404
      }
    });
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
        status: "BLOCKED",
        artifacts: expect.arrayContaining([join(outDir, "hosted-model-diagnostic.json")])
      });
    } finally {
      await mcp.close();
    }

    const diagnostic = JSON.parse(await readFile(join(outDir, "hosted-model-diagnostic.json"), "utf8")) as {
      status: string;
      mutation: boolean;
      blockerClass: string;
      remediation: { status: string; blockerClass: string; summary: string; operatorChecks: string[] };
      permission: { status: string; blockerClass: string; message: string; error: string; requiredActions: string[] };
      restHandlerProbe: {
        status: string;
        error: string;
        managementRoutes: Array<{ method: string; path: string; status: string; httpStatus: number }>;
      };
    };

    expect(diagnostic).toMatchObject({
      status: "BLOCKED",
      mutation: false,
      blockerClass: "SAIA_REST_HANDLERS_PARTIALLY_REGISTERED",
      remediation: {
        status: "ACTION_REQUIRED",
        blockerClass: "SAIA_REST_HANDLERS_PARTIALLY_REGISTERED",
        summary:
          "The MCP contract advertises hosted-model tools, but Splunk AI Assistant's splunkd REST handlers are only partially registered for the SAIA routes."
      },
      permission: {
        status: "BLOCKED",
        blockerClass: "SAIA_REST_HANDLERS_PARTIALLY_REGISTERED",
        message:
          "The MCP contract advertises hosted-model tools, but Splunk AI Assistant REST handlers are only partially registered with splunkd for the advertised SAIA routes.",
        error: expect.stringContaining("only partially registered")
      }
    });
    expect(diagnostic.restHandlerProbe).toMatchObject({
      status: "PARTIALLY_REGISTERED",
      error: expect.stringContaining("only partially registered")
    });
    expect(diagnostic.restHandlerProbe.managementRoutes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "/servicesNS/-/Splunk_AI_Assistant_Cloud/generatespl",
          status: "PASS",
          httpStatus: 400
        }),
        expect.objectContaining({
          path: "/servicesNS/-/Splunk_AI_Assistant_Cloud/ask",
          status: "NOT_REGISTERED",
          httpStatus: 404
        })
      ])
    );
    expect(diagnostic.permission.requiredActions).toEqual(
      expect.arrayContaining([
        "Compare the Splunk MCP Server app's SAIA endpoint metadata against the Splunk AI Assistant app routes served by splunkd.",
        "If local routes are present but hosted-model calls still return 404, confirm the tenant is not a Splunk Trial stack and is provisioned for Splunk AI Assistant cloud connected hosted-model endpoints."
      ])
    );
    expect(diagnostic.remediation.operatorChecks).toEqual(
      expect.arrayContaining([
        "Confirm every advertised SAIA handler route is present; partial route registration means the app or MCP tool metadata is not aligned.",
        "If local routes are present but hosted-model calls still return 404, confirm the tenant is not a Splunk Trial stack and is provisioned for Splunk AI Assistant cloud connected hosted-model endpoints."
      ])
    );
  });

  it("writes blocked hosted-model artifacts when live SAIA config is not exported", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-hosted-model-diagnostic-missing-config-"));
    const env = {
      SPLUNKREADY_LIVE_ENABLED: "",
      SPLUNKREADY_SPLUNK_MCP_URL: "",
      SPLUNKREADY_SPLUNK_MCP_TOKEN: "",
      SPLUNKREADY_SAIA_ENABLED: ""
    };

    const output = parseCliJsonOutput(
      (await runCli(["hosted-model-diagnostic", "--mode", "live", "--out", outDir, "--json"], process.cwd(), env)).stdout
    );

    expect(output).toMatchObject({
      command: "hosted-model-diagnostic",
      status: "BLOCKED",
      artifacts: expect.arrayContaining([
        join(outDir, "hosted-model-proof.json"),
        join(outDir, "hosted-model-diagnostic.json")
      ])
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

    const proof = JSON.parse(await readFile(join(outDir, "hosted-model-proof.json"), "utf8")) as {
      status: string;
      mutation: boolean;
      setup: { configured: boolean; requiredEnvironment: Array<{ name: string; status: string }> };
      error: string;
    };
    const diagnostic = JSON.parse(await readFile(join(outDir, "hosted-model-diagnostic.json"), "utf8")) as {
      status: string;
      contract: { id: string };
      remediation: { status: string; blockerClass: string; operatorChecks: string[] };
      permission: { status: string; requiredActions: string[] };
      setup: { configured: boolean };
    };

    expect(proof).toMatchObject({
      status: "BLOCKED",
      mutation: false,
      setup: {
        configured: false,
        requiredEnvironment: [
          { name: "SPLUNKREADY_LIVE_ENABLED", status: "missing" },
          { name: "SPLUNKREADY_SPLUNK_MCP_URL", status: "missing" },
          { name: "SPLUNKREADY_SPLUNK_MCP_TOKEN", status: "missing" }
        ]
      }
    });
    expect(proof.error).toContain("SPLUNKREADY_LIVE_ENABLED:missing");
    expect(JSON.stringify(proof)).not.toContain("test-token");
    expect(diagnostic).toMatchObject({
      status: "BLOCKED",
      contract: { id: "live-hosted-model-unconfigured" },
      remediation: { status: "ACTION_REQUIRED", blockerClass: "LIVE_CONFIG_MISSING" },
      permission: { status: "BLOCKED" },
      setup: { configured: false }
    });
    expect(diagnostic.permission.requiredActions).toEqual(
      expect.arrayContaining(["Export SPLUNKREADY_SPLUNK_MCP_TOKEN without committing or printing it."])
    );
    expect(diagnostic.remediation.operatorChecks).toEqual(
      expect.arrayContaining(["Export SPLUNKREADY_SPLUNK_MCP_TOKEN without committing or printing it."])
    );
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
      proofMode: { type: string; fallbackAllowed: boolean; rationale: string };
      setupRequirements: Array<{ id: string; satisfied: boolean; operatorOwned: boolean }>;
      fallbackPolicy: {
        genericLiveCommand: string;
        flagshipProofCommand: string;
      };
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
      proofMode: {
        type: "strict-flagship-security",
        fallbackAllowed: false
      },
      fallbackPolicy: {
        genericLiveCommand: "live-proof",
        flagshipProofCommand: "live-security-proof"
      },
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
    expect(report.proofMode.rationale).toContain("does not fall back to generic _internal proof");
    expect(report.setupRequirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "saved-search", satisfied: true, operatorOwned: true }),
        expect.objectContaining({ id: "evidence-rows", satisfied: true, operatorOwned: true }),
        expect.objectContaining({ id: "evidence-identifiers", satisfied: true, operatorOwned: true }),
        expect.objectContaining({ id: "operator-owned-setup", satisfied: true, operatorOwned: true })
      ])
    );
    expect(report.nextActions).toEqual(
      expect.arrayContaining([
        "Run live-security-proof with LLM mode enabled; the deployment has the saved-search evidence needed for the flagship live security path."
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
      proofMode: { type: string; fallbackAllowed: boolean; rationale: string };
      setupRequirements: Array<{ id: string; satisfied: boolean; operatorOwned: boolean }>;
      fallbackPolicy: {
        genericLiveCommand: string;
        genericLiveDescription: string;
        flagshipProofCommand: string;
      };
      requiredSavedSearch: {
        present: boolean;
        nearbySavedSearches: string[];
        run: { attempted: boolean; reason: string };
      };
      blockers: string[];
    };

    expect(report).toMatchObject({
      status: "BLOCKED",
      proofMode: {
        type: "strict-flagship-security",
        fallbackAllowed: false
      },
      fallbackPolicy: {
        genericLiveCommand: "live-proof",
        flagshipProofCommand: "live-security-proof"
      },
      requiredSavedSearch: {
        present: false,
        nearbySavedSearches: ["search::Errors in the last 24 hours"],
        run: {
          attempted: false,
          reason: "Exact flagship saved search is not present in the live contract."
        }
      }
    });
    expect(report.proofMode.rationale).toContain("does not fall back to generic _internal proof");
    expect(report.fallbackPolicy.genericLiveDescription).toContain("generic live MCP evidence");
    expect(report.setupRequirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "saved-search", satisfied: false, operatorOwned: true }),
        expect.objectContaining({ id: "evidence-rows", satisfied: false, operatorOwned: true }),
        expect.objectContaining({ id: "evidence-identifiers", satisfied: false, operatorOwned: true }),
        expect.objectContaining({ id: "operator-owned-setup", satisfied: true, operatorOwned: true })
      ])
    );
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
      validation: {
        status: "PASS" | "FAIL";
        expectedFiles: string[];
        checks: Array<{ id: string; status: "PASS" | "FAIL"; path: string; detail: string }>;
      };
      operatorWarnings: string[];
      cleanupGuidance: string[];
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
    expect(manifest.validation.status).toBe("PASS");
    expect(manifest.validation.expectedFiles).toEqual(
      expect.arrayContaining([
        "SplunkEnterpriseSecuritySuite/default/indexes.conf",
        "SplunkEnterpriseSecuritySuite/default/savedsearches.conf",
        "lateral-movement-events.csv",
        "README.md"
      ])
    );
    expect(manifest.validation.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "saved-search-stanza", status: "PASS" }),
        expect.objectContaining({ id: "index-stanza", status: "PASS" }),
        expect.objectContaining({ id: "sample-event-refs", status: "PASS" }),
        expect.objectContaining({ id: "operator-owned-boundary", status: "PASS" }),
        expect.objectContaining({ id: "existing-es-warning", status: "PASS" }),
        expect.objectContaining({ id: "cleanup-guidance", status: "PASS" })
      ])
    );
    expect(manifest.operatorWarnings.join(" ")).toContain("no Splunk write operation");
    expect(manifest.operatorWarnings.join(" ")).toContain("do not overwrite");
    expect(manifest.cleanupGuidance.join(" ")).toContain("Cleanup is operator-owned");
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
    expect(readme).toContain("Cleanup is operator-owned and outside SplunkReady.");
    expect(readme).toContain("Do not run destructive cleanup against production data");
    expect(readme).toContain("live-security-check --out artifacts/live-security-check --json");
    expect(readme).toContain("live-security-proof --out artifacts/live-security-proof --json");
  });

  it("detects mismatched live security kit files after generation", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-live-security-kit-invalid-"));

    await runCli(["live-security-kit", "--out", outDir, "--json"]);
    await writeFile(
      join(outDir, "SplunkEnterpriseSecuritySuite", "default", "savedsearches.conf"),
      "[Wrong Saved Search]\nsearch = index=main\n",
      "utf8"
    );

    const validation = await validateLiveSecurityKit(outDir);

    expect(validation.status).toBe("FAIL");
    expect(validation.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "saved-search-stanza", status: "FAIL" }),
        expect.objectContaining({ id: "saved-search-index", status: "FAIL" }),
        expect.objectContaining({ id: "saved-search-window", status: "FAIL" }),
        expect.objectContaining({ id: "saved-search-event-ref", status: "FAIL" })
      ])
    );
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
        availableTools: [
          "saia_generate_spl",
          "saia_explain_spl",
          "saia_optimize_spl",
          "saia_ask_splunk_question"
        ],
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
        availableTools: [
          "saia_generate_spl",
          "saia_explain_spl",
          "saia_optimize_spl",
          "saia_ask_splunk_question"
        ],
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

  it("runs live proof through the credential-free mock Splunk MCP path", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-live-mock-proof-"));
    const output = parseCliJsonOutput(
      (
        await execFileAsync(process.execPath, [cliPath, "live-proof", "--out", outDir, "--live-mock", "--json"], {
          cwd: process.cwd(),
          env: { HOME: process.env.HOME ?? "", PATH: process.env.PATH ?? "" }
        })
      ).stdout
    );

    expect(output).toMatchObject({
      command: "live-proof",
      status: "PASS",
      artifacts: expect.arrayContaining([
        join(outDir, "environment-contract.json"),
        join(outDir, "live-candidates.json"),
        join(outDir, "live-derived-mission.json"),
        join(outDir, "trace-before.json"),
        join(outDir, "receipt-before-001.json"),
        join(outDir, "policy-patch.json"),
        join(outDir, "trace-after.json"),
        join(outDir, "receipt-after-001.json"),
        join(outDir, "live-proof-summary.json")
      ])
    });

    const summary = JSON.parse(await readFile(join(outDir, "live-proof-summary.json"), "utf8")) as {
      mode: string;
      mutation: boolean;
      failToPass: boolean;
      proofLoop: string;
      derivedMission: { strategy: string };
      before: { verdict: string; violations: number };
      after: { verdict: string; score: number; violations: number };
    };

    expect(summary).toMatchObject({
      mode: "live",
      mutation: false,
      failToPass: true,
      proofLoop: "fail-to-pass",
      derivedMission: { strategy: "saved-search-with-evidence" },
      before: { verdict: "NOT READY" },
      after: { verdict: "READY", score: 100, violations: 0 }
    });
    expect(summary.before.violations).toBeGreaterThan(0);
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
