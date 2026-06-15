import {
  artifactUrl,
  normalizeArtifactBase,
  summarizeBundle,
  type ArtifactOption,
  type CertificationIndex,
  type FirewallBlock,
  type HostedModelDiagnostic,
  type HostedModelProof,
  type HostedModelSummary,
  type JudgeProofSummary,
  type LlmDeliberationArtifact,
  type McpProofSummary,
  type McpTranscriptImport,
  type PlatformDevexProof,
  type ProofAudit,
  type PublicProofExportManifest,
  type SuiteProofSummary,
  type UiArtifactBundle
} from "./artifacts.js";
import type { InteractiveCertificationResult } from "./interactiveCertifier.js";
import { currentRunIdFromBundle, isIndexableRun, renderRunList, renderTracePreview, sortRunsByCreatedAt } from "./runBrowser.js";
import type { WorkbenchRenderState } from "./workbenchTypes.js";
import type { PolicyPatch, ReadinessReceipt, ReadinessProfile, TraceEvent, Violation } from "../../src/schemas/core.js";

export type ViewId =
  | "certification-replay"
  | "receipt"
  | "trace-timeline"
  | "policy-firewall"
  | "suite-proof"
  | "mcp-proof"
  | "llm-deliberation"
  | "agent-index"
  | "proof-browser"
  | "import-certification"
  | "interactive-certification"
  | "live-connect";

export const views: Array<{ id: ViewId; label: string }> = [
  { id: "certification-replay", label: "Replay" },
  { id: "receipt", label: "Receipt" },
  { id: "trace-timeline", label: "Trace" },
  { id: "policy-firewall", label: "Policy" },
  { id: "suite-proof", label: "Suite" },
  { id: "mcp-proof", label: "MCP" },
  { id: "llm-deliberation", label: "LLM" },
  { id: "agent-index", label: "Agents" },
  { id: "proof-browser", label: "Runs" },
  { id: "import-certification", label: "Import" },
  { id: "interactive-certification", label: "Certify" },
  { id: "live-connect", label: "Live connect" }
];

export interface InteractiveCertificationState {
  status: "idle" | "running" | "succeeded" | "failed";
  result?: InteractiveCertificationResult;
  error?: string;
}

export interface RenderOptions {
  disabledRuleIds?: ReadonlySet<string>;
  artifactOptions?: ArtifactOption[];
  workbench?: WorkbenchRenderState;
  interactiveCertification?: InteractiveCertificationState;
}

export const normalizeView = (value: string | undefined): ViewId =>
  views.some((view) => view.id === value) ? (value as ViewId) : "certification-replay";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const value = (input: unknown): string => escapeHtml(String(input ?? "n/a"));

const code = (input: unknown): string => `<code>${value(input)}</code>`;

const stringListFromUnknown = (input: unknown): string[] => (Array.isArray(input) ? input.map((item) => String(item)) : []);

const violationByEvent = (violations: Violation[]): Map<string, Violation[]> => {
  const grouped = new Map<string, Violation[]>();

  for (const violation of violations) {
    grouped.set(violation.traceEventId, [...(grouped.get(violation.traceEventId) ?? []), violation]);
  }

  return grouped;
};

const splAssistanceByViolation = (
  policyPatch: PolicyPatch | undefined
): Map<string, NonNullable<PolicyPatch["splAssistance"]>[number]> => {
  const grouped = new Map<string, NonNullable<PolicyPatch["splAssistance"]>[number]>();

  for (const assistance of policyPatch?.splAssistance ?? []) {
    grouped.set(assistance.violationRef, assistance);
  }

  return grouped;
};

const violationsById = (violations: Violation[]): Map<string, Violation> => {
  const grouped = new Map<string, Violation>();

  for (const violation of violations) {
    grouped.set(violation.id, violation);
  }

  return grouped;
};

const renderFactTable = (rows: Array<[string, unknown]>): string =>
  `<table class="fact-table"><tbody>${rows
    .map(([label, rowValue]) => `<tr><th>${value(label)}</th><td>${value(rowValue)}</td></tr>`)
    .join("")}</tbody></table>`;

const renderPlainList = (items: readonly string[], className: string): string =>
  `<ul class="${value(className)}">${items.map((item) => `<li>${value(item)}</li>`).join("")}</ul>`;

const renderProofArtifactWarning = (bundle: UiArtifactBundle): string => {
  const hasReceipt = Boolean(bundle.receipt);
  const hasTrace =
    bundle.beforeTrace.length > 0 ||
    bundle.afterTrace.length > 0 ||
    bundle.externalTrace.length > 0 ||
    bundle.importedTrace.length > 0;
  const hasFirewallBlock = Boolean(bundle.firewallBlock);

  if ((hasReceipt && hasTrace) || hasFirewallBlock) {
    return "";
  }

  return `<section class="panel artifact-warning">
    <h2>Artifact bundle incomplete</h2>
    ${renderFactTable([
      ["Artifact base", bundle.artifactBase],
      ["Receipt loaded", hasReceipt ? "yes" : "no"],
      ["Trace loaded", hasTrace ? "yes" : "no"],
      ["Security readiness", bundle.liveSecurityReadiness ? bundle.liveSecurityReadiness.status : "not loaded"],
      [
        "Bundle command",
        "npm run splunkready -- live-security-ui-bundle --proof-dir artifacts/live-proof --security-check-dir artifacts/live-security-check --security-kit-dir artifacts/live-security-kit --out artifacts/live-security-ui --json"
      ]
    ])}
  </section>`;
};

const renderMcpTranscriptImport = (summary: McpTranscriptImport | undefined): string => {
  if (!summary) {
    return "";
  }

  return `<section class="panel mcp-transcript-panel">
    <h2>MCP transcript import</h2>
    ${renderFactTable([
      ["Status", summary.status],
      ["Source", summary.source],
      ["Mission", summary.missionId],
      ["Strict import", summary.strictImport ? "yes" : "no"],
      ["Imported events", summary.importedEvents],
      ["Tool calls", summary.toolCalls],
      ["Tool results", summary.toolResults],
      ["Final answers", summary.finalAnswers],
      ["Errors", summary.errors],
      ["Skipped records", summary.skippedRecords],
      ["Unmatched tool calls", summary.unmatchedToolCalls ?? "not recorded"],
      ["Tools", summary.toolNames.length > 0 ? summary.toolNames.join(" / ") : "none"],
      ["Transcript", summary.transcriptPath ?? "not recorded"],
      ["Trace", summary.outputTracePath ?? "not recorded"],
      ["Mutation", summary.mutation ? "yes" : "no"],
      ["Next command", summary.nextCommand ?? "grade-trace"]
    ])}
  </section>`;
};

const renderMcpProofList = (items: readonly string[], className: string): string =>
  items.length > 0 ? renderPlainList(items, className) : `<p class="empty">None recorded.</p>`;

const renderMcpDeveloperGate = (summary: McpProofSummary): string => {
  const boundary = summary.splunkMcpBoundary;
  const certifiedTools = boundary.certifiedToolNames.join(" / ") || "none";
  const evidenceRefs = boundary.evidenceRefs.join(" / ") || "none";

  return `<section class="panel mcp-proof-panel">
    <h2>Developer gate</h2>
    ${renderFactTable([
      ["Workflow", "Splunk MCP trace -> SplunkReady certification -> Readiness Receipt"],
      ["Splunk MCP tools", certifiedTools],
      ["CLI quickstart", "npx splunkready judge-proof"],
      ["Transcript gate", "npx splunkready certify-mcp-transcript --strict-import true --require-pass true"],
      ["Workbench artifact", "artifacts/mcp-transcript"],
      ["Receipt", boundary.receiptPath],
      ["Evidence refs", evidenceRefs],
      ["CI gate", "GitHub Action and npx judge-proof paths emit the same receipt artifacts"],
      ["Authority", boundary.deterministicAuthority ? "deterministic rule engine" : "not recorded"],
      ["Mutation", boundary.mutation ? "yes" : "no"]
    ])}
  </section>`;
};

const renderMcpProofTable = (summary: McpProofSummary): string => {
  const boundary = summary.splunkMcpBoundary;

  return renderFactTable([
    ["Status", summary.status],
    ["Handshake", `${summary.handshake.serverName} / ${summary.handshake.protocolVersion}`],
    ["Splunk MCP transcript", boundary.transcriptPath],
    ["Certified Splunk tools", boundary.certifiedToolNames.join(" / ")],
    ["Splunk tool calls", boundary.splunkToolCallCount],
    ["Saved-search execution", boundary.includesSavedSearchExecution ? "yes" : "no"],
    ["Evidence refs", boundary.evidenceRefs.join(" / ")],
    ["Receipt", boundary.receiptPath],
    ["Deterministic authority", boundary.deterministicAuthority ? "yes" : "no"],
    ["Mutation", summary.mutation || boundary.mutation ? "yes" : "no"]
  ]);
};

const renderMcpComposition = (summary: McpProofSummary): string => {
  const composition = summary.mcpComposition;

  return `${renderFactTable([
    ["Status", composition.status],
    ["Score", `${composition.score}/100`],
    ["Servers", composition.servers.map((server) => `${server.name}: ${server.role}`).join(" / ")],
    ["Existing MCP server", composition.servers.find((server) => server.existingMcpServer)?.name ?? "none"],
    ["Deterministic authority", composition.deterministicAuthority ? "yes" : "no"],
    ["Mutation", composition.mutation ? "yes" : "no"]
  ])}
  ${renderMcpProofList(
    composition.checks.map((check) => `${check.id}: ${check.status} - ${check.evidence}`),
    "stage-list"
  )}`;
};

const renderOfficialSplunkMcpToolCoverage = (summary: McpProofSummary): string => {
  const coverage = summary.officialSplunkMcpToolCoverage;

  return `${renderFactTable([
    ["Status", coverage.status],
    ["Captured core tools", coverage.capturedCoreTools.join(" / ") || "none"],
    ["Investigation tools", coverage.investigationTools.join(" / ") || "none"],
    ["Hosted-model tools", coverage.hostedModelTools.join(" / ") || "none"],
    ["Mission-scoped out tools", coverage.missionScopedOutTools.join(" / ") || "none"],
    ["Tools doc", coverage.docs.toolsUrl],
    ["Configuration doc", coverage.docs.configurationUrl],
    ["Deterministic authority", coverage.deterministicAuthority ? "yes" : "no"],
    ["Mutation", coverage.mutation ? "yes" : "no"]
  ])}
  ${renderMcpProofList(
    coverage.checks.map((check) => `${check.id}: ${check.status} - ${check.evidence}`),
    "stage-list"
  )}`;
};

const renderMcpCategoryScorecard = (scorecard: UiArtifactBundle["mcpCategoryScorecard"]): string => {
  if (!scorecard) {
    return `<section class="panel mcp-proof-panel">
      <h2>MCP category proof</h2>
      ${renderFactTable([
        ["Scorecard", "not loaded"],
        ["Expected file", "mcp-category-scorecard.json"],
        ["Generate", "node scripts/audit-mcp-category-evidence.mjs --out submission-evidence/mcp-proof --require-strong"],
        ["Mutation", "false"]
      ])}
    </section>`;
  }

  return `<section class="panel mcp-proof-panel">
    <h2>MCP category proof</h2>
    ${renderFactTable([
      ["Status", scorecard.status],
      ["Score", scorecard.score],
      ["Tools / resources", `${scorecard.summary.tools} / ${scorecard.summary.resources}`],
      ["Zed evidence", `${scorecard.summary.zedEvidenceTier} / ${scorecard.summary.zedFrames} frame(s)`],
      [
        "Splunk investigation frames",
        scorecard.claimBoundary.zedJsonlContainsSplunkInvestigationFrames ? "yes" : "no"
      ],
      [
        "Recorder flush frame",
        scorecard.claimBoundary.zedJsonlContainsSplunkReadyFlushFrame ? "yes" : "no"
      ],
      [
        "Adjacent certification",
        scorecard.claimBoundary.certificationProvenByAdjacentArtifacts ? "yes" : "no"
      ],
      ["Failures / warnings", `${scorecard.failures.length} / ${scorecard.warnings.length}`],
      ["Deterministic authority", scorecard.deterministicAuthority ? "yes" : "no"],
      ["Mutation", scorecard.mutation ? "yes" : "no"]
    ])}
    <p class="summary-note">${value(scorecard.claimBoundary.note)}</p>
    ${renderMcpProofList(
      scorecard.checks.slice(0, 8).map((check) => `${check.id}: ${check.status} - ${check.evidence}`),
      "stage-list"
    )}
  </section>`;
};

const renderMcpCompositionRecorder = (summary: McpProofSummary): string => {
  const recorder = summary.compositionRecorder;

  return renderFactTable([
    ["Status", recorder.status],
    ["Source", recorder.source],
    ["Frames", recorder.frameCount],
    ["Servers", recorder.serverIds.join(" / ")],
    ["Requests", recorder.requestCount],
    ["Responses", recorder.responseCount],
    ["Splunk tools", recorder.splunkToolNames.join(" / ") || "none"],
    ["SplunkReady tools", recorder.splunkReadyToolNames.join(" / ") || "none"],
    ["Evidence refs", recorder.evidenceRefs.join(" / ") || "none"],
    ["Transcript", recorder.artifactPath],
    ["Markdown", recorder.markdownPath],
    ["Redaction", recorder.redaction.status],
    ["Endpoint material", recorder.redaction.endpointMaterialPresent ? "present" : "redacted"],
    ["Token material", recorder.redaction.tokenMaterialPresent ? "present" : "redacted"],
    ["Local path material", recorder.redaction.localPathMaterialPresent ? "present" : "redacted"],
    ["Certification", recorder.certification?.status ?? "not recorded"],
    ["Certification out dir", recorder.certification?.outDir ?? "not recorded"],
    ["Certification artifacts", recorder.certification?.artifactCount ?? "not recorded"],
    ["Deterministic authority", recorder.deterministicAuthority ? "yes" : "no"],
    ["Mutation", recorder.mutation ? "yes" : "no"]
  ]);
};

const renderLiveMockSplunkMcp = (summary: McpProofSummary): string => {
  const liveMock = summary.liveMockSplunkMcp;

  return renderFactTable([
    ["Status", liveMock.status],
    ["Route state", liveMock.routeState],
    ["Tools called", liveMock.toolNames.join(" / ") || "none"],
    ["Evidence refs", liveMock.evidenceRefs.join(" / ") || "none"],
    ["Saved-search execution", liveMock.includesSavedSearchExecution ? "yes" : "no"],
    ["Requests", liveMock.requestCount],
    ["Responses", liveMock.responseCount],
    ["Transcript", liveMock.artifactPath],
    ["Markdown", liveMock.markdownPath],
    ["Deterministic authority", liveMock.deterministicAuthority ? "yes" : "no"],
    ["Mutation", liveMock.mutation ? "yes" : "no"]
  ]);
};

const renderAppInspectComposition = (summary: McpProofSummary): string => {
  const appInspect = summary.appInspectComposition;

  return `${renderFactTable([
    ["Status", appInspect.status],
    ["Command", appInspect.command],
    ["Server", appInspect.server.name ? `${appInspect.server.name} ${appInspect.server.version}` : appInspect.server.status],
    ["Tools", appInspect.server.tools.join(" / ") || "none"],
    ["Blocked reason", appInspect.server.blockedReason || "none"],
    ["App package", appInspect.appPackagePath],
    ["Package present", appInspect.appPackagePresent ? "yes" : "no"],
    ["Validation", appInspect.validation.status],
    ["Failures", appInspect.validation.failureCount],
    ["Errors", appInspect.validation.errorCount],
    ["Warnings", appInspect.validation.warningCount],
    ["Receipt authority", appInspect.composition.deterministicReceiptAuthority],
    ["AppInspect authority", appInspect.composition.appInspectAuthority],
    ["Deterministic authority", appInspect.deterministicAuthority ? "yes" : "no"],
    ["Mutation", appInspect.mutation ? "yes" : "no"],
    ["Artifact", appInspect.artifactPath],
    ["Markdown", appInspect.markdownPath]
  ])}
  ${renderMcpProofList(
    appInspect.composition.servers.map((server) => `${server.name}: ${server.role} - ${server.authority}`),
    "stage-list"
  )}`;
};

const renderOperatorLiveHostedModelStatus = (summary: McpProofSummary): string => {
  const status = summary.operatorLiveHostedModelStatus;

  if (!status) {
    return renderFactTable([
      ["Status", "not recorded"],
      ["Summary", "Generate the current MCP proof to record operator-live hosted-model status."],
      ["Mutation", "false"]
    ]);
  }

  return renderFactTable([
    ["Status", status.status],
    ["Artifact", status.artifactPath],
    ["Blocker", status.blockerClass],
    ["Permission", status.permissionStatus],
    ["Permission blocker", status.permissionBlockerClass],
    ["Local route probe", status.restHandlerProbeStatus],
    ["Required tools", status.requiredTools.join(" / ") || "none"],
    ["Available tools", status.availableTools.join(" / ") || "none"],
    ["Passed tools", status.passedTools.join(" / ") || "none"],
    ["Blocked tools", status.blockedTools.join(" / ") || "none"],
    ["Safe for public export", status.safeForPublicExport ? "yes" : "no"],
    ["Deterministic authority", status.deterministicAuthority ? "yes" : "no"],
    ["Mutation", status.mutation ? "yes" : "no"],
    ["Summary", status.summary]
  ]);
};

const renderMcpProof = (bundle: UiArtifactBundle): string => {
  const summary = bundle.mcpProofSummary;

  return `<main class="view" data-view="mcp-proof">
    <section class="workbench">
      <div class="section-title">
        <h1>MCP proof</h1>
      </div>
      <div class="receipt-ledger">
        ${
          summary
            ? `${renderMcpCategoryScorecard(bundle.mcpCategoryScorecard)}
              ${renderMcpDeveloperGate(summary)}
              <section class="panel mcp-proof-panel">
                <h2>Certification loop</h2>
                ${renderMcpProofTable(summary)}
              </section>
              <section class="panel mcp-proof-panel">
                <h2>Agent-driven workflow</h2>
                ${renderFactTable([
                  ["Status", summary.agentDrivenWorkflow.status],
                  ["Splunk MCP role", summary.agentDrivenWorkflow.splunkMcpServerRole],
                  ["SplunkReady MCP role", summary.agentDrivenWorkflow.splunkReadyMcpServerRole],
                  ["Deterministic authority", summary.agentDrivenWorkflow.deterministicAuthority ? "yes" : "no"],
                  ["Mutation", summary.agentDrivenWorkflow.mutation ? "yes" : "no"]
                ])}
                ${renderMcpProofList(summary.agentDrivenWorkflow.stages, "stage-list")}
              </section>
              <section class="panel mcp-proof-panel">
                <h2>MCP composition scorecard</h2>
                ${renderMcpComposition(summary)}
              </section>
              <section class="panel mcp-proof-panel">
                <h2>MCP composition recorder</h2>
                ${renderMcpCompositionRecorder(summary)}
              </section>
              <section class="panel mcp-proof-panel">
                <h2>Live mock Splunk MCP</h2>
                ${renderLiveMockSplunkMcp(summary)}
              </section>
              <section class="panel mcp-proof-panel">
                <h2>AppInspect MCP composition</h2>
                ${renderAppInspectComposition(summary)}
              </section>
              <section class="panel mcp-proof-panel">
                <h2>Official Splunk MCP tool coverage</h2>
                ${renderOfficialSplunkMcpToolCoverage(summary)}
              </section>
              <section class="panel mcp-proof-panel">
                <h2>Operator live hosted-model status</h2>
                ${renderOperatorLiveHostedModelStatus(summary)}
              </section>
              <section class="panel mcp-proof-panel">
                <h2>MCP surface</h2>
                ${renderFactTable([
                  ["Tools", summary.tools.map((tool) => `${tool.name} / read-only ${tool.readOnlyHint ? "yes" : "no"}`).join(" / ")],
                  ["Resources", summary.resources.map((resource) => resource.uri).join(" / ")],
                  ["Resource templates", summary.resourceTemplates.map((template) => template.uriTemplate).join(" / ")],
                  ["Prompts", summary.prompts.map((prompt) => `${prompt.name} (${prompt.argumentCount})`).join(" / ")]
                ])}
              </section>
              <section class="panel mcp-proof-panel">
                <h2>MCP client session</h2>
                ${renderFactTable([
                  ["Status", summary.clientSession.status],
                  ["Protocol", summary.clientSession.protocol],
                  ["Requests", String(summary.clientSession.requestCount)],
                  ["Responses", String(summary.clientSession.responseCount)],
                  ["Methods", summary.clientSession.methods.join(" / ")],
                  ["Resources read", summary.clientSession.resourceUris.join(" / ")],
                  ["Resource templates", summary.resourceTemplates.map((template) => template.uriTemplate).join(" / ")],
                  ["Prompts fetched", summary.clientSession.promptNames.join(" / ")],
                  ["Tools called", summary.clientSession.toolNames.join(" / ")],
                  ["Transcript", summary.clientSession.artifactPath],
                  ["Deterministic authority", summary.clientSession.deterministicAuthority ? "yes" : "no"],
                  ["Mutation", summary.clientSession.mutation ? "yes" : "no"]
                ])}
              </section>
              <section class="panel mcp-proof-panel">
                <h2>Certified boundary</h2>
                ${renderFactTable([
                  ["Boundary", summary.splunkMcpBoundary.transcriptKind],
                  ["Local MCP role", summary.splunkMcpBoundary.localMcpServerRole],
                  ["Splunk MCP role", summary.splunkMcpBoundary.splunkMcpServerRole],
                  ["Transcript certification", summary.transcriptCertification.status],
                  ["Inline transcript certification", summary.inlineTranscriptCertification.status],
                  ["Hosted-model access", summary.hostedModelAccess.status],
                  ["Hosted-model blocker", summary.hostedModelAccess.blockerClass ?? "NONE"],
                  ["Hosted-model permission", summary.hostedModelAccess.permissionStatus],
                  ["Hosted-model permission blocker", summary.hostedModelAccess.permissionBlockerClass ?? "NONE"],
                  ["Hosted-model remediation", summary.hostedModelAccess.remediation?.status ?? "not recorded"],
                  ["Hosted-model remediation summary", summary.hostedModelAccess.remediation?.summary ?? "not recorded"],
                  [
                    "Hosted-model operator checks",
                    summary.hostedModelAccess.remediation?.operatorChecks.join(" / ") ?? "not recorded"
                  ],
                  ["Hosted-model passed tools", summary.hostedModelAccess.passedTools?.join(" / ") || "none"],
                  ["Hosted-model blocked tools", summary.hostedModelAccess.blockedTools?.join(" / ") || "none"],
                  [
                    "Hosted-model tool results",
                    summary.hostedModelAccess.toolResults?.map((result) => `${result.toolName}:${result.status}`).join(" / ") ||
                      "not recorded"
                  ],
                  ["Certification out dir", summary.transcriptCertification.outDir],
                  ["Inline certification out dir", summary.inlineTranscriptCertification.outDir],
                  ["Hosted-model out dir", summary.hostedModelAccess.outDir],
                  ["Generated artifacts", summary.transcriptCertification.artifacts.length],
                  ["Next commands", summary.nextCommands.join(" / ")]
                ])}
              </section>`
            : `<section class="panel mcp-proof-panel">
                <h2>MCP proof not loaded</h2>
                ${renderFactTable([
                  ["Artifact base", bundle.artifactBase],
                  ["Expected file", "mcp-proof-summary.json"],
                  ["Generate", "npm run mcp-proof"],
                  ["Boundary", "certify captured Splunk MCP behavior; do not replace Splunk MCP"],
                  ["Mutation", "false"]
                ])}
              </section>`
        }
        ${renderMcpTranscriptImport(bundle.mcpTranscriptImport)}
      </div>
    </section>
  </main>`;
};

const renderReceiptPanel = (receipt: ReadinessReceipt | undefined, title: string): string => {
  if (!receipt) {
    return `<section class="panel"><h2>${value(title)}</h2><p class="empty">Receipt artifact not loaded.</p></section>`;
  }

  const policyRows: Array<[string, unknown]> = receipt.policy
    ? [["Policy", `${receipt.policy.name} ${receipt.policy.version} / ${receipt.policy.id}`]]
    : [];

  return `<section class="panel">
    <h2>${value(title)}</h2>
    ${renderFactTable([
      ["Receipt", receipt.id],
      ["Verdict", receipt.verdict],
      ["Score", receipt.score],
      ["Contract", `${receipt.environment.id} / ${receipt.contractVersion}`],
      ...policyRows,
      ["Trace refs", receipt.traceRefs.length],
      ["Evidence refs", receipt.evidenceRefs.length],
      ["Violations", receipt.violations.length]
    ])}
  </section>`;
};

const severityDeductions: Record<Violation["severity"], number> = {
  Critical: 25,
  High: 15,
  Medium: 8,
  Low: 2
};

const activeReceiptForSimulation = (
  bundle: UiArtifactBundle
): { receipt: ReadinessReceipt | undefined; violations: Violation[] } => {
  if (bundle.beforeReceipt && bundle.beforeViolations.length > 0) {
    return { receipt: bundle.beforeReceipt, violations: bundle.beforeViolations };
  }

  if (bundle.afterReceipt && bundle.afterViolations.length > 0) {
    return { receipt: bundle.afterReceipt, violations: bundle.afterViolations };
  }

  return {
    receipt: bundle.receipt,
    violations:
      bundle.afterViolations.length > 0
        ? bundle.afterViolations
        : bundle.beforeViolations.length > 0
          ? bundle.beforeViolations
          : bundle.externalViolations
  };
};

const ruleBindingsForSimulator = (profile: ReadinessProfile | undefined): ReadinessProfile["ruleBindings"] => {
  if (!profile) {
    return [];
  }

  return [...profile.ruleBindings].sort((left, right) => left.ruleId.localeCompare(right.ruleId));
};

const renderPolicySimulator = (bundle: UiArtifactBundle, options: RenderOptions): string => {
  const profile = bundle.readinessProfile;
  const bindings = ruleBindingsForSimulator(profile);
  const disabledRuleIds = options.disabledRuleIds ?? new Set<string>();
  const { receipt, violations } = activeReceiptForSimulation(bundle);
  const simulatedViolations = violations.filter((violation) => !disabledRuleIds.has(violation.ruleId));
  const score = Math.max(
    0,
    100 - simulatedViolations.reduce((total, violation) => total + severityDeductions[violation.severity], 0)
  );
  const criticalOrHighRemaining = simulatedViolations.some(
    (violation) => violation.severity === "Critical" || violation.severity === "High"
  );
  const verdict = score >= 75 && !criticalOrHighRemaining ? "READY (SIMULATED)" : "NOT READY (SIMULATED)";

  if (!profile) {
    return `<aside id="policy-simulator" class="panel policy-simulator">
      <h2>Policy simulator</h2>
      <p class="empty">Readiness profile artifact not loaded.</p>
    </aside>`;
  }

  return `<aside id="policy-simulator" class="panel policy-simulator">
    <h2>Policy simulator</h2>
    ${renderFactTable([
      ["Base receipt", receipt?.id ?? "not loaded"],
      ["Authority", profile.llmUsage.passFailAuthority],
      ["Simulated verdict", verdict],
      ["Simulated score", score],
      ["Remaining violations", simulatedViolations.length],
      ["Critical or High remain", criticalOrHighRemaining ? "yes" : "no"]
    ])}
    <div class="rule-switchboard" aria-label="Readiness profile rule simulator">
      ${bindings
        .map((binding) => {
          const enabled = !disabledRuleIds.has(binding.ruleId);
          const hits = violations.filter((violation) => violation.ruleId === binding.ruleId).length;

          return `<label class="rule-switch">
            <input type="checkbox" data-policy-rule="${value(binding.ruleId)}" ${enabled ? "checked" : ""}>
            <span>
              <strong>${value(binding.ruleId)}</strong>
              <em>${value(binding.severity)} / ${value(binding.source)} / ${hits} hit(s)</em>
            </span>
          </label>`;
        })
        .join("")}
    </div>
  </aside>`;
};

const renderStage = (index: number, title: string, status: string, detail: string): string =>
  `<li class="stage" style="--stage-index: ${index}">
    <span>${index}</span>
    <strong>${value(title)}</strong>
    <em>${value(status)}</em>
    <p>${value(detail)}</p>
  </li>`;

const renderPolicyPatchSummary = (policyPatch: PolicyPatch | undefined, emptyMessage = "Policy patch artifact not loaded."): string => {
  if (!policyPatch) {
    return `<p class="empty">${value(emptyMessage)}</p>`;
  }

  const assistance = policyPatch.splAssistance ?? [];

  return `<div class="patch-grid">
    ${renderFactTable([
      ["Patch", policyPatch.id],
      ["Status", policyPatch.status],
      ["Source receipt", policyPatch.sourceReceiptId],
      ["Rules", policyPatch.rules.length],
      ["SAIA items", assistance.length]
    ])}
    <div class="patch-rules">
      ${policyPatch.rules.map((rule) => `<article><strong>${value(rule.id)}</strong><p>${value(rule.text)}</p></article>`).join("")}
      ${assistance
        .map(
          (item) => `<article>
            <strong>${value(item.ruleId)} / SAIA</strong>
            <p>SAIA Explanation: ${value(item.explanation)}</p>
            <p>SAIA Optimized Query: ${value(item.optimizedQuery)}</p>
          </article>`
        )
        .join("")}
    </div>
  </div>`;
};

const renderPatchViolationMap = (policyPatch: PolicyPatch | undefined, violations: Violation[]): string => {
  if (!policyPatch) {
    return `<p class="empty">Policy patch artifact not loaded.</p>`;
  }

  const byId = violationsById(violations);
  const assistance = splAssistanceByViolation(policyPatch);

  return `<div class="patch-map">
    ${policyPatch.violationRefs
      .map((violationRef) => {
        const violation = byId.get(violationRef);
        const item = assistance.get(violationRef);

        return `<article>
          <strong>${value(violationRef)}</strong>
          ${renderFactTable([
            ["Rule", violation?.ruleId ?? item?.ruleId ?? "n/a"],
            ["Severity", violation?.severity ?? "n/a"],
            ["Trace event", violation?.traceEventId ?? "n/a"],
            ["Deterministic reason", violation?.reason ?? "violation artifact not loaded"],
            ["Suggested policy", violation?.suggestedPolicyPatch ?? "n/a"],
            ["SAIA role", item ? "advisory generate/explain/optimize/ask" : "not invoked"],
            ["SAIA optimized SPL", item?.optimizedQuery ?? "n/a"]
          ])}
        </article>`;
      })
      .join("")}
  </div>`;
};

const renderLiveProofSummary = (bundle: UiArtifactBundle): string => {
  const summary = bundle.liveProofSummary;

  if (!summary) {
    return "";
  }

  return `<section class="panel live-proof-panel">
    <h2>Live proof summary</h2>
    ${renderLiveProofSummaryTable(bundle)}
  </section>`;
};

const renderLiveProofSummaryTable = (bundle: UiArtifactBundle): string => {
  const summary = bundle.liveProofSummary;

  if (!summary) {
    return `<p class="empty">Live proof summary artifact not loaded.</p>`;
  }

  return renderFactTable([
    ["Derived mission", summary.derivedMission.missionId ?? "n/a"],
    ["Strategy", summary.derivedMission.strategy],
    ["Before", `${summary.before.verdict} / ${summary.before.score}`],
    ["After", `${summary.after.verdict} / ${summary.after.score}`],
    ["Proof loop", summary.proofLoop],
    ["Fail to pass", summary.failToPass ? "yes" : "no"],
    ["Ready without patch", summary.readyWithoutPatch ? "yes" : "no"],
    ["Mutation", summary.mutation ? "yes" : "no"],
    ["Notes", summary.notes]
  ]);
};

const renderLiveSecurityProofSummary = (bundle: UiArtifactBundle): string => {
  const summary = bundle.liveSecurityProofSummary;

  if (!summary) {
    return "";
  }

  return `<section class="panel live-security-proof-panel">
    <h2>Flagship security proof</h2>
    ${renderFactTable([
      ["Status", summary.status],
      ["Readiness", summary.readinessStatus],
      ["Mission", summary.mission],
      ["Before", `${summary.before.verdict} / ${summary.before.score} / ${summary.before.violations} violation(s)`],
      ["After", `${summary.after.verdict} / ${summary.after.score} / ${summary.after.violations} violation(s)`],
      ["Proof loop", summary.proofLoop],
      ["Fail to pass", summary.failToPass ? "yes" : "no"],
      ["Ready after patch", summary.readyAfterPatch ? "yes" : "no"],
      ["Evidence refs", summary.after.evidenceRefs.join(" / ")],
      ["Mutation", summary.mutation ? "yes" : "no"],
      ["Notes", summary.notes]
    ])}
  </section>`;
};

const renderHostedModelSummary = (summary: HostedModelSummary | undefined): string => {
  if (!summary) {
    return "";
  }

  return `<section class="panel hosted-model-panel">
    <h2>Hosted model assistance</h2>
    ${renderFactTable([
      ["Status", summary.status],
      ["Available tools", summary.availableTools.length > 0 ? summary.availableTools.join(" / ") : "none"],
      ["Missing tools", summary.missingTools.length > 0 ? summary.missingTools.join(" / ") : "none"],
      ["SAIA items", summary.assistanceItems],
      ["Role", "advisory only; deterministic grader decides pass/fail"],
      ["Notes", summary.notes]
    ])}
  </section>`;
};

const llmPhaseLabel = (artifact: LlmDeliberationArtifact | undefined, fallback: string): string =>
  artifact ? `${artifact.phase} / ${artifact.outputQuality.grade} / ${artifact.outputQuality.score}` : `${fallback} not loaded`;

const renderLlmDimensionRows = (artifact: LlmDeliberationArtifact): Array<[string, unknown]> =>
  artifact.outputQuality.dimensions.map((dimension) => [
    dimension.dimension,
    `${dimension.score}/${dimension.maxScore}`
  ]);

const renderLlmClaimAuditRows = (artifact: LlmDeliberationArtifact): Array<[string, unknown]> => {
  const audit = artifact.claimAudit;

  if (!audit) {
    return [["Claim audit", "not recorded"]];
  }

  return [
    ["Claim audit", audit.status],
    ["Claims", `${audit.supportedClaims} supported / ${audit.partialClaims} partial / ${audit.unsupportedClaims} unsupported`],
    ["Hallucinated refs", audit.hallucinatedRefs.length > 0 ? audit.hallucinatedRefs.join(", ") : "none"],
    ["Observed tools", audit.observedRefs.toolNames.join(" / ") || "none"],
    ["Observed query refs", audit.observedRefs.queryRefs.join(" / ") || "none"],
    ["Observed evidence refs", audit.observedRefs.evidenceRefs.join(" / ") || "none"]
  ];
};

const renderLlmClaimAuditList = (artifact: LlmDeliberationArtifact): string => {
  const audit = artifact.claimAudit;

  if (!audit || audit.claims.length === 0) {
    return renderMcpProofList(["No claim audit rows recorded."], "stage-list");
  }

  return renderMcpProofList(
    audit.claims.map((claim) => {
      const matchedRefs = [...claim.matchedQueryRefs, ...claim.matchedEvidenceRefs];
      const missingRefs = [...claim.missingQueryRefs, ...claim.missingEvidenceRefs];
      return `${claim.auditedSupport.toUpperCase()} / declared ${claim.declaredSupport}: ${claim.claim}; matched ${
        matchedRefs.length > 0 ? matchedRefs.join(", ") : "none"
      }; missing ${missingRefs.length > 0 ? missingRefs.join(", ") : "none"}; limitation ${
        claim.limitation ?? "not recorded"
      }`;
    }),
    "stage-list"
  );
};

const renderLlmDeliberationSummary = (bundle: UiArtifactBundle): string => {
  const before = bundle.llmDeliberationBefore;
  const after = bundle.llmDeliberationAfter;
  const advisoryOnly = before?.advisoryOnly ?? after?.advisoryOnly;

  return `<section class="panel llm-deliberation-panel">
    <h2>LLM advisory boundary</h2>
    ${renderFactTable([
      ["Before", llmPhaseLabel(before, "before")],
      ["After", llmPhaseLabel(after, "after")],
      ["Advisory only", advisoryOnly ? "yes" : "not loaded"],
      ["Pass/fail authority", before?.passFailAuthority ?? after?.passFailAuthority ?? "deterministic-rule-engine"],
      ["Receipt verdict", bundle.receipt?.verdict ?? "not loaded"],
      ["Receipt score", bundle.receipt?.score ?? "not loaded"],
      ["Mutation", "no"]
    ])}
  </section>`;
};

const renderLlmArtifactMissing = (bundle: UiArtifactBundle): string => {
  if (bundle.llmDeliberationBefore || bundle.llmDeliberationAfter) {
    return "";
  }

  return `<section class="panel llm-deliberation-panel">
    <h2>LLM deliberation not loaded</h2>
    ${renderFactTable([
      ["Artifact base", bundle.artifactBase],
      ["Expected files", "llm-deliberation-before.json / llm-deliberation-after.json"],
      ["Generate", "npm run splunkready -- llm-proof --out artifacts/llm-fixture-proof --json"],
      ["Role", "structured planning, provenance, uncertainty, and safety evidence"],
      ["Authority", "deterministic-rule-engine"]
    ])}
  </section>`;
};

const renderLlmPhase = (artifact: LlmDeliberationArtifact | undefined, title: string): string => {
  if (!artifact) {
    return `<section class="panel llm-deliberation-panel">
      <h2>${value(title)}</h2>
      <p class="empty">LLM deliberation artifact not loaded.</p>
    </section>`;
  }

  const planToolCalls = artifact.plan.toolCalls.map((toolCall) => `${toolCall.toolName}: ${JSON.stringify(toolCall.input)}`);
  const observations = artifact.observations.map((observation) => {
    const evidence = observation.evidenceRefs.length > 0 ? observation.evidenceRefs.join(", ") : "none";
    return `${observation.toolName}: ${observation.summary}; resultCount ${observation.resultCount ?? "n/a"}; provenance ${observation.queryRef ?? "none"}; evidence ${evidence}`;
  });
  const findings = artifact.outputQuality.findings.map(
    (finding) =>
      `${finding.id} / ${finding.dimension} / ${finding.status} / ${finding.points}/${finding.maxPoints}: ${finding.detail}`
  );

  return `<section class="panel llm-deliberation-panel">
    <h2>${value(title)}</h2>
    ${renderFactTable([
      ["Phase", artifact.phase],
      ["Grade", artifact.outputQuality.grade],
      ["Quality score", artifact.outputQuality.score],
      ["Advisory only", artifact.advisoryOnly ? "yes" : "no"],
      ["Pass/fail authority", artifact.passFailAuthority],
      ["Mission understanding", artifact.plan.missionUnderstanding ?? "not recorded"],
      ["Rationale", artifact.plan.rationale],
      ["Risk controls", artifact.plan.riskControls?.join(" / ") ?? "not recorded"],
      ["Evidence strategy", artifact.plan.evidenceStrategy?.join(" / ") ?? "not recorded"],
      ["Self-check", artifact.plan.selfCheck?.join(" / ") ?? "not recorded"],
      ["Tool calls", planToolCalls.length > 0 ? planToolCalls.join(" / ") : "none"],
      ["Observations", observations.length > 0 ? observations.join(" / ") : "none"],
      ["Decision trace", artifact.answer.decisionTrace?.join(" / ") ?? "not recorded"],
      ["Provenance summary", artifact.answer.provenanceSummary ?? "not recorded"],
      ["Uncertainty", artifact.answer.uncertainty?.join(" / ") ?? "not recorded"],
      ["Safety notes", artifact.answer.safetyNotes?.join(" / ") ?? "not recorded"],
      ["Next actions", artifact.answer.nextActions?.join(" / ") ?? "not recorded"],
      ["Final answer", artifact.answer.finalAnswer]
    ])}
    <div class="llm-quality-grid">
      <section>
        <h3>Dimension scores</h3>
        ${renderFactTable(renderLlmDimensionRows(artifact))}
      </section>
      <section>
        <h3>Output-quality findings</h3>
        ${renderMcpProofList(findings, "stage-list")}
      </section>
      <section>
        <h3>Claim audit</h3>
        ${renderFactTable(renderLlmClaimAuditRows(artifact))}
      </section>
      <section>
        <h3>Claim evidence</h3>
        ${renderLlmClaimAuditList(artifact)}
      </section>
    </div>
  </section>`;
};

const renderLlmDeliberation = (bundle: UiArtifactBundle): string =>
  `<main class="view" data-view="llm-deliberation">
    <section class="workbench">
      <div class="section-title">
        <h1>LLM deliberation</h1>
      </div>
      <div class="receipt-ledger">
        ${renderLlmDeliberationSummary(bundle)}
        ${renderLlmArtifactMissing(bundle)}
        ${renderLlmPhase(bundle.llmDeliberationBefore, "Before policy injection")}
        ${renderLlmPhase(bundle.llmDeliberationAfter, "After policy injection")}
      </div>
    </section>
  </main>`;

const renderHostedModelSetupRows = (
  setup:
    | {
        configured: boolean;
        requiredEnvironment: Array<{ name: string; status: string }>;
        optionalEnvironment: Array<{ name: string; status: string }>;
        operatorCommand: string;
        secretHandling: string;
      }
    | undefined
): Array<[string, unknown]> => {
  if (!setup) {
    return [];
  }

  return [
    ["Live setup", setup.configured ? "configured" : "blocked"],
    ["Required env", setup.requiredEnvironment.map((item) => `${item.name}:${item.status}`).join(" / ")],
    ["Optional env", setup.optionalEnvironment.map((item) => `${item.name}:${item.status}`).join(" / ")],
    ["Operator command", setup.operatorCommand],
    ["Secret handling", setup.secretHandling]
  ];
};

const renderHostedModelProof = (proof: HostedModelProof | undefined): string => {
  if (!proof) {
    return "";
  }

  return `<section class="panel hosted-model-proof-panel">
    <h2>Hosted model proof</h2>
    ${renderFactTable([
      ["Status", proof.status],
      ["Mode", proof.mode],
      ["Contract", proof.contract.id],
      ["Tool calls", proof.toolCalls.join(" / ")],
      ["Passed tools", proof.passedTools?.join(" / ") || "none"],
      ["Blocked tools", proof.blockedTools?.join(" / ") || "none"],
      [
        "Tool results",
        proof.toolResults?.map((result) => `${result.toolName}:${result.status}`).join(" / ") || "not recorded"
      ],
      ["Rule context", proof.deterministicContext.ruleIds.join(" / ")],
      ["Pass/fail authority", proof.deterministicContext.passFailAuthority],
      ...renderHostedModelSetupRows(proof.setup),
      ["Mutation", proof.mutation ? "yes" : "no"],
      ["Error", proof.error ?? "none"],
      ["Notes", proof.notes]
    ])}
    ${
      proof.assistance
        ? `<div class="saia-compare hosted-model-proof-compare">
            <div>
              <b>Before SPL</b>
              ${code(proof.query)}
            </div>
            <div>
              <b>SAIA recommended SPL</b>
              ${code(proof.assistance.optimizedQuery || "n/a")}
            </div>
          </div>
          <p>${value(proof.assistance.explanation)}</p>
          <p>${value(proof.assistance.rationale)}</p>`
        : `<p class="empty">${value(proof.error ?? "Hosted-model assistance was not returned.")}</p>`
    }
  </section>`;
};

const renderHostedModelDiagnostic = (diagnostic: HostedModelDiagnostic | undefined): string => {
  if (!diagnostic) {
    return "";
  }

  return `<section class="panel hosted-model-diagnostic-panel">
    <h2>Hosted model diagnostic</h2>
    ${renderFactTable([
      ["Status", diagnostic.status],
      ["Blocker", diagnostic.blockerClass],
      ["Mode", diagnostic.mode],
      ["Contract", diagnostic.contract.id],
      ["Required tools", diagnostic.requiredTools.join(" / ")],
      ["Available tools", diagnostic.availableTools.length > 0 ? diagnostic.availableTools.join(" / ") : "none"],
      ["Missing tools", diagnostic.missingTools.length > 0 ? diagnostic.missingTools.join(" / ") : "none"],
      ["Passed tools", diagnostic.passedTools?.join(" / ") || "none"],
      ["Blocked tools", diagnostic.blockedTools?.join(" / ") || "none"],
      [
        "Tool results",
        diagnostic.toolResults?.map((result) => `${result.toolName}:${result.status}`).join(" / ") || "not recorded"
      ],
      ["Permission", diagnostic.permission.status],
      ["Permission blocker", diagnostic.permission.blockerClass],
      ["Error", diagnostic.permission.error ?? "none"],
      ["Required actions", diagnostic.permission.requiredActions?.join(" / ") ?? "none"],
      ["Remediation", diagnostic.remediation?.status ?? "not recorded"],
      ["Remediation summary", diagnostic.remediation?.summary ?? "not recorded"],
      ["Operator checks", diagnostic.remediation?.operatorChecks.join(" / ") ?? "not recorded"],
      ["Rerun", diagnostic.remediation?.rerunCommand ?? "not recorded"],
      ...renderHostedModelSetupRows(diagnostic.setup),
      ["Mutation", diagnostic.mutation ? "yes" : "no"],
      ["Authority", diagnostic.deterministicAuthority],
      ["Notes", diagnostic.notes]
    ])}
  </section>`;
};

const renderProofAuditSummaryRows = (audit: ProofAudit): Array<[string, unknown]> => [
  ["Status", audit.status],
  ["Proof type", audit.proofType],
  ["Mode", audit.mode ?? "n/a"],
  ["Fail to pass", audit.failToPass === undefined ? "n/a" : audit.failToPass ? "yes" : "no"],
  ["Ready after patch", audit.readyAfterPatch === undefined ? "n/a" : audit.readyAfterPatch ? "yes" : "no"],
  ["Proof loop", audit.proofLoop ?? "n/a"],
  ["Mutation", audit.mutation === undefined ? "n/a" : audit.mutation ? "yes" : "no"],
  ["Hosted models", audit.hostedModelStatus ?? "not loaded"]
];

const renderProofAuditPanel = (audit: ProofAudit | undefined): string => {
  if (!audit) {
    return "";
  }

  const failingChecks = audit.checks.filter((check) => check.status !== "PASS");

  return `<section class="panel proof-audit-panel">
    <h2>Proof audit</h2>
    ${renderFactTable([
      ...renderProofAuditSummaryRows(audit),
      ["Checks", audit.checks.map((check) => `${check.id} / ${check.status}`).join(" / ")],
      [
        "Warnings or failures",
        failingChecks.length > 0 ? failingChecks.map((check) => `${check.id}: ${check.detail}`).join(" / ") : "none"
      ]
    ])}
  </section>`;
};

const renderPublicProofExportPanel = (manifest: PublicProofExportManifest | undefined): string => {
  if (!manifest) {
    return "";
  }

  const schemaValidated = manifest.files.filter((file) => file.schemaValidated).length;

  return `<section class="panel public-proof-export-panel">
    <h2>Public proof export</h2>
    ${renderFactTable([
      ["Status", manifest.redactionStatus],
      ["Source run", manifest.sourceRunId],
      ["Source commit", manifest.sourceCommit],
      ["Files", manifest.files.length],
      ["Schema-validated files", schemaValidated],
      ["Aggregate hash", manifest.aggregateSha256],
      ["Redactions", Object.entries(manifest.redaction).map(([key, status]) => `${key}: ${status}`).join(" / ")],
      ["Boundary", "sanitized derivative bundle; not the unredacted source proof"]
    ])}
  </section>`;
};

const renderJudgeProofPanel = (summary: JudgeProofSummary | undefined): string => {
  if (!summary) {
    return "";
  }

  const failingGates = summary.gates.filter((gate) => gate.status !== "PASS");

  return `<section class="panel judge-proof-panel">
    <h2>Judge proof</h2>
    ${renderFactTable([
      ["Status", summary.status],
      ["Mode", summary.mode],
      ["Mutation", summary.mutation ? "yes" : "no"],
      ["Suite proof", summary.proofDirs.suite],
      ["Firewall proof", summary.proofDirs.firewall],
      ["LLM evidence", summary.llmEvidence.status],
      ["LLM role", summary.llmEvidence.role],
      ["Pass/fail authority", summary.llmEvidence.passFailAuthority],
      ["LLM included", summary.llmActivation.included ? "yes" : "no"],
      ["LLM configured", summary.llmActivation.configured ? "yes" : "no"],
      ["Credential-free reason", summary.llmEvidence.reason ?? "n/a"],
      ["Gates", summary.gates.map((gate) => `${gate.id} / ${gate.status}`).join(" / ")],
      [
        "Warnings or failures",
        failingGates.length > 0 ? failingGates.map((gate) => `${gate.id}: ${gate.status}`).join(" / ") : "none"
      ],
      ["Next LLM command", summary.llmEvidence.nextCommand]
    ])}
  </section>`;
};

const renderPlatformDevexProofPanel = (summary: PlatformDevexProof | undefined): string => {
  if (!summary) {
    return "";
  }

  return `<section class="panel platform-proof-panel">
    <h2>Platform proof</h2>
    ${renderFactTable([
      ["Status", summary.status],
      ["Mutation", summary.mutation ? "yes" : "no"],
      ["Deterministic authority", summary.deterministicAuthority ? "yes" : "no"],
      ["Fixture receipt", `${summary.receipts.fixtureBefore} -> ${summary.receipts.fixtureAfter}`],
      ["MCP transcript receipt", summary.receipts.transcript],
      ["Steps", summary.steps.map((step) => `${step.label}: ${step.command}`).join(" / ")],
      ["Fixture replay", summary.routes.fixtureReplay],
      ["Transcript receipt", summary.routes.transcriptReceipt]
    ])}
  </section>`;
};

const renderSuiteMissionRows = (summary: SuiteProofSummary): string =>
  summary.missions
    .map(
      (mission) => `<tr>
        <td>${code(mission.missionId)}<span>${value(mission.title)}</span></td>
        <td>${value(mission.domain)}</td>
        <td>${value(mission.proofLoop)}</td>
        <td>${value(`${mission.before.verdict} / ${mission.before.score} / ${mission.before.violations} violation(s)`)}</td>
        <td>${value(`${mission.after.verdict} / ${mission.after.score} / ${mission.after.violations} violation(s)`)}</td>
        <td>${value(mission.after.evidenceRefs.length)}</td>
        <td>${code(mission.artifactDir)}</td>
      </tr>`
    )
    .join("");

const renderSuiteProof = (bundle: UiArtifactBundle): string => {
  const summary = bundle.suiteProofSummary;

  return `<main class="view" data-view="suite-proof">
    <section class="workbench">
      <div class="section-title">
        <h1>Suite proof</h1>
      </div>
      ${
        summary
          ? `<section class="panel">
              <h2>Suite summary</h2>
              ${renderFactTable([
                ["Status", summary.status],
                ["Mode", summary.mode],
                ["Suite", summary.suiteId],
                ["Title", summary.suiteTitle ?? "not recorded"],
                ["Manifest", summary.suitePath ?? "not recorded"],
                ["Missions", summary.missionCount],
                ["Domains", summary.domains.join(" / ")],
                ["Fail-to-pass missions", summary.totals.failToPass],
                ["READY after patch", summary.totals.readyAfterPatch],
                ["Evidence refs", summary.totals.evidenceRefs],
                ["Mutation", summary.mutation ? "yes" : "no"]
              ])}
            </section>
            ${renderProofAuditPanel(bundle.proofAudit)}
            <section class="panel suite-proof-panel">
              <h2>Mission ledger</h2>
              <table class="suite-table">
                <thead>
                  <tr>
                    <th>Mission</th>
                    <th>Domain</th>
                    <th>Proof loop</th>
                    <th>Before</th>
                    <th>After</th>
                    <th>Evidence</th>
                    <th>Artifacts</th>
                  </tr>
                </thead>
                <tbody>${renderSuiteMissionRows(summary)}</tbody>
              </table>
            </section>`
          : `<section class="panel">
              <h2>Suite summary</h2>
              <p class="empty">Suite proof artifact not loaded.</p>
            </section>`
      }
    </section>
  </main>`;
};

const indexEntryHref = (proofDir: string, view: ViewId): string => `?artifacts=${encodeURIComponent(proofDir)}#${view}`;

const renderCertificationIndexRows = (index: CertificationIndex): string =>
  index.entries
    .map((entry) => {
      const receipt = entry.receipt;
      const receiptHref = entry.href || indexEntryHref(entry.proofDir, "receipt");
      const traceHref = indexEntryHref(entry.proofDir, "trace-timeline");

      return `<tr>
        <td data-label="Agent">${value(entry.label)}<span>${value(entry.agent.version)}</span></td>
        <td data-label="Domain / mission">${value(entry.domains.length > 0 ? entry.domains.join(" / ") : "n/a")}<span>${value(
          entry.missions.length > 0 ? entry.missions.join(" / ") : "no missions"
        )}</span></td>
        <td data-label="Audit">${value(entry.status)}<span>${value(entry.proofType)}</span></td>
        <td data-label="Receipt">${value(receipt?.verdict ?? "NO RECEIPT")}<span>${value(receipt ? `${receipt.score}/100` : "--")}</span></td>
        <td data-label="Loop / mutation">${value(entry.proofLoop ?? "n/a")}<span>${value(entry.mutation === null ? "mutation unknown" : entry.mutation ? "mutation yes" : "mutation no")}</span></td>
        <td data-label="Manifest">${value(entry.manifestStatus)}<span>${value(
          entry.manifest ? `${entry.manifest.files} files / ${entry.manifest.aggregateSha256.slice(0, 12)}` : "no manifest"
        )}</span></td>
        <td data-label="Proof links">
          <a href="${value(receiptHref)}" data-proof-artifact="${value(entry.proofDir)}" data-proof-view="receipt">Receipt</a>
          <a href="${value(traceHref)}" data-proof-artifact="${value(entry.proofDir)}" data-proof-view="trace-timeline">Trace</a>
          <span>${value(receipt ? `${receipt.violations} violation(s) / ${receipt.evidenceRefs} ref(s)` : "no receipt")}</span>
        </td>
      </tr>`;
    })
    .join("");

const renderCertificationIndexJobStatus = (workbench: WorkbenchRenderState | undefined): string => {
  const job = workbench?.job?.workflow === "certification-index" ? workbench.job : undefined;

  if (!job) {
    return "";
  }

  return `<section class="panel">
    <h2>Index job</h2>
    ${renderFactTable([
      ["Job", `${job.id} / ${job.state}`],
      ["Run", job.runId],
      ["Input", job.inputSummary ?? "not recorded"],
      ["Artifacts", job.artifactBase || "not allocated"],
      ["Error", job.error ?? "none"]
    ])}
    ${
      job.events.length > 0
        ? `<ol class="job-events" aria-label="Certification index job events">
            ${job.events
              .map((event) => `<li data-job-event="${value(event.type)}"><strong>${value(event.type)}</strong><span>${value(event.message)}</span></li>`)
              .join("")}
          </ol>`
        : ""
    }
  </section>`;
};

const renderCertificationIndexWorkbench = (workbench: WorkbenchRenderState | undefined): string => {
  const running = workbench?.job?.state === "queued" || workbench?.job?.state === "running";
  const runs = sortRunsByCreatedAt((workbench?.runs ?? []).filter(isIndexableRun));
  const disabled = !workbench?.available || running || runs.length < 2;
  const selected = new Set(runs.slice(0, 2).map((run) => run.runId));

  return `<section class="panel certification-index-builder">
    <h2>Generate from managed runs</h2>
    ${renderFactTable([
      ["Backend", workbench?.available ? (workbench.healthStatus ?? "available") : "not connected"],
      ["Selectable proofs", runs.length],
      ["Boundary", "managed artifact run IDs only"],
      ["Verification", "server verifies every proof manifest before indexing"],
      ["Mutation", "false"]
    ])}
    <form class="index-run-form" data-certification-index-form>
      ${
        runs.length === 0
          ? `<p class="empty">No managed proof runs with proof audit and manifest artifacts are available.</p>`
          : `<div class="index-run-list">
              ${runs
                .map(
                  (run) => `<label class="index-run-row">
                    <input type="checkbox" value="${value(run.runId)}" data-index-run ${selected.has(run.runId) ? "checked" : ""} ${
                      disabled ? "disabled" : ""
                    }>
                    <span>
                      ${code(run.runId)}
                      <em>${value(run.workflow)} / ${value(run.verdict)} / audit ${value(run.proofAuditStatus)} / manifest ${value(run.manifestStatus)}</em>
                    </span>
                  </label>`
                )
                .join("")}
            </div>`
      }
      <button class="replay-button" type="submit" ${disabled ? "disabled" : ""}>Generate certification index</button>
    </form>
  </section>`;
};

const renderCertificationIndex = (bundle: UiArtifactBundle, options: RenderOptions): string => {
  const index = bundle.certificationIndex;

  if (!index) {
    return `<main class="view" data-view="agent-index">
      <section class="workbench">
        <div class="section-title"><h1>Agent certification index</h1></div>
        <div class="receipt-ledger">
          ${renderCertificationIndexWorkbench(options.workbench)}
          ${renderCertificationIndexJobStatus(options.workbench)}
          <section class="panel">
            <h2>Index artifact not loaded</h2>
            ${renderFactTable([
              ["Expected artifact", "certification-index.json"],
              [
                "Command",
                "npm run splunkready -- certification-index --proof-dirs artifacts/live-security-ui,artifacts/mcp-transcript --out artifacts/certification-index --json"
              ]
            ])}
          </section>
        </div>
      </section>
    </main>`;
  }

  return `<main class="view" data-view="agent-index">
    <section class="workbench">
      <div class="section-title"><h1>Agent certification index</h1></div>
      <div class="receipt-ledger">
        ${renderCertificationIndexWorkbench(options.workbench)}
        ${renderCertificationIndexJobStatus(options.workbench)}
        <section class="panel">
          <h2>Index summary</h2>
          ${renderFactTable([
            ["Status", index.status],
            ["Proofs", index.totals.proofs],
            ["Ready receipts", index.totals.ready],
            ["Not ready receipts", index.totals.notReady],
            ["Audit pass / warn / fail", `${index.totals.pass} / ${index.totals.warn} / ${index.totals.fail}`],
            ["Mutation", index.mutation ? "yes" : "no"],
            ["Generated", index.generatedAt]
          ])}
        </section>
        <section class="panel">
          <h2>Agent proofs</h2>
          <table class="index-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Domain / mission</th>
                <th>Audit</th>
                <th>Receipt</th>
                <th>Loop / mutation</th>
                <th>Manifest</th>
                <th>Proof links</th>
              </tr>
            </thead>
            <tbody>${renderCertificationIndexRows(index)}</tbody>
          </table>
        </section>
      </div>
    </section>
  </main>`;
};

const renderFirewallBlock = (block: FirewallBlock | undefined): string => {
  if (!block) {
    return "";
  }

  return `<section class="panel firewall-block-panel">
    <h2>Firewall block</h2>
    ${renderFactTable([
      ["Status", block.status],
      ["Code", block.code],
      ["Phase", block.phase],
      ["Tool", block.toolName],
      ["Request", block.requestId],
      ["Mission", block.missionId ?? "n/a"],
      ["Blocked before Splunk", block.blockedBeforeSplunk ? "yes" : "no"],
      ["Mutation", block.mutation ? "yes" : "no"],
      ["Query", block.query ?? "n/a"],
      ["Rules", (block.violations ?? []).map((violation) => `${violation.ruleId}: ${violation.reason}`).join(" / ")],
      ["Message", block.message]
    ])}
  </section>`;
};

const renderLiveSecurityReadiness = (bundle: UiArtifactBundle): string => {
  const readiness = bundle.liveSecurityReadiness;

  if (!readiness) {
    return "";
  }

  const run = readiness.requiredSavedSearch.run;
  const runSummary = run.attempted
    ? `${run.resultCount ?? "n/a"} row(s), ${run.evidenceRefs.length} evidence ref(s)${
        run.error ? `, ${run.error}` : ""
      }`
    : run.reason;
  const setupSummary = readiness.setupRequirements
    .map((requirement) => `${requirement.id}: ${requirement.satisfied ? "ready" : "missing"}`)
    .join(" / ");
  const setupSummaryLabel = setupSummary.length > 0 ? setupSummary : "not recorded (legacy readiness artifact)";

  return `<section class="panel live-security-panel">
    <h2>Flagship security readiness</h2>
    ${renderFactTable([
      ["Status", readiness.status],
      ["Proof mode", `${readiness.proofMode.type} / fallback ${readiness.proofMode.fallbackAllowed ? "allowed" : "blocked"}`],
      ["Mission", `${readiness.mission.id} / ${readiness.mission.story}`],
      ["Contract", `${readiness.contract.id} / ${readiness.contract.name}`],
      ["Saved search", `${readiness.requiredSavedSearch.ref} / ${readiness.requiredSavedSearch.present ? "present" : "missing"}`],
      ["Saved-search run", runSummary],
      ["Preferred index", `${readiness.preferredIndex.name} / ${readiness.preferredIndex.present ? "present" : "missing"}`],
      ["Setup requirements", setupSummaryLabel],
      ["Generic fallback", `${readiness.fallbackPolicy.genericLiveCommand} / ${readiness.fallbackPolicy.genericLiveDescription}`],
      ["Missing tools", readiness.requiredTools.missing.length > 0 ? readiness.requiredTools.missing.join(" / ") : "none"],
      ["Blockers", readiness.blockers.length > 0 ? readiness.blockers.join(" / ") : "none"],
      ["Next actions", readiness.nextActions.join(" / ")]
    ])}
  </section>`;
};

const renderLiveSecurityKit = (bundle: UiArtifactBundle): string => {
  const kit = bundle.liveSecurityKit;

  if (!kit) {
    return "";
  }

  const validation = kit.validation;
  const failedChecks = validation?.checks.filter((check) => check.status === "FAIL") ?? [];

  return `<section class="panel live-security-kit-panel">
    <h2>Operator security kit</h2>
    ${renderFactTable([
      ["Status", kit.status],
      ["Validation", validation ? `${validation.status} / ${failedChecks.length} failed check(s)` : "not recorded"],
      ["Mission", kit.mission],
      ["Saved search", kit.savedSearch.ref],
      ["Preferred index", kit.preferredIndex],
      ["Sourcetype", kit.sourcetype],
      ["Sample events", kit.sampleEvents],
      ["Operator action", kit.operatorActionRequired ? "required" : "not required"],
      ["Mutation", kit.mutation ? "yes" : "no"],
      ["SplunkReady write operations", "none"],
      ["Generated", kit.generatedAt]
    ])}
    <div class="kit-detail-grid">
      <section class="kit-detail">
        <h3>Generated files</h3>
        ${renderPlainList(kit.artifacts, "kit-file-list")}
      </section>
      <section class="kit-detail">
        <h3>Validation checks</h3>
        ${
          validation
            ? `<table class="kit-validation-table">
                <thead><tr><th>Check</th><th>Status</th><th>Evidence</th></tr></thead>
                <tbody>${validation.checks
                  .map((check) => `<tr><td>${code(check.id)}<span>${value(check.path)}</span></td><td>${value(check.status)}</td><td>${value(check.detail)}</td></tr>`)
                  .join("")}</tbody>
              </table>`
            : `<p class="empty">Validation artifact not recorded.</p>`
        }
      </section>
      <section class="kit-detail">
        <h3>Operator warnings</h3>
        ${renderPlainList(kit.operatorWarnings ?? ["Operator-owned install/import only; SplunkReady performs no Splunk write operation."], "kit-note-list")}
      </section>
      <section class="kit-detail">
        <h3>Cleanup guidance</h3>
        ${renderPlainList(kit.cleanupGuidance ?? ["Cleanup is operator-owned and outside SplunkReady."], "kit-note-list")}
      </section>
    </div>
  </section>`;
};

const renderWorkbenchRunPanel = (workbench: WorkbenchRenderState | undefined): string => {
  const job = workbench?.job;
  const events = job?.events ?? [];
  const disabled = !workbench?.available || job?.state === "queued" || job?.state === "running";

  return `<section class="panel workbench-run-panel">
    <div class="run-panel-header">
      <h2>Fixture certification run</h2>
      <button class="replay-button" type="button" data-run-fixture-certification ${disabled ? "disabled" : ""}>
        Run fixture certification
      </button>
    </div>
    ${renderFactTable([
      ["Backend", workbench?.available ? (workbench.healthStatus ?? "available") : "not connected"],
      ["Job", job ? `${job.id} / ${job.state}` : "none"],
      ["Run", job ? job.runId : "server-owned run directory allocated after start"],
      ["Artifact base", job ? job.artifactBase : "n/a"],
      ["Error", job?.error ?? "none"]
    ])}
    ${
      events.length > 0
        ? `<ol class="job-events" aria-label="Workbench job events">
            ${events
              .map((event) => `<li data-job-event="${value(event.type)}"><strong>${value(event.type)}</strong><span>${value(event.message)}</span></li>`)
              .join("")}
          </ol>`
        : `<p class="empty">${value(
            workbench?.available
              ? "Start a server-owned fixture certification to produce fresh artifacts."
              : "Start the local workbench backend to execute runs from this screen."
          )}</p>`
    }
  </section>`;
};

const liveActionRows = [
  ["live-smoke", "Run live smoke", "Compile read-only MCP inventory and readiness profile."],
  ["live-candidates", "Scan saved searches", "Run bounded saved-search candidates from the compiled live contract."],
  ["live-security-readiness", "Check security readiness", "Verify flagship saved-search evidence without mutating Splunk."],
  ["live-security-proof", "Run security proof", "Execute the strict LLM fail-to-pass proof only when readiness is green."]
] as const;

const liveKitActionRows = [
  ["live-security-kit", "Generate operator kit", "Write local app, saved search, sample CSV, README, and validation manifest."]
] as const;

const hostedModelActionRows = [
  ["hosted-model-diagnostic", "Check SAIA entitlement", "Call hosted-model helper tools only; report PASS or BLOCKED."],
  ["hosted-model-proof", "Run hosted-model proof", "Collect advisory generate/explain/optimize/ask output without executing SPL."]
] as const;

const renderLiveActionPanel = (workbench: WorkbenchRenderState | undefined): string => {
  const job = workbench?.job;
  const running = job?.state === "queued" || job?.state === "running";
  const liveAvailable = workbench?.liveAvailable === true;
  const disabled = !workbench?.available || !liveAvailable || running;
  const kitDisabled = !workbench?.available || running;
  const missing = workbench?.liveMissing ?? [];
  const status = !workbench?.available
    ? "workbench backend not connected"
    : liveAvailable
      ? "available from server env"
      : `unavailable: ${missing.join(" / ") || "live env not configured"}`;

  return `<section class="panel live-action-panel">
    <h2>Live workbench actions</h2>
    ${renderFactTable([
      ["Backend", workbench?.available ? (workbench.healthStatus ?? "available") : "not connected"],
      ["Live mode", status],
      [
        "SAIA",
        workbench?.saiaAvailable
          ? "available"
          : liveAvailable
            ? "not confirmed; diagnostic may return BLOCKED"
            : "not available"
      ],
      ["SAIA authority", "advisory only"],
      ["Browser credentials", "not accepted"],
      ["Operator kit", "local generation; no live credentials required"],
      ["Mutation", "false"]
    ])}
    <div class="live-action-list kit-action-list">
      ${liveKitActionRows
        .map(
          ([workflow, label, detail]) => `<button class="replay-button live-action-button" type="button" data-run-workflow="${workflow}" ${kitDisabled ? "disabled" : ""}>
            <strong>${value(label)}</strong>
            <span>${value(detail)}</span>
          </button>`
        )
        .join("")}
    </div>
    <div class="live-action-list">
      ${liveActionRows
        .map(
          ([workflow, label, detail]) => `<button class="replay-button live-action-button" type="button" data-run-workflow="${workflow}" ${disabled ? "disabled" : ""}>
            <strong>${value(label)}</strong>
            <span>${value(detail)}</span>
          </button>`
        )
        .join("")}
    </div>
    <div class="live-action-list hosted-model-action-list">
      ${hostedModelActionRows
        .map(
          ([workflow, label, detail]) => `<button class="replay-button live-action-button" type="button" data-run-workflow="${workflow}" ${disabled ? "disabled" : ""}>
            <strong>${value(label)}</strong>
            <span>${value(detail)}</span>
          </button>`
        )
        .join("")}
    </div>
    ${
      job
        ? `<div class="job-status">
            ${renderFactTable([
              ["Job", `${job.id} / ${job.workflow ?? "unknown"} / ${job.state}`],
              ["Run", job.runId],
              ["Artifacts", job.artifactBase || "not allocated"],
              ["Error", job.error ?? "none"]
            ])}
            <ol class="job-events" aria-label="Live workbench job events">
              ${job.events
                .map((event) => `<li data-job-event="${value(event.type)}"><strong>${value(event.type)}</strong><span>${value(event.message)}</span></li>`)
                .join("")}
            </ol>
          </div>`
        : `<p class="empty">${value(
            liveAvailable
              ? "Run a server-owned live action to produce fresh live artifacts."
              : `Live mode unavailable for live checks. The local operator kit can still be generated without credentials. Missing server env: ${missing.join(", ") || "SPLUNKREADY_LIVE_ENABLED=true, SPLUNKREADY_SPLUNK_MCP_URL, SPLUNKREADY_SPLUNK_MCP_TOKEN"}.`
          )}</p>`
    }
  </section>`;
};

const renderReplay = (bundle: UiArtifactBundle, options: RenderOptions): string => {
  const before = bundle.beforeReceipt;
  const after = bundle.afterReceipt;
  const patch = bundle.policyPatch;
  const proof = bundle.liveProofSummary;
  const resolved = before && after ? Math.max(0, before.violations.length - after.violations.length) : 0;
  const stages = proof?.readyWithoutPatch
    ? [
        ["Certify", before?.verdict ?? "missing", `${bundle.beforeTrace.length} trace event(s)`],
        ["Patch", "not needed", "before receipt was READY"],
        ["Rerun", after ? "complete" : "missing", `${bundle.afterTrace.length} trace event(s)`],
        ["Ready", after?.verdict ?? "missing", `${after?.violations.length ?? 0} violation(s)`]
      ]
    : [
        ["Fail", before?.verdict ?? "missing", `${bundle.beforeViolations.length} deterministic violation(s)`],
        ["Patch", patch?.status ?? "missing", `${patch?.rules.length ?? 0} rule(s), ${patch?.splAssistance?.length ?? 0} SAIA item(s)`],
        ["Rerun", after ? "complete" : "missing", `${bundle.afterTrace.length} trace event(s)`],
        ["Pass", after?.verdict ?? "missing", `${resolved} resolved violation(s)`]
      ];
  const patchEmptyMessage = proof?.readyWithoutPatch
    ? "No policy patch was exported because the live-derived mission was READY before policy injection."
    : "Policy patch artifact not loaded.";

  return `<main class="view replay-view" data-view="certification-replay">
    <section class="workbench">
      <div class="section-title">
        <h1>Certification replay</h1>
      </div>
      ${renderWorkbenchRunPanel(options.workbench)}
      ${renderProofArtifactWarning(bundle)}
      <ol class="stage-line" aria-label="Certification replay stages">
        ${stages.map(([title, status, detail], index) => renderStage(index + 1, title, status, detail)).join("")}
      </ol>
      <div class="replay-grid">
        ${renderReceiptPanel(before, "Before")}
        ${renderReceiptPanel(after, "After")}
      </div>
      ${renderLiveProofSummary(bundle)}
      <section class="panel patch-panel">
        <h2>Patch evidence</h2>
        ${renderPolicyPatchSummary(patch, patchEmptyMessage)}
      </section>
    </section>
  </main>`;
};

const policyActionRows = [
  ["policy-backed-rerun", "Run policy-backed rerun", "Generate NOT READY, export policy additions, rerun under compiled policy."],
  ["firewall-check", "Run firewall check", "Compile policy and block unsafe SPL before any Splunk execution."]
] as const;

const renderPolicyWorkbenchPanel = (workbench: WorkbenchRenderState | undefined): string => {
  const job = workbench?.job;
  const running = job?.state === "queued" || job?.state === "running";
  const disabled = !workbench?.available || running;

  return `<section class="panel policy-action-panel">
    <h2>Policy workbench</h2>
    ${renderFactTable([
      ["Backend", workbench?.available ? (workbench.healthStatus ?? "available") : "not connected"],
      ["Patch semantics", "exported additions for human review"],
      ["Firewall scope", "pre-execution Splunk tool gate"],
      ["Mutation", "false"],
      ["Pass/fail authority", "deterministic-rule-engine"]
    ])}
    <div class="live-action-list policy-action-list">
      ${policyActionRows
        .map(
          ([workflow, label, detail]) => `<button class="replay-button live-action-button" type="button" data-run-workflow="${workflow}" ${disabled ? "disabled" : ""}>
            <strong>${value(label)}</strong>
            <span>${value(detail)}</span>
          </button>`
        )
        .join("")}
    </div>
    ${
      job
        ? `<div class="job-status">
            ${renderFactTable([
              ["Job", `${job.id} / ${job.workflow ?? "unknown"} / ${job.state}`],
              ["Run", job.runId],
              ["Artifacts", job.artifactBase || "not allocated"],
              ["Error", job.error ?? "none"]
            ])}
            <ol class="job-events" aria-label="Policy workbench job events">
              ${job.events
                .map((event) => `<li data-job-event="${value(event.type)}"><strong>${value(event.type)}</strong><span>${value(event.message)}</span></li>`)
                .join("")}
            </ol>
          </div>`
        : `<p class="empty">${value(
            workbench?.available
              ? "Run a server-owned policy action to produce fresh review artifacts."
              : "Start the local workbench backend to execute policy actions from this screen."
          )}</p>`
    }
  </section>`;
};

const renderPolicyFirewall = (bundle: UiArtifactBundle, options: RenderOptions): string => {
  const before = bundle.beforeReceipt;
  const after = bundle.afterReceipt;
  const patch = bundle.policyPatch;
  const resolvedViolations = stringListFromUnknown(after?.rerunComparison["resolvedViolations"]);

  return `<main class="view policy-firewall-view" data-view="policy-firewall">
    <section class="workbench">
      <div class="section-title">
        <h1>Policy and firewall</h1>
      </div>
      <div class="receipt-ledger">
        ${renderPolicyWorkbenchPanel(options.workbench)}
        <section class="panel">
          <h2>Readiness transition</h2>
          ${renderFactTable([
            ["Before", before ? `${before.verdict} / ${before.score}` : "not loaded"],
            ["After", after ? `${after.verdict} / ${after.score}` : "not loaded"],
            ["Resolved violations", resolvedViolations.length > 0 ? resolvedViolations.join(" / ") : "n/a"],
            ["Receipt authority", "receipt artifacts"],
            ["UI recalculation", "none"]
          ])}
        </section>
        <section class="panel patch-panel policy-patch-panel">
          <h2>Exported policy additions</h2>
          ${renderFactTable([
            ["Patch", patch?.id ?? "not loaded"],
            ["Status", patch?.status ?? "not loaded"],
            ["Source receipt", patch?.sourceReceiptId ?? "not loaded"],
            ["Violation refs", patch?.violationRefs.join(" / ") ?? "n/a"],
            ["Mutation", "false"],
            ["Splunk apply action", "none"]
          ])}
          ${renderPolicyPatchSummary(patch)}
        </section>
        <section class="panel">
          <h2>Violation mapping</h2>
          ${renderPatchViolationMap(patch, bundle.beforeViolations)}
        </section>
        ${renderFirewallBlock(bundle.firewallBlock)}
        ${renderProofAuditPanel(bundle.proofAudit)}
      </div>
    </section>
  </main>`;
};

const renderReceipt = (bundle: UiArtifactBundle, options: RenderOptions): string => {
  const receipt = bundle.receipt;
  const policyRows: Array<[string, unknown]> = receipt?.policy
    ? [["Policy", `${receipt.policy.name} ${receipt.policy.version} / ${receipt.policy.id}`]]
    : [];
  const isReady =
    receipt !== undefined &&
    receipt.verdict.toUpperCase().includes("READY") &&
    !receipt.verdict.toUpperCase().includes("NOT");
  const verdictBanner = receipt
    ? `<div class="receipt-verdict-banner ${isReady ? "ready" : "not-ready"}" aria-label="Current receipt verdict">
        <span class="receipt-verdict-mark" aria-hidden="true">${isReady ? "PASS" : "FAIL"}</span>
        <span>Verdict ${value(receipt.verdict)}</span>
        <span>Score ${value(receipt.score)}</span>
        <span>Deterministic rule engine</span>
      </div>`
    : "";

  return `<main class="view" data-view="receipt">
    <section class="workbench">
      <div class="section-title">
        <h1>Readiness Receipt</h1>
      </div>
      ${renderProofArtifactWarning(bundle)}
      ${verdictBanner}
      <div class="receipt-simulator-layout">
        <section class="panel receipt-book">
          <section class="receipt-book-section">
            <h2>Current receipt</h2>
            ${receipt ? renderFactTable([
              ["Receipt", receipt.id],
              ["Verdict", receipt.verdict],
              ["Score", receipt.score],
              ["Contract", `${receipt.environment.id} / ${receipt.contractVersion}`],
              ...policyRows,
              ["Trace refs", receipt.traceRefs.length],
              ["Evidence refs", receipt.evidenceRefs.length],
              ["Violations", receipt.violations.length]
            ]) : `<p class="empty">Receipt artifact not loaded.</p>`}
        </section>
        <section class="receipt-book-section">
          <h2>Rerun comparison</h2>
          ${renderFactTable([
            ["Before verdict", bundle.beforeReceipt?.verdict ?? "n/a"],
            ["After verdict", bundle.afterReceipt?.verdict ?? "n/a"],
            ["Before score", bundle.beforeReceipt?.score ?? "n/a"],
            ["After score", bundle.afterReceipt?.score ?? "n/a"],
            ["Resolved violations", receipt?.rerunComparison["resolvedViolations"] ?? []]
          ])}
        </section>
        ${
          bundle.externalReceipt
            ? `<section class="receipt-book-section">
                <h2>External agent receipt</h2>
                ${renderFactTable([
                  ["Receipt", bundle.externalReceipt.id],
                  ["Agent", `${bundle.externalReceipt.agent.name} ${bundle.externalReceipt.agent.version}`],
                  ["Verdict", bundle.externalReceipt.verdict],
                  ["Score", bundle.externalReceipt.score],
                  ["Trace refs", bundle.externalReceipt.traceRefs.length],
                  ["Violations", bundle.externalReceipt.violations.length],
                  ["Mode", bundle.externalReceipt.mode]
                ])}
              </section>`
            : ""
        }
        ${
          bundle.mcpTranscriptImport
            ? `<section class="receipt-book-section">
                <h2>MCP transcript import</h2>
                ${renderFactTable([
                  ["Mission", bundle.mcpTranscriptImport.missionId],
                  ["Strict import", bundle.mcpTranscriptImport.strictImport ? "yes" : "no"],
                  ["Imported events", bundle.mcpTranscriptImport.importedEvents],
                  ["Tool calls", bundle.mcpTranscriptImport.toolCalls],
                  ["Tool results", bundle.mcpTranscriptImport.toolResults],
                  ["Skipped records", bundle.mcpTranscriptImport.skippedRecords],
                  ["Unmatched tool calls", bundle.mcpTranscriptImport.unmatchedToolCalls ?? "not recorded"],
                  ["Tools", bundle.mcpTranscriptImport.toolNames.join(" / ") || "none"]
                ])}
              </section>`
            : ""
        }
        <section class="receipt-book-section">
          <h2>Evidence</h2>
          ${renderFactTable([
            ["Trace refs", receipt?.traceRefs.join(" / ") ?? "n/a"],
            ["Evidence refs", receipt?.evidenceRefs.join(" / ") ?? "n/a"],
            ["Readiness profile", bundle.readinessProfile?.id ?? "not loaded"],
            ["Policy patch", bundle.policyPatch?.id ?? "not loaded"]
          ])}
        </section>
        ${
          bundle.proofAudit
            ? `<section class="receipt-book-section">
                <h2>Proof audit</h2>
                ${renderFactTable(renderProofAuditSummaryRows(bundle.proofAudit))}
              </section>`
            : ""
        }
        ${
          bundle.firewallBlock
            ? `<section class="receipt-book-section">
                <h2>Firewall block</h2>
                ${renderFactTable([
                  ["Status", bundle.firewallBlock.status],
                  ["Phase", bundle.firewallBlock.phase],
                  ["Tool", bundle.firewallBlock.toolName],
                  ["Blocked before Splunk", bundle.firewallBlock.blockedBeforeSplunk ? "yes" : "no"],
                  ["Mutation", bundle.firewallBlock.mutation ? "yes" : "no"],
                  ["Rules", (bundle.firewallBlock.violations ?? []).map((item) => item.ruleId).join(" / ")],
                  ["Query", bundle.firewallBlock.query ?? "n/a"]
                ])}
              </section>`
            : ""
        }
        ${
          bundle.liveSecurityProofSummary
            ? `<section class="receipt-book-section">
                <h2>Flagship security proof</h2>
                ${renderFactTable([
                  ["Readiness", bundle.liveSecurityProofSummary.readinessStatus],
                  [
                    "Before",
                    `${bundle.liveSecurityProofSummary.before.verdict} / ${bundle.liveSecurityProofSummary.before.score}`
                  ],
                  [
                    "After",
                    `${bundle.liveSecurityProofSummary.after.verdict} / ${bundle.liveSecurityProofSummary.after.score}`
                  ],
                  ["Fail to pass", bundle.liveSecurityProofSummary.failToPass ? "yes" : "no"],
                  ["Ready after patch", bundle.liveSecurityProofSummary.readyAfterPatch ? "yes" : "no"]
                ])}
              </section>`
            : bundle.liveProofSummary
              ? `<section class="receipt-book-section">
                  <h2>Live proof summary</h2>
                  ${renderLiveProofSummaryTable(bundle)}
                </section>`
              : bundle.liveSecurityReadiness
                ? `<section class="receipt-book-section">
                    <h2>Flagship security readiness</h2>
                    ${renderFactTable([
                      ["Status", bundle.liveSecurityReadiness.status],
                      [
                        "Proof mode",
                        `${bundle.liveSecurityReadiness.proofMode.type} / fallback ${
                          bundle.liveSecurityReadiness.proofMode.fallbackAllowed ? "allowed" : "blocked"
                        }`
                      ],
                      ["Saved search", bundle.liveSecurityReadiness.requiredSavedSearch.ref],
                      [
                        "Saved-search run",
                        bundle.liveSecurityReadiness.requiredSavedSearch.run.attempted
                          ? `${bundle.liveSecurityReadiness.requiredSavedSearch.run.resultCount ?? "n/a"} row(s)`
                          : bundle.liveSecurityReadiness.requiredSavedSearch.run.reason
                      ],
                      [
                        "Blockers",
                        bundle.liveSecurityReadiness.blockers.length > 0
                          ? bundle.liveSecurityReadiness.blockers.join(" / ")
                          : "none"
                      ]
                    ])}
                  </section>`
                : ""
        }
        </section>
        ${renderPolicySimulator(bundle, options)}
      </div>
    </section>
  </main>`;
};

const eventSummary = (event: TraceEvent): string => {
  if (event.toolInput && typeof event.toolInput["query"] === "string") {
    return event.toolInput["query"];
  }

  if (event.toolInput && typeof event.toolInput["name"] === "string") {
    return `${event.toolInput["app"] ?? "search"}::${event.toolInput["name"]}`;
  }

  return event.toolOutputSummary ?? event.type;
};

const renderFindings = (
  violations: Violation[],
  assistanceByViolation: Map<string, NonNullable<PolicyPatch["splAssistance"]>[number]>
): string => {
  if (violations.length === 0) {
    return "None";
  }

  return `<div class="finding-list">${violations
    .map((violation) => {
      const assistance = assistanceByViolation.get(violation.id);
      const beforeSpl = typeof violation.evidence["query"] === "string" ? violation.evidence["query"] : assistance?.query;

      return `<article class="finding">
        <strong>${value(violation.ruleId)}</strong>
        <p>${value(violation.reason)}</p>
        ${
          assistance
            ? `<div class="saia-compare">
                <div>
                  <b>Before SPL</b>
                  ${code(beforeSpl ?? "n/a")}
                </div>
                <div>
                  <b>SAIA recommended SPL</b>
                  ${code(assistance.optimizedQuery)}
                </div>
              </div>
              <p>${value(assistance.explanation)}</p>`
            : ""
        }
      </article>`;
    })
    .join("")}</div>`;
};

const renderTraceRows = (events: TraceEvent[], violations: Violation[], policyPatch: PolicyPatch | undefined): string => {
  const groupedViolations = violationByEvent(violations);
  const assistanceByViolation = splAssistanceByViolation(policyPatch);

  if (events.length === 0) {
    return `<tr><td colspan="5">Trace artifact not loaded.</td></tr>`;
  }

  return events
    .map((event, index) => {
      const eventViolations = groupedViolations.get(event.id) ?? [];
      return `<tr>
        <td>${index + 1}</td>
        <td>${code(event.id)}<span>${value(event.type)}</span></td>
        <td>${value(event.toolName ?? event.actor)}</td>
        <td>${value(eventSummary(event))}</td>
        <td>${renderFindings(eventViolations, assistanceByViolation)}</td>
      </tr>`;
    })
    .join("");
};

const externalTraceForDisplay = (bundle: UiArtifactBundle): TraceEvent[] =>
  bundle.externalTrace.length > 0 ? bundle.externalTrace : bundle.importedTrace;

const renderTraceTimeline = (bundle: UiArtifactBundle): string => {
  const externalTrace = externalTraceForDisplay(bundle);
  const externalTitle = bundle.externalTrace.length > 0 ? "External graded trace" : "Imported MCP trace";

  return `<main class="view" data-view="trace-timeline">
    <section class="workbench">
      <div class="section-title">
        <h1>Trace timeline</h1>
      </div>
      ${renderProofArtifactWarning(bundle)}
      <div class="trace-stack">
        <section class="panel">
          <h2>Before patch</h2>
          <table class="trace-table">
            <thead><tr><th>Step</th><th>Event</th><th>Tool</th><th>Input or output</th><th>Findings</th></tr></thead>
            <tbody>${renderTraceRows(bundle.beforeTrace, bundle.beforeViolations, bundle.policyPatch)}</tbody>
          </table>
        </section>
        <section class="panel">
          <h2>After patch</h2>
          <table class="trace-table">
            <thead><tr><th>Step</th><th>Event</th><th>Tool</th><th>Input or output</th><th>Findings</th></tr></thead>
            <tbody>${renderTraceRows(bundle.afterTrace, bundle.afterViolations, bundle.policyPatch)}</tbody>
          </table>
        </section>
        ${
          externalTrace.length > 0
            ? `<section class="panel">
                <h2>${value(externalTitle)}</h2>
                <table class="trace-table">
                  <thead><tr><th>Step</th><th>Event</th><th>Tool</th><th>Input or output</th><th>Findings</th></tr></thead>
                  <tbody>${renderTraceRows(externalTrace, bundle.externalViolations, bundle.policyPatch)}</tbody>
                </table>
              </section>`
            : ""
        }
        ${renderMcpTranscriptImport(bundle.mcpTranscriptImport)}
      </div>
    </section>
  </main>`;
};

const renderLiveConnect = (bundle: UiArtifactBundle, options: RenderOptions): string => {
  const contract = bundle.liveSmokeContract ?? bundle.contract;
  const liveLoaded = Boolean(bundle.liveSmokeContract || contract?.mode === "live");

  return `<main class="view" data-view="live-connect">
    <section class="workbench">
      <div class="section-title">
        <h1>Live connect</h1>
      </div>
      <div class="receipt-ledger">
        ${renderLiveActionPanel(options.workbench)}
        <section class="panel">
          <h2>MCP status</h2>
          ${renderFactTable([
            ["Status", liveLoaded ? "live artifact loaded" : "no live-smoke artifact loaded"],
            ["Mode", contract?.mode ?? "unknown"],
            ["Contract", contract?.id ?? "not loaded"],
            ["Deployment", contract?.name ?? "not loaded"],
            ["Indexes", contract?.indexes.map((index) => index.name).join(" / ") ?? "n/a"],
            ["Read-only tools", contract?.mcpTools.join(" / ") ?? "n/a"]
          ])}
        </section>
        <section class="panel">
          <h2>Artifact source</h2>
          ${renderFactTable([
            ["Base URL", bundle.artifactBase],
            ["Missing optional files", bundle.missing.length > 0 ? bundle.missing.join(" / ") : "none"],
            ["Mutation posture", "read-only adapter calls only"]
          ])}
        </section>
        ${renderProofAuditPanel(bundle.proofAudit)}
        ${renderFirewallBlock(bundle.firewallBlock)}
        ${renderMcpTranscriptImport(bundle.mcpTranscriptImport)}
        ${renderLiveProofSummary(bundle)}
        ${renderLiveSecurityProofSummary(bundle)}
        ${renderHostedModelSummary(bundle.liveSecurityProofSummary?.hostedModels ?? bundle.liveProofSummary?.hostedModels)}
        ${renderHostedModelDiagnostic(bundle.hostedModelDiagnostic)}
        ${renderHostedModelProof(bundle.hostedModelProof)}
        ${renderLiveSecurityReadiness(bundle)}
        ${renderLiveSecurityKit(bundle)}
      </div>
    </section>
  </main>`;
};

const renderImportJobStatus = (workbench: WorkbenchRenderState | undefined): string => {
  const job = workbench?.job;

  if (!job) {
    return "";
  }

  return `<section class="panel">
    <h2>Import job</h2>
    ${renderFactTable([
      ["Job", `${job.id} / ${job.workflow ?? "unknown"} / ${job.state}`],
      ["Run", job.runId],
      ["Input", job.inputSummary ?? "not recorded"],
      ["Artifacts", job.artifactBase || "not allocated"],
      ["Error", job.error ?? "none"]
    ])}
    ${
      job.events.length > 0
        ? `<ol class="job-events" aria-label="Import certification job events">
            ${job.events
              .map((event) => `<li data-job-event="${value(event.type)}"><strong>${value(event.type)}</strong><span>${value(event.message)}</span></li>`)
              .join("")}
          </ol>`
        : ""
    }
  </section>`;
};

const renderImportCertification = (bundle: UiArtifactBundle, options: RenderOptions): string => {
  const running = options.workbench?.job?.state === "queued" || options.workbench?.job?.state === "running";
  const disabled = !options.workbench?.available || running;

  return `<main class="view" data-view="import-certification">
    <section class="workbench">
      <div class="section-title">
        <h1>External certification import</h1>
      </div>
      <div class="receipt-ledger">
        <section class="panel import-panel">
          <h2>External trace</h2>
          ${renderFactTable([
            ["Boundary", "producer-supplied canonical TraceEvent array"],
            ["Certification", "server compiles contract, grades trace, writes receipt and proof audit"],
            ["Mutation", "false"]
          ])}
          <form class="import-form" data-external-trace-form>
            <label>
              <span>Trace JSON</span>
              <input type="file" accept=".json,application/json" data-external-trace-file ${disabled ? "disabled" : ""}>
            </label>
            <label>
              <span>Agent name</span>
              <input type="text" data-external-trace-agent-name value="External Splunk MCP Agent" ${disabled ? "disabled" : ""}>
            </label>
            <label>
              <span>Agent version</span>
              <input type="text" data-external-trace-agent-version value="uploaded-trace" ${disabled ? "disabled" : ""}>
            </label>
            <label class="check-row">
              <input type="checkbox" data-external-trace-require-pass ${disabled ? "disabled" : ""}>
              <span>Require READY receipt</span>
            </label>
            <button class="replay-button" type="submit" ${disabled ? "disabled" : ""}>Certify trace</button>
          </form>
        </section>
        <section class="panel import-panel">
          <h2>MCP transcript</h2>
          ${renderFactTable([
            ["Boundary", "read-only Splunk MCP JSON-RPC transcript"],
            ["Strict import", "checks transcript structure, not independent readiness"],
            ["Final answer", "producer-provided and appended server-side"],
            ["Mutation", "false"]
          ])}
          <form class="import-form" data-mcp-transcript-form>
            <label>
              <span>Transcript JSONL</span>
              <input type="file" accept=".jsonl,.json,application/json,text/plain" data-mcp-transcript-file ${disabled ? "disabled" : ""}>
            </label>
            <label>
              <span>Final answer</span>
              <textarea rows="5" data-mcp-transcript-final-answer ${disabled ? "disabled" : ""}>Evidence supports suspicious lateral movement. Provenance saved-search-lateral-movement returned 3 rows for the -24h to now window with evidence evt-102, evt-118, and evt-141.</textarea>
            </label>
            <label>
              <span>Agent name</span>
              <input type="text" data-mcp-transcript-agent-name value="External MCP Transcript Agent" ${disabled ? "disabled" : ""}>
            </label>
            <label>
              <span>Agent version</span>
              <input type="text" data-mcp-transcript-agent-version value="uploaded-jsonrpc-transcript" ${disabled ? "disabled" : ""}>
            </label>
            <label class="check-row">
              <input type="checkbox" data-mcp-transcript-strict-import checked ${disabled ? "disabled" : ""}>
              <span>Strict import</span>
            </label>
            <label class="check-row">
              <input type="checkbox" data-mcp-transcript-require-pass ${disabled ? "disabled" : ""}>
              <span>Require READY receipt</span>
            </label>
            <button class="replay-button" type="submit" ${disabled ? "disabled" : ""}>Certify transcript</button>
          </form>
        </section>
        <section class="panel">
          <h2>Current artifact</h2>
          ${renderFactTable([
            ["Artifact base", bundle.artifactBase],
            ["External trace events", bundle.externalTrace.length],
            ["Imported transcript events", bundle.importedTrace.length],
            ["Receipt", bundle.receipt?.id ?? "not loaded"],
            ["Proof audit", bundle.proofAudit?.status ?? "not loaded"],
            ["Manifest", "written with proof audit artifacts"]
          ])}
        </section>
        ${renderImportJobStatus(options.workbench)}
        ${renderReceiptPanel(bundle.receipt, "External receipt")}
        ${renderProofAuditPanel(bundle.proofAudit)}
        ${renderMcpTranscriptImport(bundle.mcpTranscriptImport)}
      </div>
    </section>
  </main>`;
};

const sampleInteractiveTrace = (bundle: UiArtifactBundle): string => {
  const trace = bundle.externalTrace.length > 0 ? bundle.externalTrace : bundle.afterTrace.length > 0 ? bundle.afterTrace : bundle.beforeTrace;

  return trace.length > 0 ? JSON.stringify(trace, null, 2) : "[]";
};

const renderInteractiveViolations = (result: InteractiveCertificationResult | undefined): string => {
  if (!result) {
    return `<p class="empty">No interactive certification has run in this session.</p>`;
  }

  if (result.violations.length === 0) {
    return `<p class="empty">No deterministic violations found.</p>`;
  }

  return `<table class="interactive-violation-table">
    <thead><tr><th>Rule</th><th>Severity</th><th>Trace event</th><th>Reason</th></tr></thead>
    <tbody>${result.violations
      .map(
        (violation) => `<tr>
          <td>${code(violation.ruleId)}</td>
          <td>${value(violation.severity)}</td>
          <td>${code(violation.traceEventId)}</td>
          <td>${value(violation.reason)}</td>
        </tr>`
      )
      .join("")}</tbody>
  </table>`;
};

const renderInteractivePatchHints = (result: InteractiveCertificationResult | undefined): string => {
  if (!result) {
    return `<p class="empty">No policy patch summary generated.</p>`;
  }

  const summary = result.receipt.policyPatchSummary;

  return `<section class="panel interactive-result-panel">
    <h2>Policy patch summary</h2>
    ${renderFactTable([
      ["Receipt summary", summary.length > 0 ? summary.map((patch) => `${patch.id} / ${patch.status}`).join(" / ") : "none"],
      ["Patch hints", result.patchHints.length > 0 ? result.patchHints.join(" / ") : "none"]
    ])}
  </section>`;
};

const renderInteractiveCertification = (bundle: UiArtifactBundle, options: RenderOptions): string => {
  const state = options.interactiveCertification ?? { status: "idle" };
  const result = state.result;
  const disabled = state.status === "running";
  const canRun = Boolean(bundle.contract && bundle.missions[0]);
  const sampleTrace = sampleInteractiveTrace(bundle);

  return `<main class="view" data-view="interactive-certification">
    <section class="workbench">
      <div class="section-title">
        <h1>Interactive certification</h1>
      </div>
      <div class="interactive-grid">
        <section class="panel interactive-input-panel">
          <h2>Trace input</h2>
          ${renderFactTable([
            ["Execution", "browser-hosted deterministic certifier"],
            ["Contract", bundle.contract?.id ?? "not loaded"],
            ["Mission", bundle.missions[0]?.id ?? "not loaded"],
            ["Mutation", "false"],
            ["Status", state.status],
            ["Error", state.error ?? "none"]
          ])}
          <form class="import-form interactive-certification-form" data-interactive-certification-form>
            <label>
              <span>Trace JSON</span>
              <textarea rows="16" spellcheck="false" data-interactive-trace-json ${disabled || !canRun ? "disabled" : ""}>${value(sampleTrace)}</textarea>
            </label>
            <label>
              <span>Upload trace</span>
              <input type="file" accept=".json,application/json" data-interactive-trace-file ${disabled || !canRun ? "disabled" : ""}>
            </label>
            <div class="interactive-agent-fields">
              <label>
                <span>Agent name</span>
                <input type="text" data-interactive-agent-name value="Interactive Uploaded Trace Agent" ${disabled || !canRun ? "disabled" : ""}>
              </label>
              <label>
                <span>Agent version</span>
                <input type="text" data-interactive-agent-version value="hosted-demo" ${disabled || !canRun ? "disabled" : ""}>
              </label>
            </div>
            <button class="replay-button" type="submit" ${disabled || !canRun ? "disabled" : ""}>Certify trace</button>
          </form>
        </section>
        <div class="interactive-results">
          <section class="panel interactive-result-panel">
            <h2>Result</h2>
            ${renderFactTable([
              ["Status", result?.status ?? state.status],
              ["Verdict", result?.receipt.verdict ?? "not run"],
              ["Score", result?.receipt.score ?? "not run"],
              ["Trace events", result?.traceEvents.length ?? "not run"],
              ["Violations", result?.violations.length ?? "not run"],
              ["Evidence refs", result?.receipt.evidenceRefs.length ? result.receipt.evidenceRefs.join(" / ") : "none"],
              ["Receipt hash", result?.receipt.receiptHash ?? "not recorded"],
              ["Mutation", result?.mutation === false ? "false" : "false"]
            ])}
          </section>
          ${renderReceiptPanel(result?.receipt, "Interactive Readiness Receipt")}
          <section class="panel interactive-result-panel">
            <h2>Deterministic violations</h2>
            ${renderInteractiveViolations(result)}
          </section>
          ${renderInteractivePatchHints(result)}
        </div>
      </div>
    </section>
  </main>`;
};

const renderReceiptComparison = (bundle: UiArtifactBundle): string => {
  const before = bundle.beforeReceipt;
  const after = bundle.afterReceipt;
  const current = bundle.receipt;
  const rows: Array<[string, unknown, unknown]> = [
    ["Verdict", before?.verdict ?? current?.verdict ?? "n/a", after?.verdict ?? current?.verdict ?? "n/a"],
    ["Score", before?.score ?? current?.score ?? "n/a", after?.score ?? current?.score ?? "n/a"],
    ["Violations", before?.violations.length ?? current?.violations.length ?? "n/a", after?.violations.length ?? current?.violations.length ?? "n/a"],
    ["Evidence refs", before?.evidenceRefs.length ?? current?.evidenceRefs.length ?? "n/a", after?.evidenceRefs.length ?? current?.evidenceRefs.length ?? "n/a"],
    [
      "Policy patch",
      bundle.policyPatch ? `${bundle.policyPatch.rules.length} rule(s)` : "not loaded",
      bundle.policyPatch ? bundle.policyPatch.status : "not loaded"
    ]
  ];

  return `<section class="panel receipt-comparison">
    <h2>Receipt comparison</h2>
    <table class="comparison-table">
      <thead><tr><th>Field</th><th>Before/current</th><th>After/current</th></tr></thead>
      <tbody>${rows.map(([label, left, right]) => `<tr><th>${value(label)}</th><td>${value(left)}</td><td>${value(right)}</td></tr>`).join("")}</tbody>
    </table>
    <div class="raw-links">
      <a href="${artifactUrl(bundle.artifactBase, "receipt-before-001.json")}">receipt-before-001.json</a>
      <a href="${artifactUrl(bundle.artifactBase, "receipt-after-001.json")}">receipt-after-001.json</a>
      <a href="${artifactUrl(bundle.artifactBase, "receipt-external-001.json")}">receipt-external-001.json</a>
    </div>
  </section>`;
};

const renderManifestVerificationPanel = (
  bundle: UiArtifactBundle,
  workbench: WorkbenchRenderState | undefined
): string => {
  const runId = currentRunIdFromBundle(bundle);
  const manifestVerification = workbench?.manifestVerification;
  const report = bundle.proofManifestVerification ?? manifestVerification?.report;
  const activeVerification = manifestVerification?.runId === runId ? manifestVerification : undefined;
  const status = activeVerification?.status ?? report?.status ?? (bundle.missing.includes("proof-manifest.json") ? "MISSING" : "UNVERIFIED");

  return `<section class="panel manifest-panel">
    <div class="run-panel-header">
      <h2>Manifest verification</h2>
      <button class="replay-button" type="button" data-verify-manifest="${value(runId ?? "")}" ${
        !runId || status === "MISSING" ? "disabled" : ""
      }>Verify manifest</button>
    </div>
    ${renderFactTable([
      ["Run", runId ?? "not a managed workbench run"],
      ["Status", status],
      ["Expected files", report?.expectedFiles ?? "n/a"],
      ["Actual files", report?.actualFiles ?? "n/a"],
      ["Missing files", report && report.missingFiles.length > 0 ? report.missingFiles.join(" / ") : "none"],
      ["Unexpected files", report && report.unexpectedFiles.length > 0 ? report.unexpectedFiles.join(" / ") : "none"],
      ["Changed files", report && report.changedFiles.length > 0 ? report.changedFiles.map((file) => file.path).join(" / ") : "none"],
      ["Error", activeVerification?.message ?? "none"]
    ])}
  </section>`;
};

const renderProofBrowser = (bundle: UiArtifactBundle, options: RenderOptions): string => {
  const runs = options.workbench?.runs ?? [];

  return `<main class="view" data-view="proof-browser">
    <section class="workbench">
      <div class="section-title">
        <h1>Proof bundle browser</h1>
      </div>
      <div class="run-browser-grid">
        ${renderRunList(bundle, runs, options.workbench)}
        <div class="run-browser-detail">
          ${renderReceiptComparison(bundle)}
          ${renderTracePreview(bundle)}
          ${renderPlatformDevexProofPanel(bundle.platformDevexProof)}
          ${renderJudgeProofPanel(bundle.judgeProofSummary)}
          ${renderPublicProofExportPanel(bundle.publicProofExport)}
          ${renderProofAuditPanel(bundle.proofAudit)}
          ${renderManifestVerificationPanel(bundle, options.workbench)}
        </div>
      </div>
    </section>
  </main>`;
};

const renderArtifactSelector = (bundle: UiArtifactBundle, artifactOptions: ArtifactOption[] | undefined): string => {
  if (!artifactOptions || artifactOptions.length === 0) {
    return "";
  }

  const currentBase = normalizeArtifactBase(bundle.artifactBase);
  const options = artifactOptions
    .map((option) => {
      const optionBase = normalizeArtifactBase(option.path);
      const selected = optionBase === currentBase ? " selected" : "";

      return `<option value="${value(option.path)}"${selected}>${value(option.label)}</option>`;
    })
    .join("");

  return `<label class="artifact-picker">
    <span>Artifact source</span>
    <select data-artifact-selector>
      ${options}
    </select>
  </label>`;
};

const optionalRailStories = (summary: ReturnType<typeof summarizeBundle>): string[] =>
  [
    summary.proofStory,
    summary.securityStory,
    summary.kitStory,
    summary.hostedModelStory,
    summary.auditStory,
    summary.firewallStory,
    summary.suiteStory,
    summary.indexStory,
    summary.mcpProofStory,
    summary.transcriptStory,
    summary.platformProofStory,
    summary.judgeProofStory
  ].filter((story) => !story.includes("not loaded"));

const renderSidebar = (bundle: UiArtifactBundle, activeView: ViewId, options: RenderOptions): string => {
  const summary = summarizeBundle(bundle);
  const railStory = optionalRailStories(summary)[0];
  const jobState = options.workbench?.job?.state;
  const isJobActive = jobState === "queued" || jobState === "running";
  const isReady = summary.verdict.toUpperCase().includes("READY") && !summary.verdict.toUpperCase().includes("NOT");
  const scoreDisplay = isJobActive ? "--" : summary.score;
  const verdictDisplay = isJobActive ? "RUNNING" : summary.verdict;
  const verdictClass = isJobActive ? "running" : isReady ? "ready" : "not-ready";

  return `<aside class="side-rail">
    <div class="brand">
      <h1>SplunkReady</h1>
      <p class="brand-kicker">Agent Readiness Dossier</p>
      <p class="brand-tagline">Certify AI agents before they touch production Splunk.</p>
      <div class="dossier-badge">ARC-SPEC-REPORT</div>
      <div class="dossier-stat" aria-label="Current readiness status">
        <strong>${value(scoreDisplay)}</strong>
        <span>Readiness Score</span>
        <em class="${verdictClass}">${value(verdictDisplay)}</em>
      </div>
    </div>
    <div class="rail-body">
      <nav aria-label="Views">
        ${views
          .map(
            (view) =>
              `<a href="#${view.id}" data-view-link="${view.id}" class="${view.id === activeView ? "active" : ""}">${view.label}</a>`
          )
          .join("")}
      </nav>
      ${renderArtifactSelector(bundle, options.artifactOptions)}
    </div>
    <div class="rail-footer">
      <div class="rail-receipt">
        <strong>Verification Metadata</strong>
        <span>Mode: ${value(summary.mode)}</span>
        <span>Contract: ${value(summary.contract)}</span>
        <span>Violations: ${summary.beforeViolations} before / ${summary.afterViolations} after</span>
        ${railStory ? `<span>${value(railStory)}</span>` : ""}
      </div>
    </div>
  </aside>`;
};

const renderActiveView = (bundle: UiArtifactBundle, activeView: ViewId, options: RenderOptions): string => {
  if (activeView === "receipt") {
    return renderReceipt(bundle, options);
  }

  if (activeView === "trace-timeline") {
    return renderTraceTimeline(bundle);
  }

  if (activeView === "policy-firewall") {
    return renderPolicyFirewall(bundle, options);
  }

  if (activeView === "suite-proof") {
    return renderSuiteProof(bundle);
  }

  if (activeView === "mcp-proof") {
    return renderMcpProof(bundle);
  }

  if (activeView === "llm-deliberation") {
    return renderLlmDeliberation(bundle);
  }

  if (activeView === "agent-index") {
    return renderCertificationIndex(bundle, options);
  }

  if (activeView === "proof-browser") {
    return renderProofBrowser(bundle, options);
  }

  if (activeView === "import-certification") {
    return renderImportCertification(bundle, options);
  }

  if (activeView === "interactive-certification") {
    return renderInteractiveCertification(bundle, options);
  }

  if (activeView === "live-connect") {
    return renderLiveConnect(bundle, options);
  }

  return renderReplay(bundle, options);
};

export const renderApp = (bundle: UiArtifactBundle, activeView: ViewId, options: RenderOptions = {}): string =>
  `<div class="app-frame">
    ${renderSidebar(bundle, activeView, options)}
    ${renderActiveView(bundle, activeView, options)}
  </div>`;

export const renderError = (message: string): string =>
  `<div class="app-frame">
    <aside class="side-rail">
      <div class="brand">
        <h1>SplunkReady</h1>
        <p class="brand-kicker">Agent Readiness Dossier</p>
        <p class="brand-tagline">Certify AI agents before they touch production Splunk.</p>
      </div>
    </aside>
    <main class="view">
      <section class="workbench">
        <div class="section-title"><h1>Artifact load failed</h1></div>
        <section class="panel"><p class="empty">${value(message)}</p></section>
      </section>
    </main>
  </div>`;
