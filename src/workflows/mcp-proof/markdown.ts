import { type McpProofSummary } from "../mcp-proof.js";
import { stringFromRecord, stringArrayFromRecord } from "./helpers.js";

export const mcpProofMarkdown = (summary: McpProofSummary): string => `# SplunkReady MCP Proof

Status: ${summary.status}

Server: ${summary.handshake.serverName}

Protocol: ${summary.handshake.protocolVersion}

Mutation: ${summary.mutation ? "yes" : "no"}

Tools:
${summary.tools.map((tool) => `- ${tool.name} destructive=${String(tool.destructiveHint)} readOnly=${String(tool.readOnlyHint)}`).join("\n")}

Resources:
${summary.resources.map((resource) => `- ${resource.uri} (${resource.mimeType})`).join("\n")}

Resource templates:
${summary.resourceTemplates.map((template) => `- ${template.uriTemplate} (${template.mimeType})`).join("\n")}

Templated receipt:
- splunkready://receipts/pass

Dual-server MCP client kit:
- Resource: splunkready://client-config/splunk-and-splunkready
- Existing Splunk MCP role: investigate with read-only Splunk tools
- SplunkReady MCP role: certify the captured Splunk MCP transcript

Prompts:
${summary.prompts.map((prompt) => `- ${prompt.name} arguments=${prompt.argumentCount}`).join("\n")}

Agent-driven workflow: ${summary.agentDrivenWorkflow.status}
${summary.agentDrivenWorkflow.stages.map((stage) => `- ${stage}`).join("\n")}

Transcript certification: ${stringFromRecord(summary.transcriptCertification, "status")}

Inline transcript certification: ${stringFromRecord(summary.inlineTranscriptCertification, "status")}
- Output: ${stringFromRecord(summary.inlineTranscriptCertification, "outDir")}

MCP composition review: ${stringFromRecord(summary.mcpCompositionReview, "status")}
- Score: ${String(summary.mcpCompositionReview.score ?? "")}
- Splunk tools: ${stringArrayFromRecord(summary.mcpCompositionReview, "splunkToolNames").join(", ") || "none"}
- Evidence refs: ${stringArrayFromRecord(summary.mcpCompositionReview, "evidenceRefs").join(", ") || "none"}

Hosted-model access check: ${stringFromRecord(summary.hostedModelAccess, "status")}
- Blocker: ${stringFromRecord(summary.hostedModelAccess, "blockerClass") ?? "NONE"}
- Permission: ${stringFromRecord(summary.hostedModelAccess, "permissionStatus")}
- Permission blocker: ${stringFromRecord(summary.hostedModelAccess, "permissionBlockerClass") ?? "NONE"}
- Passed tools: ${stringArrayFromRecord(summary.hostedModelAccess, "passedTools").join(", ") || "none"}
- Blocked tools: ${stringArrayFromRecord(summary.hostedModelAccess, "blockedTools").join(", ") || "none"}
- Output: ${stringFromRecord(summary.hostedModelAccess, "outDir")}

Operator live hosted-model status: ${summary.operatorLiveHostedModelStatus.status}
- Artifact: ${summary.operatorLiveHostedModelStatus.artifactPath}
- Blocker: ${summary.operatorLiveHostedModelStatus.blockerClass}
- Permission: ${summary.operatorLiveHostedModelStatus.permissionStatus}
- Permission blocker: ${summary.operatorLiveHostedModelStatus.permissionBlockerClass}
- Route probe: ${summary.operatorLiveHostedModelStatus.restHandlerProbeStatus}
- Passed tools: ${summary.operatorLiveHostedModelStatus.passedTools.join(", ") || "none"}
- Blocked tools: ${summary.operatorLiveHostedModelStatus.blockedTools.join(", ") || "none"}
- Summary: ${summary.operatorLiveHostedModelStatus.summary}

Splunk MCP boundary: ${summary.splunkMcpBoundary.status}
- Certified tool calls: ${summary.splunkMcpBoundary.certifiedToolNames.join(", ")}
- Saved-search execution: ${summary.splunkMcpBoundary.includesSavedSearchExecution ? "yes" : "no"}
- Evidence refs: ${summary.splunkMcpBoundary.evidenceRefs.join(", ")}
- Receipt: ${summary.splunkMcpBoundary.receiptPath}

MCP composition scorecard: ${summary.mcpComposition.status} (${summary.mcpComposition.score}/100)
${summary.mcpComposition.checks.map((check) => `- ${check.id}: ${check.status} - ${check.evidence}`).join("\n")}

Official Splunk MCP tool coverage: ${summary.officialSplunkMcpToolCoverage.status}
- Captured core tools: ${summary.officialSplunkMcpToolCoverage.capturedCoreTools.join(", ") || "none"}
- Investigation tools: ${summary.officialSplunkMcpToolCoverage.investigationTools.join(", ") || "none"}
- Hosted-model tools: ${summary.officialSplunkMcpToolCoverage.hostedModelTools.join(", ") || "none"}
- Mission-scoped out tools: ${summary.officialSplunkMcpToolCoverage.missionScopedOutTools.join(", ") || "none"}
${summary.officialSplunkMcpToolCoverage.checks.map((check) => `- ${check.id}: ${check.status} - ${check.evidence}`).join("\n")}

MCP client walkthrough: ${summary.clientWalkthrough.status}
- Artifact: ${summary.clientWalkthrough.artifactPath}
- Markdown: ${summary.clientWalkthrough.markdownPath}
- Existing Splunk MCP server: ${summary.clientWalkthrough.servers.find((server) => server.name === "splunk")?.role ?? ""}
- SplunkReady role: ${summary.clientWalkthrough.servers.find((server) => server.name === "splunkready")?.role ?? ""}
${summary.clientWalkthrough.stages.map((stage) => `- ${stage.id}: ${stage.title} (${stage.server}) - ${stage.evidence}`).join("\n")}

MCP client session: ${summary.clientSession.status}
- Artifact: ${summary.clientSession.artifactPath}
- Markdown: ${summary.clientSession.markdownPath}
- Protocol: ${summary.clientSession.protocol}
- Requests: ${summary.clientSession.requestCount}
- Responses: ${summary.clientSession.responseCount}
- Methods:
${summary.clientSession.methods.map((method) => `- ${method}`).join("\n")}

Resources:
${summary.clientSession.resourceUris.map((uri) => `- ${uri}`).join("\n")}

Prompts:
${summary.clientSession.promptNames.map((name) => `- ${name}`).join("\n")}

Tools:
${summary.clientSession.toolNames.map((name) => `- ${name}`).join("\n")}

Live mock Splunk MCP: ${summary.liveMockSplunkMcp.status}
- Artifact: ${summary.liveMockSplunkMcp.artifactPath}
- Markdown: ${summary.liveMockSplunkMcp.markdownPath}
- Route state: ${summary.liveMockSplunkMcp.routeState}
- Tools called: ${summary.liveMockSplunkMcp.toolNames.join(", ") || "none"}
- Evidence refs: ${summary.liveMockSplunkMcp.evidenceRefs.join(", ") || "none"}
- Saved-search execution: ${summary.liveMockSplunkMcp.includesSavedSearchExecution ? "yes" : "no"}

AppInspect MCP composition: ${summary.appInspectComposition.status}
- Artifact: ${summary.appInspectComposition.artifactPath}
- Markdown: ${summary.appInspectComposition.markdownPath}
- Server: ${summary.appInspectComposition.server.status}${summary.appInspectComposition.server.name ? ` (${summary.appInspectComposition.server.name} ${summary.appInspectComposition.server.version})` : ""}
- Tools: ${summary.appInspectComposition.server.tools.join(", ") || "none"}
- App package: ${summary.appInspectComposition.appPackagePath}
- Validation: ${summary.appInspectComposition.validation.status}
- AppInspect failures: ${summary.appInspectComposition.validation.failureCount}
- AppInspect errors: ${summary.appInspectComposition.validation.errorCount}
- AppInspect warnings: ${summary.appInspectComposition.validation.warningCount}
- Receipt authority: ${summary.appInspectComposition.composition.deterministicReceiptAuthority}
- AppInspect authority: ${summary.appInspectComposition.composition.appInspectAuthority}

MCP composition recorder: ${summary.compositionRecorder.status}
- Artifact: ${summary.compositionRecorder.artifactPath}
- Markdown: ${summary.compositionRecorder.markdownPath}
- Frames: ${summary.compositionRecorder.frameCount}
- Servers: ${summary.compositionRecorder.serverIds.join(", ")}
- Splunk tools: ${summary.compositionRecorder.splunkToolNames.join(", ") || "none"}
- SplunkReady tools: ${summary.compositionRecorder.splunkReadyToolNames.join(", ") || "none"}
- Redaction: ${summary.compositionRecorder.redaction.status}
- Certification: ${summary.compositionRecorder.certification?.status ?? "NOT_RUN"}

Receipt: ${stringFromRecord(summary.transcriptCertification, "outDir")}/receipt-external-001.json
`;

export const mcpClientWalkthroughMarkdown = (walkthrough: McpProofSummary["clientWalkthrough"]): string => `# Splunk MCP Client Walkthrough

Status: ${walkthrough.status}

Mutation: ${walkthrough.mutation ? "yes" : "no"}

Deterministic authority: ${walkthrough.deterministicAuthority ? "yes" : "no"}

## Servers

${walkthrough.servers.map((server) => `- ${server.name}: ${server.role} existingMcpServer=${server.existingMcpServer}`).join("\n")}

## Stages

${walkthrough.stages.map((stage) => `- ${stage.id}: ${stage.title}\n  - Server: ${stage.server}\n  - Evidence: ${stage.evidence}`).join("\n")}

## Transcript

- Path: ${walkthrough.transcript.path}
- Splunk tools: ${walkthrough.transcript.splunkToolNames.join(", ")}
- Splunk tool calls: ${walkthrough.transcript.splunkToolCallCount}
- Saved-search execution: ${walkthrough.transcript.includesSavedSearchExecution ? "yes" : "no"}
- Evidence refs: ${walkthrough.transcript.evidenceRefs.join(", ")}

## Receipt

- Path: ${walkthrough.receipt.path}
- Status: ${walkthrough.receipt.status}
- Authoritative: ${walkthrough.receipt.authoritative ? "yes" : "no"}
`;

export const mcpClientSessionMarkdown = (session: McpProofSummary["clientSession"]): string => `# SplunkReady MCP Client Session

Status: ${session.status}

Protocol: ${session.protocol}

Mutation: ${session.mutation ? "yes" : "no"}

Deterministic authority: ${session.deterministicAuthority ? "yes" : "no"}

Requests: ${session.requestCount}

Responses: ${session.responseCount}

Methods:
${session.methods.map((method) => `- ${method}`).join("\n")}

Resources:
${session.resourceUris.map((uri) => `- ${uri}`).join("\n")}

Prompts:
${session.promptNames.map((name) => `- ${name}`).join("\n")}

Tools:
${session.toolNames.map((name) => `- ${name}`).join("\n")}
`;

export const liveMockSplunkMcpMarkdown = (liveMock: McpProofSummary["liveMockSplunkMcp"]): string => `# Live Mock Splunk MCP Session

Status: ${liveMock.status}

Route state: ${liveMock.routeState}

Mutation: ${liveMock.mutation ? "yes" : "no"}

Deterministic authority: ${liveMock.deterministicAuthority ? "yes" : "no"}

Requests: ${liveMock.requestCount}

Responses: ${liveMock.responseCount}

Tools:
${liveMock.toolNames.map((name) => `- ${name}`).join("\n")}

Evidence refs:
${liveMock.evidenceRefs.map((ref) => `- ${ref}`).join("\n")}

Saved-search execution: ${liveMock.includesSavedSearchExecution ? "yes" : "no"}
`;
