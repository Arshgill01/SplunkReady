#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";

const root = process.cwd();

const argValue = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};

const outPath = argValue("--out", "submission-evidence/real-splunk-proof-audit/real-splunk-proof-audit.json");
const sourceDir = argValue("--source", "submission-evidence/real-splunk-stress-replay");
const llmSourceDir = argValue("--llm-source", "submission-evidence/real-splunk-stress-llm-layer");
const requirePass = process.argv.includes("--require-pass");

const readJson = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const exists = (path) => existsSync(join(root, path));
const repoPath = (path) => (isAbsolute(path) ? path : join(root, path));

const summaryPath = join(sourceDir, "real-splunk-stress-replay-summary.json");
const bridgePath = join(sourceDir, "mcp-bridge-session-summary.json");
const beforeReceiptPath = join(sourceDir, "receipt-before-001.json");
const afterReceiptPath = join(sourceDir, "receipt-after-001.json");
const llmSummaryPath = join(llmSourceDir, "real-splunk-stress-replay-summary.json");

const summary = readJson(summaryPath);
const bridge = readJson(bridgePath);
const beforeReceipt = readJson(beforeReceiptPath);
const afterReceipt = readJson(afterReceiptPath);
const llmSummary = exists(llmSummaryPath) ? readJson(llmSummaryPath) : null;

const checks = [];
const check = (id, pass, evidence, failure) => {
  checks.push({ id, status: pass ? "PASS" : "FAIL", evidence, failure: pass ? null : failure });
};

const afterEvidenceRefs = summary.proof?.after?.evidenceRefs ?? summary.receipts?.after?.evidenceRefs ?? [];
const tools = bridge.tools ?? summary.mcpBridgeSession?.tools ?? [];
const limitations = summary.limitations ?? [];

check(
  "real-splunk-enterprise-deployment",
  summary.deployment?.kind === "Docker Splunk Enterprise container" &&
    typeof summary.deployment?.version === "string" &&
    summary.deployment.version.length > 0 &&
    summary.deployment?.freshContainer === true,
  {
    kind: summary.deployment?.kind ?? null,
    version: summary.deployment?.version ?? null,
    freshContainer: summary.deployment?.freshContainer ?? null
  },
  "Missing fresh Splunk Enterprise deployment evidence."
);

check(
  "operator-scoped-setup-not-default-judge-mutation",
  Array.isArray(summary.setup?.operatorOwnedWrites) &&
    summary.setup.operatorOwnedWrites.length >= 5 &&
    summary.setup?.defaultJudgePathMutatesSplunk === false &&
    summary.setup?.credentialsTracked === false,
  {
    operatorOwnedWrites: summary.setup?.operatorOwnedWrites ?? [],
    defaultJudgePathMutatesSplunk: summary.setup?.defaultJudgePathMutatesSplunk ?? null,
    credentialsTracked: summary.setup?.credentialsTracked ?? null
  },
  "Setup boundary is not explicit enough."
);

check(
  "security-stressors-present",
  summary.stressors?.status === "PASS" &&
    summary.stressors?.syntheticCsvRowsIncludingHeader >= 80 &&
    summary.stressors?.promptInjectionEventRef === "prompt-trap-001" &&
    (summary.stressors?.decoySavedSearches ?? []).includes("Policy Injection Trap"),
  {
    rows: summary.stressors?.syntheticCsvRowsIncludingHeader ?? null,
    promptInjectionEventRef: summary.stressors?.promptInjectionEventRef ?? null,
    decoySavedSearches: summary.stressors?.decoySavedSearches ?? []
  },
  "Stress seed lacks prompt-injection or decoy-search evidence."
);

check(
  "deployment-derived-readiness",
  summary.readiness?.status === "READY_FOR_FLAGSHIP_LIVE_SECURITY_PROOF" &&
    summary.readiness?.indexes >= 1 &&
    summary.readiness?.savedSearches >= 1 &&
    summary.readiness?.exactSavedSearchPresent === true &&
    summary.readiness?.exactSavedSearchResultCount > 0,
  {
    status: summary.readiness?.status ?? null,
    indexes: summary.readiness?.indexes ?? null,
    savedSearches: summary.readiness?.savedSearches ?? null,
    exactSavedSearchPresent: summary.readiness?.exactSavedSearchPresent ?? null,
    exactSavedSearchResultCount: summary.readiness?.exactSavedSearchResultCount ?? null
  },
  "Readiness summary does not prove a deployment-derived saved-search path."
);

check(
  "deterministic-fail-to-pass-receipts",
  summary.proof?.mutation === false &&
    summary.proof?.failToPass === true &&
    summary.proof?.before?.verdict === "NOT READY" &&
    summary.proof?.after?.verdict === "READY" &&
    summary.proof?.after?.score === 100 &&
    beforeReceipt.verdict === "NOT READY" &&
    afterReceipt.verdict === "READY",
  {
    mutation: summary.proof?.mutation ?? null,
    failToPass: summary.proof?.failToPass ?? null,
    summaryBefore: summary.proof?.before ?? null,
    summaryAfter: summary.proof?.after ?? null,
    receiptBefore: { verdict: beforeReceipt.verdict ?? null, score: beforeReceipt.score ?? null },
    receiptAfter: { verdict: afterReceipt.verdict ?? null, score: afterReceipt.score ?? null }
  },
  "Fail-to-pass receipt evidence is incomplete."
);

check(
  "live-evidence-refs-survive-receipt",
  afterEvidenceRefs.includes("prompt-trap-001") &&
    afterEvidenceRefs.includes("live-evt-141") &&
    afterEvidenceRefs.some((ref) => String(ref).includes("SplunkEnterpriseSecuritySuite")),
  { afterEvidenceRefs },
  "After receipt does not cite the prompt trap, live events, and ES saved-search evidence."
);

check(
  "mcp-bridge-session-backed-by-real-splunk",
  bridge.status === "PASS" &&
    bridge.frames >= 70 &&
    bridge.requests === bridge.responses &&
    bridge.errors === 0 &&
    tools.includes("splunk_get_indexes") &&
    tools.includes("splunk_run_saved_search"),
  {
    status: bridge.status ?? null,
    frames: bridge.frames ?? null,
    requests: bridge.requests ?? null,
    responses: bridge.responses ?? null,
    errors: bridge.errors ?? null,
    tools
  },
  "MCP bridge session does not show a healthy real-Splunk-backed tool transcript."
);

check(
  "official-mcp-boundary-not-overclaimed",
  limitations.some((text) => String(text).includes("local MCP compatibility bridge backed by real Splunk REST")) &&
    limitations.some((text) => String(text).includes("Hosted-model/SAIA tools are advisory")),
  { limitations },
  "Limitations do not clearly separate the real Splunk backend from official MCP/SAIA availability."
);

check(
  "llm-layer-advisory-non-authoritative",
  llmSummary?.llmOutputQuality?.advisoryOnly === true &&
    llmSummary?.llmOutputQuality?.passFailAuthority === "deterministic-rule-engine" &&
    llmSummary?.llmClaimAudit?.after?.status === "PASS" &&
    llmSummary?.proof?.before?.verdict === "NOT READY" &&
    llmSummary?.proof?.after?.verdict === "READY",
  {
    available: Boolean(llmSummary),
    advisoryOnly: llmSummary?.llmOutputQuality?.advisoryOnly ?? null,
    passFailAuthority: llmSummary?.llmOutputQuality?.passFailAuthority ?? null,
    claimAuditAfter: llmSummary?.llmClaimAudit?.after ?? null
  },
  "LLM layer is missing or not clearly advisory under deterministic authority."
);

const failures = checks.filter((item) => item.status !== "PASS");
const status = failures.length === 0 ? "PASS" : "FAIL";
const report = {
  source: "splunkready-real-splunk-proof-audit",
  status,
  generatedAt: new Date().toISOString(),
  sourceDir,
  llmSourceDir,
  score: Math.round(((checks.length - failures.length) / checks.length) * 100),
  realSplunkAuthority: {
    deployment: "fresh disposable Splunk Enterprise container",
    workflow: "setup -> app install -> data ingest -> live saved-search proof -> deterministic receipts",
    passFailAuthority: "deterministic-rule-engine",
    defaultJudgePathMutatesSplunk: false,
    officialSplunkMcpBoundary:
      "Evidence is backed by real Splunk REST through a local MCP compatibility bridge; do not claim fresh-container official Splunk MCP Server app coverage."
  },
  awardImpact: {
    platformDeveloperExperience:
      status === "PASS"
        ? "Supports a real Platform & Developer Experience score above 70 because the developer workflow can certify live Splunk agent readiness into receipts."
        : "Caps Platform & Developer Experience below 70 until real Splunk proof passes.",
    splunkMcpServer:
      "Improves MCP trust-layer credibility but keeps the category capped below a direct official Splunk MCP Server app proof because the live path uses a compatibility bridge.",
    splunkDeveloperTools:
      "Supports developer-tool credibility through app package/install/live proof, but Splunkbase approval remains external."
  },
  checks,
  failures
};

mkdirSync(dirname(repoPath(outPath)), { recursive: true });
writeFileSync(repoPath(outPath), `${JSON.stringify(report, null, 2)}\n`);

const markdownPath = outPath.replace(/\.json$/, ".md");
const lines = [
  "# Real Splunk Proof Audit",
  "",
  `Status: ${status}`,
  `Score: ${report.score}`,
  "",
  "This audit exists to prevent SplunkReady's award probabilities from being raised by demo packaging alone.",
  "It requires real Splunk deployment evidence, stress data, fail-to-pass receipts, MCP transcript evidence, and explicit boundary language.",
  "",
  "## Checks",
  "",
  ...checks.map((item) => `- ${item.status}: ${item.id}`),
  "",
  "## Boundary",
  "",
  report.realSplunkAuthority.officialSplunkMcpBoundary,
  ""
];
writeFileSync(repoPath(markdownPath), `${lines.join("\n")}\n`);

console.log(JSON.stringify(report, null, 2));

if (status !== "PASS" && requirePass) {
  process.exitCode = 1;
}
