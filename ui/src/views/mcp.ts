import type { UiArtifactBundle, McpTranscriptImport, McpProofSummary } from "../artifacts.js";
import { value, renderFactTable, renderPlainList } from "./helpers.js";

export const renderMcpTranscriptImport = (summary: McpTranscriptImport | undefined): string => {
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

export const renderMcpProofList = (items: readonly string[], className: string): string =>
  items.length > 0 ? renderPlainList(items, className) : `<p class="empty">None recorded.</p>`;

export const renderMcpDeveloperGate = (summary: McpProofSummary): string => {
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

export const renderMcpProofTable = (summary: McpProofSummary): string => {
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

export const renderMcpComposition = (summary: McpProofSummary): string => {
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

export const renderOfficialSplunkMcpToolCoverage = (summary: McpProofSummary): string => {
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

export const renderMcpCategoryScorecard = (scorecard: UiArtifactBundle["mcpCategoryScorecard"]): string => {
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

export const renderMcpCompositionRecorder = (summary: McpProofSummary): string => {
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

export const renderLiveMockSplunkMcp = (summary: McpProofSummary): string => {
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

export const renderAppInspectComposition = (summary: McpProofSummary): string => {
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

export const renderOperatorLiveHostedModelStatus = (summary: McpProofSummary): string => {
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

export const renderMcpProof = (bundle: UiArtifactBundle): string => {
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
