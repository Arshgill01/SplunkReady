import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  renderMcpCompositionRecorderMarkdown,
  writeMcpCompositionRecorderSession,
  type McpCompositionRecorderSummary
} from "../mcp/composition-recorder.js";
import { runMcpRecorderGatewayProofSession } from "../mcp/recorder-gateway.js";
import {
  findDefaultSplunkAppPackage,
  runAppInspectCompositionWorkflow,
  type AppInspectCompositionSummary
} from "./appinspect-composition.js";
import { runMcpTranscriptCertificationFromPathWorkflow } from "./external-certification.js";

import {
  type McpClientSessionRecord,
  McpStdioClient
} from "./mcp-proof/client.js";
import {
  asRecord,
  collectEvidenceRefs,
  displayPath,
  safeRecord,
  stringArray,
  stringArrayFromRecord,
  stringFromRecord,
  textFromMcpResource
} from "./mcp-proof/helpers.js";
import {
  liveMockSplunkMcpMarkdown,
  mcpClientSessionMarkdown,
  mcpClientWalkthroughMarkdown,
  mcpProofMarkdown
} from "./mcp-proof/markdown.js";

export interface McpProofWorkflowInput {
  outDir: string;
  serverPath: string;
  mockServerPath?: string;
  mockFixturePath?: string;
  liveMock?: boolean;
  mockState?: "ok" | "degraded" | "route-not-found";
  transcriptPath?: string;
  finalAnswer?: string;
}

export interface McpProofWorkflowResult {
  status: "PASS" | "FAIL";
  outDir: string;
  artifacts: string[];
  mutation: false;
  messages: string[];
}

export interface McpProofSummary {
  source: "splunkready-mcp-proof";
  status: "PASS" | "FAIL";
  mutation: false;
  generatedAt: string;
  serverPath: string;
  transcriptPath: string;
  handshake: {
    protocolVersion: string;
    serverName: string;
    instructions: string;
  };
  tools: Array<{
    name: string;
    destructiveHint: unknown;
    readOnlyHint: unknown;
  }>;
  resources: Array<{
    uri: string;
    name: string;
    mimeType: string;
  }>;
  resourceTemplates: Array<{
    uriTemplate: string;
    name: string;
    mimeType: string;
  }>;
  prompts: Array<{
    name: string;
    argumentCount: number;
  }>;
  describe: Record<string, unknown>;
  postureResource: Record<string, unknown>;
  clientConfigResource: Record<string, unknown>;
  dualServerClientConfigResource: Record<string, unknown>;
  claudeDesktopClientConfigResource: Record<string, unknown>;
  cursorClientConfigResource: Record<string, unknown>;
  antigravityClientConfigResource: Record<string, unknown>;
  zedClientConfigResource: Record<string, unknown>;
  certificationLoopResource: Record<string, unknown>;
  compositionScorecardResource: Record<string, unknown>;
  hostedModelDiagnosticResource: Record<string, unknown>;
  receiptTemplateResource: Record<string, unknown>;
  transcriptPrompt: Record<string, unknown>;
  certificationLoopPrompt: Record<string, unknown>;
  compositionReviewPrompt: Record<string, unknown>;
  hostedModelDiagnosticPrompt: Record<string, unknown>;
  transcriptCertification: Record<string, unknown>;
  inlineTranscriptCertification: Record<string, unknown>;
  mcpCompositionReview: Record<string, unknown>;
  hostedModelAccess: Record<string, unknown>;
  operatorLiveHostedModelStatus: {
    source: "splunkready-operator-live-hosted-model-status";
    status: "NOT_PROVIDED" | "PASS" | "BLOCKED";
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
    safeForPublicExport: true;
    deterministicAuthority: true;
    mutation: false;
  };
  agentDrivenWorkflow: {
    status: "PASS" | "FAIL";
    splunkMcpServerRole: string;
    splunkReadyMcpServerRole: string;
    stages: string[];
    deterministicAuthority: true;
    mutation: false;
  };
  splunkMcpBoundary: {
    status: "PASS" | "FAIL";
    transcriptKind: "captured-splunk-mcp-jsonrpc";
    transcriptPath: string;
    localMcpServerRole: string;
    splunkMcpServerRole: string;
    certifiedToolNames: string[];
    splunkToolCallCount: number;
    includesSavedSearchExecution: boolean;
    evidenceRefs: string[];
    receiptPath: string;
    deterministicAuthority: true;
    mutation: false;
  };
  mcpComposition: {
    status: "PASS" | "FAIL";
    score: number;
    servers: Array<{
      name: string;
      role: string;
      evidence: string;
      existingMcpServer: boolean;
    }>;
    checks: Array<{
      id: string;
      status: "PASS" | "FAIL";
      evidence: string;
    }>;
    deterministicAuthority: true;
    mutation: false;
  };
  officialSplunkMcpToolCoverage: {
    source: "splunkready-official-splunk-mcp-tool-coverage";
    status: "PASS" | "FAIL";
    docs: {
      toolsUrl: string;
      configurationUrl: string;
    };
    capturedCoreTools: string[];
    investigationTools: string[];
    hostedModelTools: string[];
    missionScopedOutTools: string[];
    checks: Array<{
      id: string;
      status: "PASS" | "FAIL";
      evidence: string;
    }>;
    deterministicAuthority: true;
    mutation: false;
  };
  clientWalkthrough: {
    source: "splunkready-mcp-client-walkthrough";
    status: "PASS" | "FAIL";
    artifactPath: string;
    markdownPath: string;
    deterministicAuthority: true;
    mutation: false;
    servers: Array<{
      name: string;
      role: string;
      existingMcpServer: boolean;
    }>;
    stages: Array<{
      id: string;
      title: string;
      server: string;
      evidence: string;
    }>;
    transcript: {
      path: string;
      splunkToolNames: string[];
      splunkToolCallCount: number;
      includesSavedSearchExecution: boolean;
      evidenceRefs: string[];
    };
    receipt: {
      path: string;
      status: "PASS" | "FAIL";
      authoritative: true;
    };
  };
  clientSession: {
    source: "splunkready-mcp-client-session";
    status: "PASS" | "FAIL";
    artifactPath: string;
    markdownPath: string;
    protocol: "stdio-jsonrpc";
    requestCount: number;
    responseCount: number;
    methods: string[];
    resourceUris: string[];
    promptNames: string[];
    toolNames: string[];
    deterministicAuthority: true;
    mutation: false;
  };
  liveMockSplunkMcp: {
    source: "splunkready-live-mock-splunk-mcp";
    status: "NOT_REQUESTED" | "PASS" | "FAIL";
    artifactPath: string;
    markdownPath: string;
    routeState: "ok" | "degraded" | "route-not-found";
    toolNames: string[];
    evidenceRefs: string[];
    includesSavedSearchExecution: boolean;
    requestCount: number;
    responseCount: number;
    deterministicAuthority: true;
    mutation: false;
  };
  appInspectComposition: AppInspectCompositionSummary;
  compositionRecorder: McpCompositionRecorderSummary;
  artifacts: string[];
  nextCommands: string[];
}

const defaultTranscriptPath = "examples/sample-mcp-transcript-pass.jsonl";
const defaultFinalAnswer =
  "Evidence supports suspicious lateral movement from win-finance-07 through admin-login-02 to dc-01 and finance-sql-03. Provenance saved-search-lateral-movement returned 3 rows for the -24h to now window, with evidence rows evt-102, evt-118, and evt-141.";
const generatedAt = "2026-06-01T06:45:00.000Z";
const officialSplunkMcpToolsUrl = "https://help.splunk.com/en/splunk-enterprise/mcp-server-for-splunk-platform/1.0/mcp-server-tools";
const officialSplunkMcpConfigurationUrl =
  "https://help.splunk.com/en/splunk-cloud-platform/mcp-server-for-splunk-platform/1.2/connecting-to-the-mcp-server-and-settings";

const extractStructuredContent = (toolCallResult: Record<string, unknown>, label: string): Record<string, unknown> => {
  const structured = asRecord(toolCallResult.structuredContent, label);

  if (toolCallResult.isError === true) {
    throw new Error(`MCP ${label} returned a tool error: ${stringFromRecord(structured, "message")}`);
  }

  return structured;
};

const readSplunkMcpBoundaryEvidence = async (
  transcriptPath: string,
  certificationStatus: "PASS" | "FAIL",
  receiptPath: string
): Promise<McpProofSummary["splunkMcpBoundary"]> => {
  const lines = (await readFile(transcriptPath, "utf8"))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const certifiedToolNames: string[] = [];
  const evidenceRefs: string[] = [];

  for (const line of lines) {
    const parsed = JSON.parse(line) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      continue;
    }

    const record = parsed as Record<string, unknown>;

    if (record.method === "tools/call") {
      const params = record.params;
      const toolName =
        params && typeof params === "object" && !Array.isArray(params)
          ? (params as Record<string, unknown>).name
          : undefined;

      if (typeof toolName === "string") {
        certifiedToolNames.push(toolName);
      }
    }

    if ("result" in record) {
      const result = record.result;
      const structuredContent =
        result && typeof result === "object" && !Array.isArray(result)
          ? (result as Record<string, unknown>).structuredContent
          : undefined;
      evidenceRefs.push(...collectEvidenceRefs(structuredContent));
    }

    evidenceRefs.push(...collectEvidenceRefs(record));
  }

  const uniqueToolNames = [...new Set(certifiedToolNames)];
  const uniqueEvidenceRefs = [...new Set(evidenceRefs)];

  return {
    status: certificationStatus,
    transcriptKind: "captured-splunk-mcp-jsonrpc",
    transcriptPath,
    localMcpServerRole:
      "SplunkReady MCP exposes the Agent Readiness Compiler as a certification interface for MCP clients.",
    splunkMcpServerRole:
      "The captured transcript is the Splunk MCP Server boundary: an agent invoked Splunk MCP tools, then SplunkReady certified the behavior.",
    certifiedToolNames: uniqueToolNames,
    splunkToolCallCount: uniqueToolNames.filter((toolName) => toolName.startsWith("splunk_")).length,
    includesSavedSearchExecution: uniqueToolNames.includes("splunk_run_saved_search"),
    evidenceRefs: uniqueEvidenceRefs,
    receiptPath,
    deterministicAuthority: true,
    mutation: false
  };
};

const buildMcpCompositionScorecard = (input: {
  dualServerClientConfigResource: Record<string, unknown>;
  resources: McpProofSummary["resources"];
  resourceTemplates: McpProofSummary["resourceTemplates"];
  prompts: McpProofSummary["prompts"];
  transcriptCertification: Record<string, unknown>;
  inlineTranscriptCertification: Record<string, unknown>;
  mcpCompositionReview: Record<string, unknown>;
  hostedModelAccess: Record<string, unknown>;
  agentDrivenWorkflow: McpProofSummary["agentDrivenWorkflow"];
  splunkMcpBoundary: McpProofSummary["splunkMcpBoundary"];
  officialSplunkMcpToolCoverage: McpProofSummary["officialSplunkMcpToolCoverage"];
}): McpProofSummary["mcpComposition"] => {
  const dualConfigText = textFromMcpResource(input.dualServerClientConfigResource);
  const resourceUris = input.resources.map((resource) => resource.uri);
  const resourceTemplates = input.resourceTemplates.map((template) => template.uriTemplate);
  const promptNames = input.prompts.map((prompt) => prompt.name);
  const certificationStatus =
    stringFromRecord(input.transcriptCertification, "status") === "PASS" ? "PASS" : "FAIL";
  const inlineCertificationStatus =
    stringFromRecord(input.inlineTranscriptCertification, "status") === "PASS" ? "PASS" : "FAIL";
  const compositionReviewStatus =
    stringFromRecord(input.mcpCompositionReview, "status") === "PASS" ? "PASS" : "FAIL";
  const hostedModelAccessStatus =
    stringFromRecord(input.hostedModelAccess, "status") === "PASS" ? "PASS" : "FAIL";

  const checks: McpProofSummary["mcpComposition"]["checks"] = [
    {
      id: "dual-server-client-config",
      status:
        dualConfigText.includes('"splunk"') &&
        dualConfigText.includes('"splunkready"') &&
        dualConfigText.includes("splunkready_certify_mcp_transcript")
          ? "PASS"
          : "FAIL",
      evidence: "Client config includes separate splunk and splunkready MCP servers."
    },
    {
      id: "external-mcp-client-configs",
      status:
        resourceUris.includes("splunkready://client-config/claude-desktop") &&
        resourceUris.includes("splunkready://client-config/cursor") &&
        resourceUris.includes("splunkready://client-config/antigravity") &&
        resourceUris.includes("splunkready://client-config/zed")
          ? "PASS"
          : "FAIL",
      evidence: "Claude Desktop, Cursor, Antigravity, and Zed MCP client templates are discoverable as credential-free resources."
    },
    {
      id: "discoverable-resources-and-prompts",
      status:
        resourceUris.includes("splunkready://client-config/splunk-and-splunkready") &&
        resourceUris.includes("splunkready://client-config/claude-desktop") &&
        resourceUris.includes("splunkready://client-config/cursor") &&
        resourceUris.includes("splunkready://client-config/antigravity") &&
        resourceUris.includes("splunkready://client-config/zed") &&
        resourceUris.includes("splunkready://workflows/mcp-composition-scorecard") &&
        resourceUris.includes("splunkready://workflows/hosted-model-diagnostic") &&
        resourceTemplates.includes("splunkready://receipts/{receiptId}") &&
        promptNames.includes("splunkready_splunk_mcp_certification_loop") &&
        promptNames.includes("splunkready_mcp_composition_review") &&
        promptNames.includes("splunkready_hosted_model_diagnostic")
          ? "PASS"
          : "FAIL",
      evidence: `${resourceUris.length} resources, ${resourceTemplates.length} resource template(s), and ${promptNames.length} prompts expose the composed workflow.`
    },
    {
      id: "existing-splunk-mcp-boundary",
      status: input.splunkMcpBoundary.splunkToolCallCount > 0 ? "PASS" : "FAIL",
      evidence: `${input.splunkMcpBoundary.splunkToolCallCount} captured splunk_* tool calls are certified.`
    },
    {
      id: "official-splunk-mcp-tool-coverage",
      status: input.officialSplunkMcpToolCoverage.status,
      evidence: `${input.officialSplunkMcpToolCoverage.capturedCoreTools.length} mission-scoped Splunk MCP core tool(s), ${input.officialSplunkMcpToolCoverage.investigationTools.length} investigation tool(s), and ${input.officialSplunkMcpToolCoverage.hostedModelTools.length} SAIA hosted-model tool(s) are covered.`
    },
    {
      id: "saved-search-evidence",
      status:
        input.splunkMcpBoundary.includesSavedSearchExecution &&
        input.splunkMcpBoundary.evidenceRefs.length > 0
          ? "PASS"
          : "FAIL",
      evidence: `${input.splunkMcpBoundary.evidenceRefs.length} evidence refs from saved-search output.`
    },
    {
      id: "readiness-receipt-authority",
      status:
        certificationStatus === "PASS" &&
        inlineCertificationStatus === "PASS" &&
        input.agentDrivenWorkflow.deterministicAuthority &&
        input.splunkMcpBoundary.deterministicAuthority
          ? "PASS"
          : "FAIL",
      evidence: `Path transcript certification returned ${certificationStatus}; inline transcript certification returned ${inlineCertificationStatus}; deterministic rules remain authoritative.`
    },
    {
      id: "composition-review-tool",
      status: compositionReviewStatus,
      evidence: `splunkready_review_mcp_composition returned ${compositionReviewStatus} with score ${String(input.mcpCompositionReview.score ?? "unknown")}.`
    },
    {
      id: "no-splunkready-mutation",
      status:
        input.agentDrivenWorkflow.mutation === false &&
        input.splunkMcpBoundary.mutation === false &&
        input.transcriptCertification.mutation === false &&
        input.inlineTranscriptCertification.mutation === false &&
        input.mcpCompositionReview.mutation === false &&
        input.hostedModelAccess.mutation === false
          ? "PASS"
          : "FAIL",
      evidence: "SplunkReady certification reports mutation=false across workflow, boundary, path transcript, inline transcript, hosted-model access, and receipt artifacts."
    },
    {
      id: "hosted-model-advisory-access",
      status: hostedModelAccessStatus,
      evidence: `Hosted-model access check returned ${hostedModelAccessStatus}; SAIA remains advisory and deterministic rules remain authoritative.`
    }
  ];
  const passed = checks.filter((check) => check.status === "PASS").length;

  return {
    status: passed === checks.length ? "PASS" : "FAIL",
    score: Math.round((passed / checks.length) * 100),
    servers: [
      {
        name: "splunk",
        role: "Existing Splunk MCP server for read-only investigation and operational evidence retrieval.",
        evidence: input.splunkMcpBoundary.certifiedToolNames.join(", "),
        existingMcpServer: true
      },
      {
        name: "splunkready",
        role: "SplunkReady MCP server for posture discovery, reusable prompts, and deterministic transcript certification.",
        evidence: "splunkready_certify_mcp_transcript generated the Readiness Receipt.",
        existingMcpServer: false
      }
    ],
    checks,
    deterministicAuthority: true,
    mutation: false
  };
};

const buildOfficialSplunkMcpToolCoverage = (input: {
  splunkMcpBoundary: McpProofSummary["splunkMcpBoundary"];
  hostedModelAccess: Record<string, unknown>;
}): McpProofSummary["officialSplunkMcpToolCoverage"] => {
  const capturedTools = input.splunkMcpBoundary.certifiedToolNames;
  const capturedCoreTools = capturedTools.filter((toolName) =>
    ["splunk_get_knowledge_objects", "splunk_run_query"].includes(toolName)
  );
  const investigationTools = capturedTools.filter((toolName) =>
    ["splunk_get_knowledge_objects", "splunk_run_query", "splunk_run_saved_search"].includes(toolName)
  );
  const hostedModelTools = stringArrayFromRecord(input.hostedModelAccess, "requiredTools").filter((toolName) =>
    toolName.startsWith("saia_")
  );
  const hostedModelPassedTools = stringArrayFromRecord(input.hostedModelAccess, "passedTools");
  const missionScopedOutTools = ["splunk_get_info"];

  const checks: McpProofSummary["officialSplunkMcpToolCoverage"]["checks"] = [
    {
      id: "splunk-knowledge-object-context",
      status: capturedTools.includes("splunk_get_knowledge_objects") ? "PASS" : "FAIL",
      evidence: capturedTools.includes("splunk_get_knowledge_objects")
        ? "Captured transcript discovers saved searches, macros, and lookups through Splunk MCP."
        : "Captured transcript does not discover Splunk knowledge objects."
    },
    {
      id: "splunk-investigation-execution",
      status:
        capturedTools.includes("splunk_run_saved_search") || capturedTools.includes("splunk_run_query")
          ? "PASS"
          : "FAIL",
      evidence: input.splunkMcpBoundary.includesSavedSearchExecution
        ? "Captured transcript executes a validated saved search and returns event refs."
        : "Captured transcript does not show Splunk investigation execution."
    },
    {
      id: "mission-scoped-tool-boundary",
      status: missionScopedOutTools.every((toolName) => !capturedTools.includes(toolName)) ? "PASS" : "FAIL",
      evidence:
        "The certified security mission does not call splunk_get_info because mission allowedTools scope excludes it; deterministic SAF-003 remains authoritative."
    },
    {
      id: "saia-hosted-model-tools",
      status:
        hostedModelTools.includes("saia_generate_spl") &&
        hostedModelTools.includes("saia_explain_spl") &&
        hostedModelTools.includes("saia_optimize_spl") &&
        hostedModelTools.includes("saia_ask_splunk_question") &&
        hostedModelPassedTools.length === hostedModelTools.length
          ? "PASS"
          : "FAIL",
      evidence: `${hostedModelPassedTools.length}/${hostedModelTools.length} SAIA hosted-model tools passed in the MCP proof.`
    }
  ];

  return {
    source: "splunkready-official-splunk-mcp-tool-coverage",
    status: checks.every((check) => check.status === "PASS") ? "PASS" : "FAIL",
    docs: {
      toolsUrl: officialSplunkMcpToolsUrl,
      configurationUrl: officialSplunkMcpConfigurationUrl
    },
    capturedCoreTools,
    investigationTools,
    hostedModelTools,
    missionScopedOutTools,
    checks,
    deterministicAuthority: true,
    mutation: false
  };
};

const buildMcpClientWalkthrough = (input: {
  artifactPath: string;
  markdownPath: string;
  transcriptPath: string;
  splunkMcpBoundary: McpProofSummary["splunkMcpBoundary"];
  transcriptCertification: Record<string, unknown>;
}): McpProofSummary["clientWalkthrough"] => {
  const certificationStatus =
    stringFromRecord(input.transcriptCertification, "status") === "PASS" ? "PASS" : "FAIL";
  const hasSplunkEvidence =
    input.splunkMcpBoundary.splunkToolCallCount > 0 &&
    input.splunkMcpBoundary.includesSavedSearchExecution &&
    input.splunkMcpBoundary.evidenceRefs.length > 0;
  const status = certificationStatus === "PASS" && hasSplunkEvidence ? "PASS" : "FAIL";

  return {
    source: "splunkready-mcp-client-walkthrough",
    status,
    artifactPath: input.artifactPath,
    markdownPath: input.markdownPath,
    deterministicAuthority: true,
    mutation: false,
    servers: [
      {
        name: "splunk",
        role: "Existing Splunk MCP Server performs the read-only investigation and returns deployment evidence.",
        existingMcpServer: true
      },
      {
        name: "splunkready",
        role: "SplunkReady MCP certifies the captured Splunk MCP transcript into a deterministic Readiness Receipt.",
        existingMcpServer: false
      }
    ],
    stages: [
      {
        id: "client-discovers-two-servers",
        title: "MCP client is configured with existing Splunk MCP plus SplunkReady MCP",
        server: "client",
        evidence: "splunkready://client-config/splunk-and-splunkready"
      },
      {
        id: "splunk-mcp-investigates",
        title: "Agent investigates through read-only Splunk MCP tools",
        server: "splunk",
        evidence: input.splunkMcpBoundary.certifiedToolNames.join(", ")
      },
      {
        id: "transcript-preserved",
        title: "MCP JSON-RPC request/response transcript is preserved without secrets",
        server: "client",
        evidence: input.transcriptPath
      },
      {
        id: "splunkready-certifies",
        title: "SplunkReady certifies the captured transcript",
        server: "splunkready",
        evidence: input.splunkMcpBoundary.receiptPath
      },
      {
        id: "receipt-is-authoritative",
        title: "Readiness Receipt is the authoritative verdict",
        server: "splunkready",
        evidence: `certificationStatus=${certificationStatus}; deterministicAuthority=true; mutation=false`
      }
    ],
    transcript: {
      path: input.transcriptPath,
      splunkToolNames: input.splunkMcpBoundary.certifiedToolNames,
      splunkToolCallCount: input.splunkMcpBoundary.splunkToolCallCount,
      includesSavedSearchExecution: input.splunkMcpBoundary.includesSavedSearchExecution,
      evidenceRefs: input.splunkMcpBoundary.evidenceRefs
    },
    receipt: {
      path: input.splunkMcpBoundary.receiptPath,
      status: certificationStatus,
      authoritative: true
    }
  };
};

const paramsRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
};

const buildMcpClientSession = (
  records: McpClientSessionRecord[],
  artifactPath: string,
  markdownPath: string
): McpProofSummary["clientSession"] => {
  const requestRecords = records.filter((record) => record.direction === "request");
  const responseRecords = records.filter((record) => record.direction === "response");
  const methods = [...new Set(requestRecords.map((record) => record.method).filter((method): method is string => Boolean(method)))];
  const resourceUris = [
    ...new Set(
      requestRecords
        .filter((record) => record.method === "resources/read")
        .map((record) => paramsRecord(record.params).uri)
        .filter((uri): uri is string => typeof uri === "string")
    )
  ];
  const promptNames = [
    ...new Set(
      requestRecords
        .filter((record) => record.method === "prompts/get")
        .map((record) => paramsRecord(record.params).name)
        .filter((name): name is string => typeof name === "string")
    )
  ];
  const toolNames = [
    ...new Set(
      requestRecords
        .filter((record) => record.method === "tools/call")
        .map((record) => paramsRecord(record.params).name)
        .filter((name): name is string => typeof name === "string")
    )
  ];
  const status =
    methods.includes("initialize") &&
    methods.includes("tools/list") &&
    methods.includes("resources/list") &&
    methods.includes("resources/templates/list") &&
    methods.includes("prompts/list") &&
    resourceUris.includes("splunkready://client-config/splunk-and-splunkready") &&
    resourceUris.includes("splunkready://client-config/claude-desktop") &&
    resourceUris.includes("splunkready://client-config/cursor") &&
    resourceUris.includes("splunkready://client-config/antigravity") &&
    resourceUris.includes("splunkready://client-config/zed") &&
    resourceUris.includes("splunkready://receipts/pass") &&
    resourceUris.includes("splunkready://workflows/hosted-model-diagnostic") &&
    promptNames.includes("splunkready_splunk_mcp_certification_loop") &&
    promptNames.includes("splunkready_hosted_model_diagnostic") &&
    toolNames.includes("splunkready_certify_mcp_transcript") &&
    toolNames.includes("splunkready_certify_mcp_transcript_content") &&
    toolNames.includes("splunkready_review_mcp_composition") &&
    toolNames.includes("splunkready_check_hosted_model_access")
      ? "PASS"
      : "FAIL";

  return {
    source: "splunkready-mcp-client-session",
    status,
    artifactPath,
    markdownPath,
    protocol: "stdio-jsonrpc",
    requestCount: requestRecords.length,
    responseCount: responseRecords.length,
    methods,
    resourceUris,
    promptNames,
    toolNames,
    deterministicAuthority: true,
    mutation: false
  };
};

const runLiveMockSplunkMcpSession = async (input: {
  enabled?: boolean;
  serverPath?: string;
  fixturePath?: string;
  routeState?: "ok" | "degraded" | "route-not-found";
  artifactPath: string;
  markdownPath: string;
}): Promise<McpProofSummary["liveMockSplunkMcp"]> => {
  const routeState = input.routeState ?? "ok";

  if (!input.enabled) {
    const summary: McpProofSummary["liveMockSplunkMcp"] = {
      source: "splunkready-live-mock-splunk-mcp",
      status: "NOT_REQUESTED",
      artifactPath: input.artifactPath,
      markdownPath: input.markdownPath,
      routeState,
      toolNames: [],
      evidenceRefs: [],
      includesSavedSearchExecution: false,
      requestCount: 0,
      responseCount: 0,
      deterministicAuthority: true,
      mutation: false
    };
    await writeFile(input.artifactPath, "");
    await writeFile(input.markdownPath, liveMockSplunkMcpMarkdown(summary), "utf8");
    return summary;
  }

  if (!input.serverPath || !input.fixturePath) {
    throw new Error("mcp-proof --live-mock requires a mock server path and fixture path.");
  }

  const client = new McpStdioClient(input.serverPath, [
    "mock-splunk-mcp",
    "--fixture",
    input.fixturePath,
    "--mock-state",
    routeState
  ]);

  try {
    await client.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "splunkready-mcp-proof-live-mock", version: "0.0.0" }
    });
    client.notify("notifications/initialized");
    await client.request("tools/list");
    await client.request("tools/call", {
      name: "splunk_get_info",
      arguments: {}
    });
    await client.request("tools/call", {
      name: "splunk_get_knowledge_objects",
      arguments: {
        types: ["saved_searches", "macros", "lookups"],
        query: "ES - Lateral Movement Auth Chain",
        app: "SplunkEnterpriseSecuritySuite"
      }
    });
    const savedSearchResult = await client.request("tools/call", {
      name: "splunk_run_saved_search",
      arguments: {
        app: "SplunkEnterpriseSecuritySuite",
        name: "ES - Lateral Movement Auth Chain",
        tokens: { host: "win-finance-07" },
        maxRows: 10
      }
    });
    const requestRecords = client.session().filter((record) => record.direction === "request");
    const responseRecords = client.session().filter((record) => record.direction === "response");
    const toolNames = [
      ...new Set(
        requestRecords
          .filter((record) => record.method === "tools/call")
          .map((record) => paramsRecord(record.params).name)
          .filter((name): name is string => typeof name === "string")
      )
    ];
    const savedSearchStructuredContent = safeRecord(savedSearchResult.structuredContent);
    const evidenceRefs = collectEvidenceRefs(savedSearchStructuredContent);
    const summary: McpProofSummary["liveMockSplunkMcp"] = {
      source: "splunkready-live-mock-splunk-mcp",
      status:
        toolNames.includes("splunk_get_info") &&
        toolNames.includes("splunk_get_knowledge_objects") &&
        toolNames.includes("splunk_run_saved_search") &&
        evidenceRefs.length > 0
          ? "PASS"
          : "FAIL",
      artifactPath: input.artifactPath,
      markdownPath: input.markdownPath,
      routeState,
      toolNames,
      evidenceRefs,
      includesSavedSearchExecution: toolNames.includes("splunk_run_saved_search"),
      requestCount: requestRecords.length,
      responseCount: responseRecords.length,
      deterministicAuthority: true,
      mutation: false
    };

    await writeFile(input.artifactPath, `${client.session().map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
    await writeFile(input.markdownPath, liveMockSplunkMcpMarkdown(summary), "utf8");

    return summary;
  } finally {
    client.close();
  }
};

const buildCompositionRecorderEvidence = async (input: {
  liveMock?: boolean;
  cliPath?: string;
  fixturePath?: string;
  mockState: "ok" | "degraded" | "route-not-found";
  transcriptPath: string;
  finalAnswer: string;
  splunkReadySession: McpClientSessionRecord[];
  artifactPath: string;
  markdownPath: string;
  certificationOutDir: string;
  downstreamCertificationOutDir: string;
  downstreamPathCertificationOutDir: string;
}): Promise<McpCompositionRecorderSummary> => {
  if (input.liveMock && input.cliPath && input.fixturePath) {
    return runMcpRecorderGatewayProofSession({
      cliPath: input.cliPath,
      fixturePath: input.fixturePath,
      mockState: input.mockState,
      transcriptPath: input.transcriptPath,
      finalAnswer: input.finalAnswer,
      artifactPath: input.artifactPath,
      markdownPath: input.markdownPath,
      certificationOutDir: input.certificationOutDir,
      downstreamCertificationOutDir: input.downstreamCertificationOutDir,
      downstreamPathCertificationOutDir: input.downstreamPathCertificationOutDir
    });
  }

  const compositionRecorderBase = await writeMcpCompositionRecorderSession({
    splunkTranscriptPath: input.transcriptPath,
    splunkReadySession: input.splunkReadySession,
    artifactPath: input.artifactPath,
    markdownPath: input.markdownPath
  });
  const compositionRecorderCertification = await runMcpTranscriptCertificationFromPathWorkflow({
    outDir: input.certificationOutDir,
    transcriptPath: input.artifactPath,
    strictImport: true,
    requirePass: true,
    agentName: "MCP Composition Recorder",
    agentVersion: "dual-server-redacted-session"
  });
  const compositionRecorder: McpCompositionRecorderSummary = {
    ...compositionRecorderBase,
    certification: {
      status: compositionRecorderCertification.status,
      outDir: compositionRecorderCertification.outDir,
      artifactCount: compositionRecorderCertification.artifacts.length
    },
    status:
      compositionRecorderBase.status === "PASS" && compositionRecorderCertification.status === "PASS"
        ? "PASS"
        : "FAIL"
  };
  await writeFile(input.markdownPath, renderMcpCompositionRecorderMarkdown(compositionRecorder), "utf8");
  return compositionRecorder;
};

const readOperatorLiveHostedModelStatus = async (
  artifactPath = "artifacts/live-hosted-model-diagnostic/hosted-model-diagnostic.json"
): Promise<McpProofSummary["operatorLiveHostedModelStatus"]> => {
  const notProvided: McpProofSummary["operatorLiveHostedModelStatus"] = {
    source: "splunkready-operator-live-hosted-model-status",
    status: "NOT_PROVIDED",
    artifactPath,
    blockerClass: "NOT_PROVIDED",
    permissionStatus: "NOT_PROVIDED",
    permissionBlockerClass: "NOT_PROVIDED",
    requiredTools: [],
    availableTools: [],
    passedTools: [],
    blockedTools: [],
    restHandlerProbeStatus: "NOT_PROVIDED",
    summary:
      "No operator-owned live hosted-model diagnostic artifact was present when the credential-free MCP proof was generated.",
    safeForPublicExport: true,
    deterministicAuthority: true,
    mutation: false
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(artifactPath, "utf8")) as unknown;
  } catch {
    return notProvided;
  }

  const record = safeRecord(parsed);
  const permission = safeRecord(record.permission);
  const restHandlerProbe = safeRecord(record.restHandlerProbe);
  const remediation = safeRecord(record.remediation);
  const status = stringFromRecord(record, "status") === "PASS" ? "PASS" : "BLOCKED";
  const blockerClass = stringFromRecord(record, "blockerClass") || "UNKNOWN";
  const permissionStatus = stringFromRecord(permission, "status") || "UNKNOWN";
  const permissionBlockerClass = stringFromRecord(permission, "blockerClass") || blockerClass;
  const restHandlerProbeStatus = stringFromRecord(restHandlerProbe, "status") || "NOT_RUN";
  const summary =
    stringFromRecord(remediation, "summary") ||
    stringFromRecord(permission, "message") ||
    "Operator-owned live hosted-model diagnostic artifact was present, but no summary field was available.";

  return {
    source: "splunkready-operator-live-hosted-model-status",
    status,
    artifactPath,
    blockerClass,
    permissionStatus,
    permissionBlockerClass,
    requiredTools: stringArray(record.requiredTools),
    availableTools: stringArray(record.availableTools),
    passedTools: stringArray(record.passedTools),
    blockedTools: stringArray(record.blockedTools),
    restHandlerProbeStatus,
    summary,
    safeForPublicExport: true,
    deterministicAuthority: true,
    mutation: false
  };
};

export const runMcpProofWorkflow = async (
  input: McpProofWorkflowInput
): Promise<McpProofWorkflowResult> => {
  const outDir = input.outDir;
  const transcriptPath = input.transcriptPath ?? defaultTranscriptPath;
  const finalAnswer = input.finalAnswer ?? defaultFinalAnswer;
  const summaryPath = join(outDir, "mcp-proof-summary.json");
  const markdownPath = join(outDir, "mcp-proof-summary.md");
  const clientWalkthroughPath = join(outDir, "mcp-client-walkthrough.json");
  const clientWalkthroughMarkdownPath = join(outDir, "mcp-client-walkthrough.md");
  const clientSessionPath = join(outDir, "mcp-client-session.jsonl");
  const clientSessionMarkdownPath = join(outDir, "mcp-client-session.md");
  const liveMockSplunkMcpSessionPath = join(outDir, "mock-splunk-mcp-session.jsonl");
  const liveMockSplunkMcpMarkdownPath = join(outDir, "mock-splunk-mcp-session.md");
  const appInspectCompositionPath = join(outDir, "appinspect-mcp-composition.json");
  const appInspectCompositionMarkdownPath = join(outDir, "appinspect-mcp-composition.md");
  const compositionRecorderSessionPath = join(outDir, "dual-server-session.jsonl");
  const compositionRecorderMarkdownPath = join(outDir, "dual-server-session.md");
  const recorderGatewayCertificationOutDir = join(outDir, "mcp-composition-recorder-certification");
  const recorderGatewayDownstreamCertificationOutDir = join(outDir, "mcp-recorder-gateway-inline-certification");
  const recorderGatewayDownstreamPathCertificationOutDir = join(outDir, "mcp-recorder-gateway-path-certification");
  const transcriptOutDir = join(outDir, "mcp-transcript-certification");
  const inlineTranscriptOutDir = join(outDir, "mcp-inline-transcript-certification");
  const hostedModelAccessOutDir = join(outDir, "mcp-hosted-model-access");

  await mkdir(outDir, { recursive: true });
  await mkdir(transcriptOutDir, { recursive: true });
  await mkdir(inlineTranscriptOutDir, { recursive: true });
  await mkdir(hostedModelAccessOutDir, { recursive: true });
  await mkdir(recorderGatewayCertificationOutDir, { recursive: true });

  const client = new McpStdioClient(input.serverPath);

  try {
    const initialize = await client.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "splunkready-mcp-proof", version: "0.1.0" }
    });
    client.notify("notifications/initialized");

    const serverInfo = asRecord(initialize.serverInfo, "initialize.serverInfo");
    const describeResult = await client.request("tools/call", {
      name: "splunkready_describe_certification",
      arguments: {}
    });
    const describe = extractStructuredContent(describeResult, "splunkready_describe_certification");
    const postureResource = asRecord(
      await client.request("resources/read", { uri: "splunkready://certification/posture" }),
      "postureResource"
    );
    const clientConfigResource = asRecord(
      await client.request("resources/read", { uri: "splunkready://client-config/stdio" }),
      "clientConfigResource"
    );
    const dualServerClientConfigResource = asRecord(
      await client.request("resources/read", { uri: "splunkready://client-config/splunk-and-splunkready" }),
      "dualServerClientConfigResource"
    );
    const claudeDesktopClientConfigResource = asRecord(
      await client.request("resources/read", { uri: "splunkready://client-config/claude-desktop" }),
      "claudeDesktopClientConfigResource"
    );
    const cursorClientConfigResource = asRecord(
      await client.request("resources/read", { uri: "splunkready://client-config/cursor" }),
      "cursorClientConfigResource"
    );
    const antigravityClientConfigResource = asRecord(
      await client.request("resources/read", { uri: "splunkready://client-config/antigravity" }),
      "antigravityClientConfigResource"
    );
    const zedClientConfigResource = asRecord(
      await client.request("resources/read", { uri: "splunkready://client-config/zed" }),
      "zedClientConfigResource"
    );
    const certificationLoopResource = asRecord(
      await client.request("resources/read", { uri: "splunkready://workflows/splunk-mcp-certification-loop" }),
      "certificationLoopResource"
    );
    const compositionScorecardResource = asRecord(
      await client.request("resources/read", { uri: "splunkready://workflows/mcp-composition-scorecard" }),
      "compositionScorecardResource"
    );
    const hostedModelDiagnosticResource = asRecord(
      await client.request("resources/read", { uri: "splunkready://workflows/hosted-model-diagnostic" }),
      "hostedModelDiagnosticResource"
    );
    const receiptTemplateResource = asRecord(
      await client.request("resources/read", { uri: "splunkready://receipts/pass" }),
      "receiptTemplateResource"
    );
    const transcriptPrompt = asRecord(
      await client.request("prompts/get", {
        name: "splunkready_certify_mcp_transcript",
        arguments: {
          transcriptPath,
          outDir: transcriptOutDir,
          finalAnswer
        }
      }),
      "transcriptPrompt"
    );
    const certificationLoopPrompt = asRecord(
      await client.request("prompts/get", {
        name: "splunkready_splunk_mcp_certification_loop",
        arguments: {
          splunkMcpServerName: "splunk",
          transcriptPath,
          outDir: transcriptOutDir
        }
      }),
      "certificationLoopPrompt"
    );
    const compositionReviewPrompt = asRecord(
      await client.request("prompts/get", {
        name: "splunkready_mcp_composition_review",
        arguments: {
          proofSummaryPath: summaryPath
        }
      }),
      "compositionReviewPrompt"
    );
    const hostedModelDiagnosticPrompt = asRecord(
      await client.request("prompts/get", {
        name: "splunkready_hosted_model_diagnostic",
        arguments: {
          outDir: hostedModelAccessOutDir,
          mode: "fixture"
        }
      }),
      "hostedModelDiagnosticPrompt"
    );
    const toolsList = await client.request("tools/list");
    const tools = Array.isArray(toolsList.tools)
      ? toolsList.tools.map((tool) => {
          const record = safeRecord(tool);
          const annotations = safeRecord(record.annotations);
          return {
            name: String(record.name),
            destructiveHint: annotations.destructiveHint,
            readOnlyHint: annotations.readOnlyHint
          };
        })
      : [];
    const resourcesList = await client.request("resources/list");
    const resources = Array.isArray(resourcesList.resources)
      ? resourcesList.resources.map((resource) => {
          const record = safeRecord(resource);
          return {
            uri: String(record.uri),
            name: String(record.name),
            mimeType: String(record.mimeType)
          };
        })
      : [];
    const templatesList = await client.request("resources/templates/list");
    const resourceTemplates = Array.isArray(templatesList.resourceTemplates)
      ? templatesList.resourceTemplates.map((template) => {
          const record = safeRecord(template);
          return {
            uriTemplate: String(record.uriTemplate),
            name: String(record.name),
            mimeType: String(record.mimeType)
          };
        })
      : [];
    const promptsList = await client.request("prompts/list");
    const prompts = Array.isArray(promptsList.prompts)
      ? promptsList.prompts.map((prompt) => {
          const record = safeRecord(prompt);
          const args = Array.isArray(record.arguments) ? record.arguments : [];
          return {
            name: String(record.name),
            argumentCount: args.length
          };
        })
      : [];
    const transcriptContent = await readFile(transcriptPath, "utf8");
    const transcriptCall = await client.request("tools/call", {
      name: "splunkready_certify_mcp_transcript",
      arguments: {
        transcriptPath,
        finalAnswer,
        outDir: transcriptOutDir,
        strictImport: true,
        requirePass: true,
        agentName: "External MCP Agent",
        agentVersion: "mcp-proof-jsonrpc-pass"
      }
    });
    const transcriptCertification = extractStructuredContent(transcriptCall, "splunkready_certify_mcp_transcript");
    const toolArtifacts = stringArrayFromRecord(transcriptCertification, "artifacts");
    const inlineCall = await client.request("tools/call", {
      name: "splunkready_certify_mcp_transcript_content",
      arguments: {
        transcript: transcriptContent,
        finalAnswer,
        outDir: inlineTranscriptOutDir,
        strictImport: true,
        requirePass: true,
        agentName: "Inline MCP Agent",
        agentVersion: "mcp-proof-inline-jsonrpc-pass"
      }
    });
    const inlineTranscriptCertification = extractStructuredContent(inlineCall, "splunkready_certify_mcp_transcript_content");
    const inlineToolArtifacts = stringArrayFromRecord(inlineTranscriptCertification, "artifacts");
    const compositionReviewCall = await client.request("tools/call", {
      name: "splunkready_review_mcp_composition",
      arguments: {
        transcript: transcriptContent,
        clientConfig: textFromMcpResource(dualServerClientConfigResource),
        requirePass: true
      }
    });
    const mcpCompositionReview = extractStructuredContent(compositionReviewCall, "splunkready_review_mcp_composition");
    const hostedModelAccessCall = await client.request("tools/call", {
      name: "splunkready_check_hosted_model_access",
      arguments: {
        outDir: hostedModelAccessOutDir,
        mode: "fixture",
        requirePass: true
      }
    });
    const hostedModelAccess = extractStructuredContent(hostedModelAccessCall, "splunkready_check_hosted_model_access");
    const hostedModelAccessArtifacts = stringArrayFromRecord(hostedModelAccess, "artifacts");
    const operatorLiveHostedModelStatus = await readOperatorLiveHostedModelStatus();

    const certificationStatus = stringFromRecord(transcriptCertification, "status") === "PASS" ? "PASS" : "FAIL";
    const splunkMcpBoundary = await readSplunkMcpBoundaryEvidence(
      transcriptPath,
      certificationStatus,
      join(transcriptOutDir, "receipt-external-001.json")
    );
    const agentDrivenWorkflow: McpProofSummary["agentDrivenWorkflow"] = {
      status:
        certificationStatus === "PASS" &&
        splunkMcpBoundary.includesSavedSearchExecution &&
        splunkMcpBoundary.splunkToolCallCount > 0
          ? "PASS"
          : "FAIL",
      splunkMcpServerRole:
        "Splunk MCP performs the read-only investigation actions and returns operational data to the agent.",
      splunkReadyMcpServerRole:
        "SplunkReady MCP gives the agent posture resources, reusable prompts, and deterministic certification tools for the captured transcript.",
      stages: [
        "MCP client discovers SplunkReady certification posture and stdio configuration.",
        "Agent investigates through Splunk MCP read-only tools and preserves the JSON-RPC transcript.",
        "Agent calls SplunkReady MCP to certify the captured Splunk MCP transcript.",
        "Agent explains the generated Readiness Receipt without overriding the deterministic verdict."
      ],
      deterministicAuthority: true,
      mutation: false
    };
    const officialSplunkMcpToolCoverage = buildOfficialSplunkMcpToolCoverage({
      splunkMcpBoundary,
      hostedModelAccess
    });
    const mcpComposition = buildMcpCompositionScorecard({
      dualServerClientConfigResource,
      resources,
      resourceTemplates,
      prompts,
      transcriptCertification,
      inlineTranscriptCertification,
      mcpCompositionReview,
      hostedModelAccess,
      agentDrivenWorkflow,
      splunkMcpBoundary,
      officialSplunkMcpToolCoverage
    });
    const clientWalkthrough = buildMcpClientWalkthrough({
      artifactPath: clientWalkthroughPath,
      markdownPath: clientWalkthroughMarkdownPath,
      transcriptPath,
      splunkMcpBoundary,
      transcriptCertification
    });
    const liveMockSplunkMcp = await runLiveMockSplunkMcpSession({
      enabled: input.liveMock,
      serverPath: input.mockServerPath,
      fixturePath: input.mockFixturePath,
      routeState: input.mockState,
      artifactPath: liveMockSplunkMcpSessionPath,
      markdownPath: liveMockSplunkMcpMarkdownPath
    });
    const appInspectComposition = await runAppInspectCompositionWorkflow({
      enabled: input.liveMock === true,
      appPackagePath: await findDefaultSplunkAppPackage(),
      artifactPath: appInspectCompositionPath,
      markdownPath: appInspectCompositionMarkdownPath
    });
    const compositionRecorder = await buildCompositionRecorderEvidence({
      liveMock: input.liveMock,
      cliPath: input.mockServerPath,
      fixturePath: input.mockFixturePath,
      mockState: input.mockState ?? "ok",
      transcriptPath,
      finalAnswer,
      splunkReadySession: client.session(),
      artifactPath: compositionRecorderSessionPath,
      markdownPath: compositionRecorderMarkdownPath,
      certificationOutDir: recorderGatewayCertificationOutDir,
      downstreamCertificationOutDir: recorderGatewayDownstreamCertificationOutDir,
      downstreamPathCertificationOutDir: recorderGatewayDownstreamPathCertificationOutDir
    });
    const summary: McpProofSummary = {
      source: "splunkready-mcp-proof",
      status:
        certificationStatus === "PASS" &&
        inlineTranscriptCertification.status === "PASS" &&
        mcpCompositionReview.status === "PASS" &&
        hostedModelAccess.status === "PASS" &&
        compositionRecorder.status === "PASS" &&
        (!input.liveMock || liveMockSplunkMcp.status === "PASS")
          ? "PASS"
          : "FAIL",
      mutation: false,
      generatedAt,
      serverPath: displayPath(input.serverPath),
      transcriptPath,
      handshake: {
        protocolVersion: stringFromRecord(initialize, "protocolVersion"),
        serverName: stringFromRecord(serverInfo, "name"),
        instructions: stringFromRecord(initialize, "instructions")
      },
      tools,
      resources,
      resourceTemplates,
      prompts,
      describe,
      postureResource,
      clientConfigResource,
      dualServerClientConfigResource,
      claudeDesktopClientConfigResource,
      cursorClientConfigResource,
      antigravityClientConfigResource,
      zedClientConfigResource,
      certificationLoopResource,
      compositionScorecardResource,
      hostedModelDiagnosticResource,
      receiptTemplateResource,
      transcriptPrompt,
      certificationLoopPrompt,
      compositionReviewPrompt,
      hostedModelDiagnosticPrompt,
      transcriptCertification,
      inlineTranscriptCertification,
      mcpCompositionReview,
      hostedModelAccess,
      operatorLiveHostedModelStatus,
      agentDrivenWorkflow,
      splunkMcpBoundary,
      mcpComposition,
      officialSplunkMcpToolCoverage,
      clientWalkthrough,
      clientSession: buildMcpClientSession(client.session(), clientSessionPath, clientSessionMarkdownPath),
      liveMockSplunkMcp,
      appInspectComposition,
      compositionRecorder,
      artifacts: [
        summaryPath,
        markdownPath,
        clientWalkthroughPath,
        clientWalkthroughMarkdownPath,
        clientSessionPath,
        clientSessionMarkdownPath,
        liveMockSplunkMcpSessionPath,
        liveMockSplunkMcpMarkdownPath,
        appInspectCompositionPath,
        appInspectCompositionMarkdownPath,
        compositionRecorderSessionPath,
        compositionRecorderMarkdownPath,
        ...(compositionRecorder.certification ? [compositionRecorder.certification.outDir] : []),
        recorderGatewayDownstreamCertificationOutDir,
        recorderGatewayDownstreamPathCertificationOutDir,
        ...toolArtifacts,
        ...inlineToolArtifacts,
        ...hostedModelAccessArtifacts
      ],
      nextCommands: [
        `npm run mcp`,
        `npm run splunkready -- certify-mcp-transcript --transcript ${transcriptPath} --out ${transcriptOutDir} --strict-import true --require-pass true --agent-name "External MCP Agent" --agent-version "mcp-proof-jsonrpc-pass" --json`
      ]
    };

    await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    await writeFile(markdownPath, mcpProofMarkdown(summary), "utf8");
    await writeFile(clientWalkthroughPath, `${JSON.stringify(clientWalkthrough, null, 2)}\n`, "utf8");
    await writeFile(clientWalkthroughMarkdownPath, mcpClientWalkthroughMarkdown(clientWalkthrough), "utf8");
    await writeFile(clientSessionPath, `${client.session().map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
    await writeFile(clientSessionMarkdownPath, mcpClientSessionMarkdown(summary.clientSession), "utf8");

    return {
      status: summary.status,
      outDir: input.outDir,
      artifacts: summary.artifacts,
      mutation: false,
      messages: [
        `Initialized MCP server ${summary.handshake.serverName} with ${summary.tools.length} certification tool(s), ${summary.resources.length} resource(s), and ${summary.prompts.length} prompt(s).`,
        `Discovered ${summary.resourceTemplates.length} MCP resource template(s) and read splunkready://receipts/pass.`,
        `Certified transcript ${transcriptPath} through splunkready_certify_mcp_transcript and splunkready_certify_mcp_transcript_content.`,
        "Checked hosted-model SAIA access through splunkready_check_hosted_model_access in fixture mode.",
        `Recorded operator live hosted-model status as ${operatorLiveHostedModelStatus.status}.`,
        `Recorded live mock Splunk MCP status as ${liveMockSplunkMcp.status}.`,
        `Recorded AppInspect MCP composition status as ${appInspectComposition.status}.`,
        `Recorded dual-server MCP composition session as ${compositionRecorder.status}.`
      ]
    };
  } finally {
    client.close();
  }
};
