#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const outIndex = process.argv.indexOf("--out");
const outDir = outIndex >= 0 ? process.argv[outIndex + 1] : "submission-evidence/mcp-proof";
const requireStrong = process.argv.includes("--require-strong");

const readJson = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const readText = (path) => readFileSync(join(root, path), "utf8");
const exists = (path) => existsSync(join(root, path));

const parseJsonl = (path) =>
  readText(path)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));

const checks = [];
const addCheck = (id, status, evidence, severity = status === "WARN" ? "warning" : "required") => {
  checks.push({ id, status, severity, evidence });
};

const includesAll = (values, required) => required.every((value) => values.includes(value));
const unique = (values) => [...new Set(values.filter((value) => typeof value === "string" && value.length > 0))];

const mcpSummaryPath = "submission-evidence/mcp-proof/mcp-proof-summary.json";
const zedJsonlPath = "submission-evidence/mcp-proof/zed-client-session/zed-mcp-recorder-session.jsonl";
const zedMarkdownPath = "submission-evidence/mcp-proof/zed-client-session/zed-mcp-recorder-session.md";
const zedCertificationPath = "submission-evidence/mcp-proof/zed-client-session/mcp-transcript-certification.json";
const zedReceiptPath = "submission-evidence/mcp-proof/zed-client-session/receipt-external-001.json";
const zedScreenshotPath = "submission-evidence/screenshots/zed-mcp-strong-receipt.png";

const summary = readJson(mcpSummaryPath);
const zedFrames = parseJsonl(zedJsonlPath);
const zedMarkdown = readText(zedMarkdownPath);
const zedCertification = readJson(zedCertificationPath);
const zedReceipt = readJson(zedReceiptPath);

const toolNames = summary.tools?.map((tool) => tool.name) ?? [];
const resourceUris = summary.resources?.map((resource) => resource.uri) ?? [];
const promptNames = summary.prompts?.map((prompt) => prompt.name) ?? [];
const templateUris = summary.resourceTemplates?.map((template) => template.uriTemplate) ?? [];

addCheck("mcp-proof-pass", summary.status === "PASS" ? "PASS" : "FAIL", `summary.status=${summary.status}`);
addCheck("mcp-proof-no-mutation", summary.mutation === false ? "PASS" : "FAIL", `summary.mutation=${summary.mutation}`);
addCheck("mcp-tool-surface", toolNames.length >= 6 ? "PASS" : "FAIL", `${toolNames.length} tool(s): ${toolNames.join(", ")}`);
addCheck(
  "mcp-required-tools",
  includesAll(toolNames, [
    "splunkready_certify_mcp_transcript_content",
    "splunkready_check_hosted_model_access",
    "splunkready_review_mcp_composition"
  ])
    ? "PASS"
    : "FAIL",
  toolNames.join(", ")
);
addCheck("mcp-resource-surface", resourceUris.length >= 10 ? "PASS" : "FAIL", `${resourceUris.length} resource(s)`);
addCheck("mcp-receipt-template", templateUris.includes("splunkready://receipts/{receiptId}") ? "PASS" : "FAIL", templateUris.join(", "));
addCheck("mcp-prompt-surface", promptNames.length >= 6 ? "PASS" : "FAIL", `${promptNames.length} prompt(s)`);

const liveMock = summary.liveMockSplunkMcp ?? {};
addCheck(
  "mock-splunk-mcp-session",
  liveMock.status === "PASS" && liveMock.includesSavedSearchExecution === true ? "PASS" : "FAIL",
  `status=${liveMock.status}; includesSavedSearchExecution=${liveMock.includesSavedSearchExecution}`
);

const recorder = summary.compositionRecorder ?? {};
addCheck(
  "dual-server-recorder-session",
  recorder.status === "PASS" && includesAll(recorder.serverIds ?? [], ["splunk", "splunkready"]) ? "PASS" : "FAIL",
  `status=${recorder.status}; serverIds=${(recorder.serverIds ?? []).join(",")}; frameCount=${recorder.frameCount}`
);
addCheck(
  "dual-server-certification-tools",
  includesAll(recorder.splunkReadyToolNames ?? [], [
    "splunkready_certify_mcp_transcript",
    "splunkready_certify_mcp_transcript_content"
  ])
    ? "PASS"
    : "FAIL",
  (recorder.splunkReadyToolNames ?? []).join(", ")
);

const appInspect = summary.appInspectComposition ?? {};
addCheck(
  "appinspect-mcp-composition",
  appInspect.status === "PASS" && appInspect.validation?.failureCount === 0 && appInspect.validation?.errorCount === 0
    ? "PASS"
    : "FAIL",
  `status=${appInspect.status}; failures=${appInspect.validation?.failureCount}; errors=${appInspect.validation?.errorCount}`
);

const hostedModel = summary.hostedModelAccess ?? {};
addCheck(
  "fixture-hosted-model-mcp-access",
  hostedModel.status === "PASS" && hostedModel.mutation === false ? "PASS" : "FAIL",
  `status=${hostedModel.status}; mutation=${hostedModel.mutation}`
);

const liveHostedModel = summary.operatorLiveHostedModelStatus ?? {};
addCheck(
  "operator-live-hosted-model-boundary",
  liveHostedModel.safeForPublicExport === true && liveHostedModel.mutation === false ? "PASS" : "FAIL",
  `status=${liveHostedModel.status}; blockerClass=${liveHostedModel.blockerClass}; safeForPublicExport=${liveHostedModel.safeForPublicExport}`
);

const officialCoverage = summary.officialSplunkMcpToolCoverage ?? {};
addCheck(
  "official-splunk-mcp-tool-coverage",
  officialCoverage.status === "PASS" && officialCoverage.mutation === false ? "PASS" : "FAIL",
  `status=${officialCoverage.status}; tools=${(officialCoverage.investigationTools ?? []).join(", ")}`
);

const zedServerIds = unique(zedFrames.map((frame) => frame.serverId));
const zedToolNames = unique(zedFrames.map((frame) => frame.message?.params?.name));
const zedEvidenceRefs = unique(zedFrames.flatMap((frame) => frame.message?.result?.structuredContent?.evidenceRefs ?? frame.message?.evidenceRefs ?? []));
const zedSerialized = [readText(zedJsonlPath), zedMarkdown].join("\n");
const zedHasFlushFrame = zedToolNames.includes("splunkready_recorder_flush");

addCheck("zed-artifacts-present", [zedJsonlPath, zedMarkdownPath, zedCertificationPath, zedReceiptPath].every(exists) ? "PASS" : "FAIL", "Zed JSONL, markdown, certification, and receipt artifacts exist.");
addCheck("zed-screenshot-present", exists(zedScreenshotPath) && statSync(join(root, zedScreenshotPath)).size > 0 ? "PASS" : "FAIL", zedScreenshotPath);
addCheck("zed-frame-count", zedFrames.length >= 5 ? "PASS" : "FAIL", `${zedFrames.length} tracked Zed frame(s)`);
addCheck(
  "zed-frame-depth",
  zedFrames.length >= 12 ? "PASS" : "WARN",
  zedFrames.length >= 12
    ? `${zedFrames.length} tracked Zed frame(s); current evidence meets the strong external-client bar.`
    : `${zedFrames.length} tracked Zed frame(s); current evidence is real but compact.`
);
addCheck("zed-server-ids", includesAll(zedServerIds, ["splunk", "splunkready"]) ? "PASS" : "FAIL", zedServerIds.join(", "));
addCheck(
  "zed-splunk-investigation-tools",
  includesAll(zedToolNames, ["splunk_get_knowledge_objects", "splunk_run_saved_search"]) ? "PASS" : "FAIL",
  zedToolNames.join(", ")
);
addCheck(
  "zed-visible-recorder-flush-frame",
  zedHasFlushFrame ? "PASS" : "WARN",
  zedHasFlushFrame
    ? "Tracked JSONL contains splunkready_recorder_flush."
    : "Tracked JSONL does not contain a visible splunkready_recorder_flush frame; certification is proven by adjacent artifacts and screenshot."
);
addCheck("zed-evidence-refs", includesAll(zedEvidenceRefs, ["evt-102", "evt-118", "evt-141"]) ? "PASS" : "FAIL", zedEvidenceRefs.join(", "));
addCheck(
  "zed-certification-pass",
  zedCertification.status === "PASS" && zedCertification.mutation === false ? "PASS" : "FAIL",
  `status=${zedCertification.status}; mutation=${zedCertification.mutation}`
);
addCheck(
  "zed-receipt-ready",
  zedReceipt.verdict === "READY" && zedReceipt.score === 100 && zedReceipt.mutation !== true ? "PASS" : "FAIL",
  `verdict=${zedReceipt.verdict}; score=${zedReceipt.score}; mutation=${zedReceipt.mutation ?? false}`
);

const leakPatterns = [
  { id: "endpoint", pattern: /https?:\/\/[^\s"'<>]+/ },
  { id: "bearer-token", pattern: /Bearer\s+(?!<redacted-token>)[A-Za-z0-9._~+/=-]+/ },
  { id: "local-path", pattern: /(?:\/Users\/|\/private\/|\/tmp\/|~\/)/ },
  { id: "secret-name", pattern: /(PASSWORD|TOKEN|SECRET|API_KEY)=/i }
];
const leaks = leakPatterns.filter((entry) => entry.pattern.test(zedSerialized)).map((entry) => entry.id);
addCheck("zed-redaction", leaks.length === 0 ? "PASS" : "FAIL", leaks.length === 0 ? "No endpoint, token, local path, or env-secret material found." : leaks.join(", "));

const failures = checks.filter((check) => check.status === "FAIL");
const warnings = checks.filter((check) => check.status === "WARN");
const status = failures.length > 0 ? "FAIL" : warnings.length > 0 ? "PASS_WITH_LIMITATIONS" : "PASS";
const score = Math.round(((checks.length - failures.length - warnings.length * 0.5) / checks.length) * 1000) / 10;
const zedFrameDepthWarning = warnings.some((check) => check.id === "zed-frame-depth");
const zedFlushWarning = warnings.some((check) => check.id === "zed-visible-recorder-flush-frame");
const zedEvidenceTier = zedFlushWarning
  ? "VERIFIED_COMPACT"
  : zedFrameDepthWarning
    ? "VERIFIED_COMPACT_WITH_FLUSH"
    : "VERIFIED_STRONG";
const zedClaimBoundaryNote = zedHasFlushFrame
  ? zedFrameDepthWarning
    ? "The current Zed evidence is real third-party-client evidence with a visible recorder-flush JSONL frame, but compact. Do not claim a large external-client transcript until a future session captures one."
    : "The current Zed evidence is real third-party-client evidence with a visible recorder-flush JSONL frame and a strong multi-step transcript."
  : "The current Zed evidence is real third-party-client evidence, but compact. Do not claim a large external-client transcript or a visible recorder-flush JSONL frame until a future session captures one.";

const scorecard = {
  source: "splunkready-mcp-category-evidence",
  status,
  score,
  mutation: false,
  deterministicAuthority: true,
  summary: {
    tools: toolNames.length,
    resources: resourceUris.length,
    resourceTemplates: templateUris.length,
    prompts: promptNames.length,
    zedFrames: zedFrames.length,
    zedEvidenceTier
  },
  evidence: {
    mcpProofSummary: mcpSummaryPath,
    topology: "docs/mcp-topology.md",
    dualServerSession: recorder.artifactPath,
    mockSplunkMcpSession: liveMock.artifactPath,
    appInspectComposition: appInspect.artifactPath,
    zedSession: zedJsonlPath,
    zedReceipt: zedReceiptPath,
    zedScreenshot: zedScreenshotPath
  },
  claimBoundary: {
    zedJsonlContainsSplunkReadyFlushFrame: zedHasFlushFrame,
    zedJsonlContainsSplunkInvestigationFrames: includesAll(zedToolNames, [
      "splunk_get_knowledge_objects",
      "splunk_run_saved_search"
    ]),
    certificationProvenByAdjacentArtifacts: zedCertification.status === "PASS" && zedReceipt.verdict === "READY",
    note: zedClaimBoundaryNote
  },
  checks,
  failures,
  warnings
};

const markdown = `# MCP Category Scorecard

Status: ${status}

Score: ${score}

Mutation: false

Deterministic authority: true

## Proof Surfaces

- SplunkReady MCP server: ${toolNames.length} tools, ${resourceUris.length} resources, ${templateUris.length} resource template(s), ${promptNames.length} prompts.
- Mock Splunk MCP composition: ${liveMock.status ?? "UNKNOWN"}.
- Dual-server recorder session: ${recorder.status ?? "UNKNOWN"} with ${recorder.frameCount ?? 0} frame(s).
- AppInspect MCP composition: ${appInspect.status ?? "UNKNOWN"}.
- Fixture hosted-model MCP access: ${hostedModel.status ?? "UNKNOWN"}.
- Operator-live hosted-model boundary: ${liveHostedModel.status ?? "UNKNOWN"} (${liveHostedModel.blockerClass ?? "NONE"}).
- Zed external-client evidence tier: ${scorecard.summary.zedEvidenceTier}; ${zedFrames.length} tracked frame(s).

## Claim Boundary

- Zed JSONL contains Splunk investigation frames: ${scorecard.claimBoundary.zedJsonlContainsSplunkInvestigationFrames ? "yes" : "no"}.
- Zed JSONL contains visible \`splunkready_recorder_flush\` frame: ${zedHasFlushFrame ? "yes" : "no"}.
- Zed certification is proven by adjacent artifacts: ${scorecard.claimBoundary.certificationProvenByAdjacentArtifacts ? "yes" : "no"}.

${scorecard.claimBoundary.note}

## Warnings

${warnings.length === 0 ? "- None." : warnings.map((warning) => `- ${warning.id}: ${warning.evidence}`).join("\n")}

## Evidence

- ${mcpSummaryPath}
- docs/mcp-topology.md
- ${recorder.artifactPath ?? "submission-evidence/mcp-proof/dual-server-session.jsonl"}
- ${liveMock.artifactPath ?? "submission-evidence/mcp-proof/mock-splunk-mcp-session.jsonl"}
- ${appInspect.artifactPath ?? "submission-evidence/mcp-proof/appinspect-mcp-composition.json"}
- ${zedJsonlPath}
- ${zedCertificationPath}
- ${zedReceiptPath}
- ${zedScreenshotPath}
`;

mkdirSync(join(root, outDir), { recursive: true });
writeFileSync(join(root, outDir, "mcp-category-scorecard.json"), `${JSON.stringify(scorecard, null, 2)}\n`);
writeFileSync(join(root, outDir, "mcp-category-scorecard.md"), markdown);

console.log(JSON.stringify(scorecard, null, 2));

if (failures.length > 0 || (requireStrong && warnings.length > 0)) {
  process.exit(1);
}
