#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";

const root = process.cwd();

const argValue = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};

const sourceDir = argValue("--source", "submission-evidence/official-splunk-mcp-live");
const outPath = argValue("--out", join(sourceDir, "official-splunk-mcp-live-audit.json"));
const requirePass = process.argv.includes("--require-pass");

const readJson = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const readJsonl = (path) =>
  readFileSync(join(root, path), "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
const repoPath = (path) => (isAbsolute(path) ? path : join(root, path));

const summaryPath = join(sourceDir, "official-splunk-mcp-live-summary.json");
const sessionPath = join(sourceDir, "official-splunk-mcp-live-session.redacted.jsonl");
const summary = readJson(summaryPath);
const session = readJsonl(sessionPath);

const requestFrames = session.filter((frame) => frame.direction === "request");
const responseFrames = session.filter((frame) => frame.direction === "response");
const toolCallRequests = requestFrames.filter((frame) => frame.method === "tools/call");
const calledTools = toolCallRequests.map((frame) => frame.params?.name).filter(Boolean).sort();
const requiredRuntimeTools = ["splunk_get_info", "splunk_get_knowledge_objects", "splunk_run_saved_search"];
const hostedModelTools = ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"];
const allText = JSON.stringify({ summary, session });

const checks = [];
const check = (id, pass, evidence, failure) => {
  checks.push({ id, status: pass ? "PASS" : "FAIL", evidence, failure: pass ? null : failure });
};

check(
  "official-splunk-mcp-server",
  summary.status === "PASS" && summary.serverInfo?.name === "Splunk_MCP_Server" && summary.serverInfo?.version === "1.2.0",
  { status: summary.status, serverInfo: summary.serverInfo },
  "Evidence does not prove the installed official Splunk MCP Server handled the session."
);

check(
  "official-splunk-mcp-tools-listed",
  summary.toolCount >= 10 && requiredRuntimeTools.every((tool) => summary.requiredToolsPresent?.includes(tool)),
  { toolCount: summary.toolCount, requiredToolsPresent: summary.requiredToolsPresent },
  "Official Splunk MCP tools/list did not expose the required read-only tools."
);

check(
  "official-splunk-mcp-saia-tools-advertised",
  hostedModelTools.every((tool) => summary.hostedModelToolsPresent?.includes(tool)),
  { hostedModelToolsPresent: summary.hostedModelToolsPresent },
  "Official Splunk MCP tools/list did not advertise the full hosted-model SAIA tool surface."
);

check(
  "official-splunk-mcp-runtime-tool-calls",
  requiredRuntimeTools.every((tool) => calledTools.includes(tool)) && responseFrames.length >= toolCallRequests.length,
  { calledTools, toolCallRequestCount: toolCallRequests.length, responseFrameCount: responseFrames.length },
  "Redacted JSON-RPC transcript does not contain request/response evidence for required runtime tools/call frames."
);

check(
  "official-splunk-mcp-saved-search-executed",
  summary.savedSearchCallAttempted === true && summary.savedSearchStatus === "PASS",
  { savedSearchCallAttempted: summary.savedSearchCallAttempted, savedSearchStatus: summary.savedSearchStatus },
  "Official Splunk MCP saved-search execution was not proven."
);

check(
  "official-splunk-mcp-public-redaction",
  summary.redaction?.endpointWritten === false &&
    summary.redaction?.tokenWritten === false &&
    summary.redaction?.localUserWritten === false &&
    !allText.includes("SPLUNKREADY_SPLUNK_MCP_TOKEN") &&
    !/Bearer\s+[A-Za-z0-9._~+/=-]+/.test(allText) &&
    !/localhost:8089|services\/mcp|arshdeepsingh/i.test(allText),
  summary.redaction,
  "Official Splunk MCP evidence contains endpoint, token, or local-user material."
);

check(
  "official-splunk-mcp-no-mutation",
  summary.mutation === false && summary.deterministicAuthority === true,
  { mutation: summary.mutation, deterministicAuthority: summary.deterministicAuthority },
  "Official Splunk MCP evidence must remain read-only and deterministic-authority bounded."
);

const failures = checks.filter((item) => item.status !== "PASS");
const report = {
  source: "splunkready-official-splunk-mcp-live-audit",
  status: failures.length === 0 ? "PASS" : "FAIL",
  score: checks.filter((item) => item.status === "PASS").length,
  maxScore: checks.length,
  mutation: false,
  deterministicAuthority: true,
  summaryPath,
  sessionPath,
  checks,
  failures
};

mkdirSync(dirname(repoPath(outPath)), { recursive: true });
writeFileSync(repoPath(outPath), `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (requirePass && report.status !== "PASS") {
  process.exitCode = 1;
}
