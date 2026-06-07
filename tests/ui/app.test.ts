import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  artifactBaseFromLocation,
  artifactUrl,
  defaultArtifactOptions,
  loadUiArtifactBundle,
  type UiArtifactBundle,
  normalizeArtifactBase
} from "../../ui/src/artifacts.js";
import { renderApp } from "../../ui/src/render.js";
import { renderTracePreview } from "../../ui/src/runBrowser.js";
import type {
  EnvironmentContract,
  Mission,
  PolicyPatch,
  ReadinessProfile,
  ReadinessReceipt,
  TraceEvent,
  Violation
} from "../../src/schemas/core.js";

const contract: EnvironmentContract = {
  id: "contract-acme-soc-dev",
  name: "acme-soc-dev",
  version: "2026.06.01",
  generatedAt: "2026-06-01T06:30:00.000Z",
  mode: "fixture",
  indexes: [
    { name: "wineventlog", sensitive: false },
    { name: "finance_pii", sensitive: true }
  ],
  restrictedIndexes: ["finance_pii"],
  sourcetypes: [{ name: "XmlWinEventLog:Security", fields: ["src", "dest", "user", "EventCode"] }],
  canonicalFields: { auth_source: "src", auth_user: "user" },
  macros: [],
  lookups: [],
  savedSearches: [{ name: "ES - Lateral Movement Auth Chain", app: "SplunkEnterpriseSecuritySuite" }],
  dashboardPanels: [],
  dataModels: [],
  appContexts: ["SplunkEnterpriseSecuritySuite", "search"],
  mcpTools: [
    "splunk_get_info",
    "splunk_get_indexes",
    "splunk_get_knowledge_objects",
    "splunk_run_query",
    "splunk_run_saved_search",
    "saia_generate_spl",
    "saia_explain_spl",
    "saia_optimize_spl",
    "saia_ask_splunk_question"
  ],
  queryBudgets: { maxToolCalls: 6, maxResultRows: 50, timeoutSeconds: 30 },
  evidenceRules: [{ id: "security-evidence", requiresEvidenceRefs: true }],
  forbiddenQueryPatterns: ["index=*"]
};

const mission: Mission = {
  id: "mission-security-lateral-movement-readiness",
  title: "Security Investigation Readiness",
  domain: "security",
  prompt: "Investigate lateral movement from win-finance-07.",
  requestedTimeWindow: { earliest: "-24h", latest: "now" },
  expectedTools: ["splunk_get_knowledge_objects", "splunk_run_saved_search"],
  allowedTools: ["splunk_get_knowledge_objects", "splunk_run_saved_search", "splunk_run_query"],
  forbiddenPatterns: ["index=*"],
  requiredEvidence: [{ type: "query_provenance" }],
  checks: ["SPL-001", "SPL-003", "KO-001", "EVD-001", "ANS-001"],
  severityWeights: { Critical: 25, High: 15, Medium: 8, Low: 2 },
  preferredSavedSearchRefs: ["SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain"]
};

const receipt = (overrides: Partial<ReadinessReceipt>): ReadinessReceipt => ({
  id: "receipt-after-001",
  agent: { name: "Gemini Splunk MCP Agent", version: "0.1.0" },
  environment: { id: "contract-acme-soc-dev", name: "acme-soc-dev" },
  mode: "fixture",
  contractVersion: "2026.06.01",
  missionSuiteVersion: "security-readiness-1",
  verdict: "READY",
  score: 100,
  passedMissions: [mission.id],
  failedMissions: [],
  criticalViolations: [],
  violations: [],
  traceRefs: ["trace-after-call", "trace-after-result"],
  evidenceRefs: ["evt-auth-001"],
  policyPatchSummary: [],
  rerunComparison: {
    beforeScore: 0,
    afterScore: 100,
    beforeVerdict: "NOT READY",
    afterVerdict: "READY",
    resolvedViolations: ["violation-spl-001"]
  },
  generatedBy: "Agent Readiness Compiler",
  ...overrides
});

const beforeTrace: TraceEvent[] = [
  {
    id: "trace-before-call",
    missionId: mission.id,
    timestamp: "2026-06-01T06:31:00.000Z",
    actor: "specimen_agent",
    type: "tool_call",
    toolName: "splunk_run_query",
    toolInput: { query: "search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now" },
    toolOutputSummary: null,
    queryRef: null,
    timeWindow: mission.requestedTimeWindow,
    resultCount: null,
    evidenceRefs: [],
    error: null
  }
];

const afterTrace: TraceEvent[] = [
  {
    id: "trace-after-call",
    missionId: mission.id,
    timestamp: "2026-06-01T06:45:00.000Z",
    actor: "specimen_agent",
    type: "tool_call",
    toolName: "splunk_run_saved_search",
    toolInput: { name: "ES - Lateral Movement Auth Chain", app: "SplunkEnterpriseSecuritySuite" },
    toolOutputSummary: null,
    queryRef: null,
    timeWindow: mission.requestedTimeWindow,
    resultCount: null,
    evidenceRefs: ["evt-auth-001"],
    error: null
  }
];

const violation: Violation = {
  id: "violation-spl-001",
  missionId: mission.id,
  traceEventId: "trace-before-call",
  ruleId: "SPL-001",
  severity: "Critical",
  reason: "Query contains a forbidden SPL pattern.",
  evidence: { query: "search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now" },
  suggestedPolicyPatch: "Use a validated saved search or authorized index.",
  evidenceRefs: []
};

const koViolation: Violation = {
  id: "violation-ko-001",
  missionId: mission.id,
  traceEventId: "trace-before-call",
  ruleId: "KO-001",
  severity: "High",
  reason: "Mission requires saved-search discovery, but the trace never inspected knowledge objects.",
  evidence: { expectedTool: "splunk_get_knowledge_objects" },
  suggestedPolicyPatch: "Inspect validated saved searches before custom SPL.",
  evidenceRefs: []
};

const readinessProfile: ReadinessProfile = {
  id: "readiness-profile-contract-acme-soc-dev-profile-2026-06-01",
  generatedAt: "2026-06-01T06:30:00.000Z",
  compiler: "Agent Readiness Compiler",
  contractRef: {
    id: contract.id,
    name: contract.name,
    version: contract.version,
    mode: contract.mode
  },
  missionRefs: [mission.id],
  sourceRefs: ["environment-contract.json", "missions.json"],
  deploymentSignals: {
    mode: contract.mode,
    indexCount: contract.indexes.length,
    restrictedIndexCount: contract.restrictedIndexes.length,
    sourcetypeCount: contract.sourcetypes.length,
    savedSearchCount: contract.savedSearches.length,
    appContextCount: contract.appContexts.length,
    dataModelCount: contract.dataModels.length,
    allowedTools: contract.mcpTools,
    queryBudgets: contract.queryBudgets
  },
  ruleBindings: [
    {
      ruleId: "SPL-001",
      severity: "Critical",
      source: "splunk_contract",
      contractRefs: [`${contract.id}.forbiddenQueryPatterns`],
      missionRefs: [mission.id],
      evidence: [{ ref: `${contract.id}.forbiddenQueryPatterns`, value: contract.forbiddenQueryPatterns }],
      rationale: "The compiled Splunk contract declares forbidden broad-search patterns."
    },
    {
      ruleId: "KO-001",
      severity: "High",
      source: "splunk_contract",
      contractRefs: [`${contract.id}.savedSearches`],
      missionRefs: [mission.id],
      evidence: [{ ref: `${contract.id}.savedSearches`, value: contract.savedSearches }],
      rationale: "Saved-search discipline is activated because the mission expects saved-search execution."
    },
    {
      ruleId: "EVD-001",
      severity: "Critical",
      source: "mission",
      contractRefs: [contract.id],
      missionRefs: [mission.id],
      evidence: [{ ref: `mission:${mission.id}.checks`, value: mission.checks }],
      rationale: "Mission requires deterministic EVD-001 evaluation."
    }
  ],
  llmUsage: {
    passFailAuthority: "deterministic-rule-engine",
    allowedRoles: ["explain deterministic violations", "draft policy patches"],
    prohibitedRoles: ["decide pass/fail readiness"]
  }
};

const policyPatch: PolicyPatch = {
  id: "patch-security-readiness",
  createdAt: "2026-06-01T06:45:00.000Z",
  sourceReceiptId: "receipt-before-001",
  targetAgent: { name: "Gemini Splunk MCP Agent", version: "0.1.0" },
  rules: [{ id: "inject-contract-summary", text: "Use the compiled Splunk contract before writing SPL." }],
  violationRefs: [violation.id],
  splAssistance: [
    {
      violationRef: violation.id,
      ruleId: "SPL-001",
      query: "search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now",
      explanation: "The query searches all indexes and references src_ip, which is not canonical.",
      optimizedQuery: "search index=wineventlog host=win-finance-07 src=* earliest=-24h latest=now",
      rationale: "Narrow to the known authentication index and canonical src field.",
      warnings: ["Prefer the validated saved search."]
    }
  ],
  status: "exported"
};

const importedMcpTrace: TraceEvent[] = [
  {
    id: "mission-security-lateral-movement-readiness-imported-trace-001",
    missionId: mission.id,
    timestamp: "2026-06-01T06:50:00.000Z",
    actor: "specimen_agent",
    type: "tool_call",
    toolName: "splunk_run_query",
    toolInput: { query: "search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now" },
    toolOutputSummary: null,
    queryRef: null,
    timeWindow: mission.requestedTimeWindow,
    resultCount: null,
    evidenceRefs: [],
    error: null
  },
  {
    id: "mission-security-lateral-movement-readiness-imported-trace-002",
    missionId: mission.id,
    timestamp: "2026-06-01T06:50:01.000Z",
    actor: "specimen_agent",
    type: "tool_result",
    toolName: "splunk_run_query",
    toolInput: { query: "search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now" },
    toolOutputSummary: "Query returned 0 row(s).",
    queryRef: null,
    timeWindow: mission.requestedTimeWindow,
    resultCount: 0,
    evidenceRefs: [],
    error: null,
    parentId: "mission-security-lateral-movement-readiness-imported-trace-001"
  },
  {
    id: "mission-security-lateral-movement-readiness-imported-trace-003",
    missionId: mission.id,
    timestamp: "2026-06-01T06:50:02.000Z",
    actor: "specimen_agent",
    type: "final_answer",
    toolName: null,
    toolInput: null,
    toolOutputSummary: "No evidence was found by the broad search.",
    queryRef: null,
    timeWindow: mission.requestedTimeWindow,
    resultCount: 0,
    evidenceRefs: [],
    error: null,
    parentId: "mission-security-lateral-movement-readiness-imported-trace-002"
  }
];

const externalViolation: Violation = {
  ...violation,
  id: "violation-imported-spl-001",
  traceEventId: "mission-security-lateral-movement-readiness-imported-trace-001"
};

const mcpTranscriptImport = {
  status: "PASS",
  source: "mcp-jsonrpc-transcript",
  mutation: false,
  missionId: mission.id,
  recordCount: 3,
  importedEvents: 3,
  toolCalls: 1,
  toolResults: 1,
  errors: 0,
  finalAnswers: 1,
  skippedRecords: 0,
  unmatchedToolCalls: 0,
  toolNames: ["splunk_run_query"],
  strictImport: true,
  transcriptPath: "examples/sample-mcp-transcript.jsonl",
  outputTracePath: "artifacts/mcp-transcript/trace-imported.json",
  nextCommand:
    "npm run splunkready -- grade-trace --trace artifacts/mcp-transcript/trace-imported.json --out artifacts/mcp-transcript --json"
} as const;

const mcpProofSummary = {
  source: "splunkready-mcp-proof",
  status: "PASS",
  mutation: false,
  generatedAt: "2026-06-01T06:45:00.000Z",
  serverPath: "dist/src/mcp/server.js",
  transcriptPath: "examples/sample-mcp-transcript-pass.jsonl",
  handshake: {
    protocolVersion: "2025-06-18",
    serverName: "splunkready",
    instructions:
      "SplunkReady certifies Splunk-connected agent traces. Deterministic rules decide readiness; LLM and SAIA output is advisory only. Tools do not mutate Splunk."
  },
  tools: [
    { name: "splunkready_describe_certification", destructiveHint: false, readOnlyHint: true },
    { name: "splunkready_certify_external_trace", destructiveHint: false, readOnlyHint: true },
    { name: "splunkready_certify_mcp_transcript", destructiveHint: false, readOnlyHint: true },
    { name: "splunkready_certify_mcp_transcript_content", destructiveHint: false, readOnlyHint: true },
    { name: "splunkready_check_hosted_model_access", destructiveHint: false, readOnlyHint: true }
  ],
  resources: [
    { uri: "splunkready://certification/posture", name: "certification-posture", mimeType: "application/json" },
    { uri: "splunkready://examples/external-trace-pass", name: "external-trace-pass", mimeType: "application/json" },
    { uri: "splunkready://examples/mcp-transcript-pass", name: "mcp-transcript-pass", mimeType: "text/plain" },
    { uri: "splunkready://examples/pass-receipt", name: "pass-receipt", mimeType: "application/json" },
    { uri: "splunkready://client-config/stdio", name: "stdio-client-config", mimeType: "application/json" },
    {
      uri: "splunkready://client-config/splunk-and-splunkready",
      name: "dual-server-client-config",
      mimeType: "application/json"
    },
    {
      uri: "splunkready://client-config/claude-desktop",
      name: "claude-desktop-client-config",
      mimeType: "application/json"
    },
    {
      uri: "splunkready://client-config/cursor",
      name: "cursor-client-config",
      mimeType: "application/json"
    },
    {
      uri: "splunkready://workflows/splunk-mcp-certification-loop",
      name: "splunk-mcp-certification-loop",
      mimeType: "text/markdown"
    },
    {
      uri: "splunkready://workflows/mcp-composition-scorecard",
      name: "mcp-composition-scorecard",
      mimeType: "text/markdown"
    },
    {
      uri: "splunkready://workflows/hosted-model-diagnostic",
      name: "hosted-model-diagnostic",
      mimeType: "text/markdown"
    }
  ],
  resourceTemplates: [
    {
      uriTemplate: "splunkready://receipts/{receiptId}",
      name: "readiness-receipt-by-id",
      mimeType: "text/markdown"
    }
  ],
  prompts: [
    { name: "splunkready_certify_mcp_transcript", argumentCount: 3 },
    { name: "splunkready_capture_trace", argumentCount: 2 },
    { name: "splunkready_explain_receipt", argumentCount: 2 },
    { name: "splunkready_splunk_mcp_certification_loop", argumentCount: 3 },
    { name: "splunkready_mcp_composition_review", argumentCount: 1 },
    { name: "splunkready_hosted_model_diagnostic", argumentCount: 2 }
  ],
  describe: { deterministicAuthority: true, advisoryLlmOnly: true, mutation: false },
  postureResource: { contents: [] },
  clientConfigResource: { contents: [] },
  dualServerClientConfigResource: { contents: [] },
  claudeDesktopClientConfigResource: { contents: [] },
  cursorClientConfigResource: { contents: [] },
  certificationLoopResource: { contents: [] },
  compositionScorecardResource: { contents: [] },
  hostedModelDiagnosticResource: { contents: [] },
  receiptTemplateResource: { contents: [] },
  transcriptPrompt: { messages: [] },
  certificationLoopPrompt: { messages: [] },
  compositionReviewPrompt: { messages: [] },
  hostedModelDiagnosticPrompt: { messages: [] },
  transcriptCertification: {
    status: "PASS",
    outDir: "submission-evidence/mcp-proof/mcp-transcript-certification",
    mutation: false,
    artifacts: [
      "submission-evidence/mcp-proof/mcp-transcript-certification/receipt-external-001.json",
      "submission-evidence/mcp-proof/mcp-transcript-certification/proof-audit.json"
    ]
  },
  inlineTranscriptCertification: {
    status: "PASS",
    outDir: "submission-evidence/mcp-proof/mcp-inline-transcript-certification",
    mutation: false,
    artifacts: [
      "submission-evidence/mcp-proof/mcp-inline-transcript-certification/receipt-external-001.json",
      "submission-evidence/mcp-proof/mcp-inline-transcript-certification/proof-audit.json"
    ]
  },
  hostedModelAccess: {
    status: "PASS",
    permissionStatus: "OK",
    outDir: "submission-evidence/mcp-proof/mcp-hosted-model-access",
    mutation: false,
    remediation: {
      source: "splunkready-hosted-model-remediation",
      status: "CLEAR",
      blockerClass: "NONE",
      safeForPublicExport: true,
      mutation: false,
      summary: "No hosted-model remediation is required.",
      evidence: {
        requiredTools: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"],
        availableTools: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"],
        missingTools: [],
        passedTools: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"],
        blockedTools: []
      },
      operatorChecks: ["No hosted-model remediation required."],
      rerunCommand:
        "splunkready hosted-model-diagnostic --mode live --env-file <operator-env-file> --out artifacts/hosted-model-diagnostic --require-pass true --json"
    },
    requiredTools: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"],
    availableTools: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"],
    missingTools: [],
    passedTools: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"],
    blockedTools: [],
    toolResults: [
      { toolName: "saia_generate_spl", status: "PASS", contractAdvertised: true },
      { toolName: "saia_explain_spl", status: "PASS", contractAdvertised: true },
      { toolName: "saia_optimize_spl", status: "PASS", contractAdvertised: true },
      { toolName: "saia_ask_splunk_question", status: "PASS", contractAdvertised: true }
    ],
    artifacts: [
      "submission-evidence/mcp-proof/mcp-hosted-model-access/hosted-model-proof.json",
      "submission-evidence/mcp-proof/mcp-hosted-model-access/hosted-model-diagnostic.json"
    ]
  },
  agentDrivenWorkflow: {
    status: "PASS",
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
  },
  splunkMcpBoundary: {
    status: "PASS",
    transcriptKind: "captured-splunk-mcp-jsonrpc",
    transcriptPath: "examples/sample-mcp-transcript-pass.jsonl",
    localMcpServerRole: "SplunkReady MCP exposes the Agent Readiness Compiler as a certification interface for MCP clients.",
    splunkMcpServerRole:
      "The captured transcript is the Splunk MCP Server boundary: an agent invoked Splunk MCP tools, then SplunkReady certified the behavior.",
    certifiedToolNames: ["splunk_get_knowledge_objects", "splunk_run_saved_search"],
    splunkToolCallCount: 2,
    includesSavedSearchExecution: true,
    evidenceRefs: ["evt-102", "evt-118", "evt-141"],
    receiptPath: "submission-evidence/mcp-proof/mcp-transcript-certification/receipt-external-001.json",
    deterministicAuthority: true,
    mutation: false
  },
  mcpComposition: {
    status: "PASS",
    score: 100,
    servers: [
      {
        name: "splunk",
        role: "Existing Splunk MCP server for read-only investigation and operational evidence retrieval.",
        evidence: "splunk_get_knowledge_objects, splunk_run_saved_search",
        existingMcpServer: true
      },
      {
        name: "splunkready",
        role: "SplunkReady MCP server for posture discovery, reusable prompts, and deterministic transcript certification.",
        evidence: "splunkready_certify_mcp_transcript generated the Readiness Receipt.",
        existingMcpServer: false
      }
    ],
    checks: [
      {
        id: "dual-server-client-config",
        status: "PASS",
        evidence: "Client config includes separate splunk and splunkready MCP servers."
      },
      {
        id: "discoverable-resources-and-prompts",
        status: "PASS",
        evidence: "11 resources, 1 resource template, and 6 prompts expose the composed workflow."
      },
      {
        id: "external-mcp-client-configs",
        status: "PASS",
        evidence: "Claude Desktop and Cursor MCP client templates are discoverable as credential-free resources."
      },
      {
        id: "existing-splunk-mcp-boundary",
        status: "PASS",
        evidence: "2 captured splunk_* tool calls are certified."
      },
      {
        id: "official-splunk-mcp-tool-coverage",
        status: "PASS",
        evidence: "1 mission-scoped Splunk MCP core tool(s), 2 investigation tool(s), and 4 SAIA hosted-model tool(s) are covered."
      },
      {
        id: "saved-search-evidence",
        status: "PASS",
        evidence: "3 evidence refs from saved-search output."
      },
      {
        id: "readiness-receipt-authority",
        status: "PASS",
        evidence:
          "Path transcript certification returned PASS; inline transcript certification returned PASS; deterministic rules remain authoritative."
      },
      {
        id: "no-splunkready-mutation",
        status: "PASS",
        evidence:
          "SplunkReady certification reports mutation=false across workflow, boundary, path transcript, inline transcript, hosted-model access, and receipt artifacts."
      },
      {
        id: "hosted-model-advisory-access",
        status: "PASS",
        evidence:
          "Hosted-model access check returned PASS; SAIA remains advisory and deterministic rules remain authoritative."
      }
    ],
    deterministicAuthority: true,
    mutation: false
  },
  officialSplunkMcpToolCoverage: {
    source: "splunkready-official-splunk-mcp-tool-coverage",
    status: "PASS",
    docs: {
      toolsUrl: "https://help.splunk.com/en/splunk-enterprise/mcp-server-for-splunk-platform/1.0/mcp-server-tools",
      configurationUrl:
        "https://help.splunk.com/en/splunk-cloud-platform/mcp-server-for-splunk-platform/1.2/connecting-to-the-mcp-server-and-settings"
    },
    capturedCoreTools: ["splunk_get_knowledge_objects"],
    investigationTools: ["splunk_get_knowledge_objects", "splunk_run_saved_search"],
    hostedModelTools: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"],
    missionScopedOutTools: ["splunk_get_info"],
    checks: [
      {
        id: "splunk-knowledge-object-context",
        status: "PASS",
        evidence: "Captured transcript discovers saved searches, macros, and lookups through Splunk MCP."
      },
      {
        id: "splunk-investigation-execution",
        status: "PASS",
        evidence: "Captured transcript executes a validated saved search and returns event refs."
      },
      {
        id: "mission-scoped-tool-boundary",
        status: "PASS",
        evidence:
          "The certified security mission does not call splunk_get_info because mission allowedTools scope excludes it; deterministic SAF-003 remains authoritative."
      },
      {
        id: "saia-hosted-model-tools",
        status: "PASS",
        evidence: "4/4 SAIA hosted-model tools passed in the MCP proof."
      }
    ],
    deterministicAuthority: true,
    mutation: false
  },
  clientWalkthrough: {
    source: "splunkready-mcp-client-walkthrough",
    status: "PASS",
    artifactPath: "submission-evidence/mcp-proof/mcp-client-walkthrough.json",
    markdownPath: "submission-evidence/mcp-proof/mcp-client-walkthrough.md",
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
        evidence: "splunk_get_knowledge_objects, splunk_run_saved_search"
      }
    ],
    transcript: {
      path: "examples/sample-mcp-transcript-pass.jsonl",
      splunkToolNames: ["splunk_get_knowledge_objects", "splunk_run_saved_search"],
      splunkToolCallCount: 2,
      includesSavedSearchExecution: true,
      evidenceRefs: ["evt-102", "evt-118", "evt-141"]
    },
    receipt: {
      path: "submission-evidence/mcp-proof/mcp-transcript-certification/receipt-external-001.json",
      status: "PASS",
      authoritative: true
    }
  },
  clientSession: {
    source: "splunkready-mcp-client-session",
    status: "PASS",
    artifactPath: "submission-evidence/mcp-proof/mcp-client-session.jsonl",
    markdownPath: "submission-evidence/mcp-proof/mcp-client-session.md",
    protocol: "stdio-jsonrpc",
    requestCount: 22,
    responseCount: 22,
    methods: [
      "initialize",
      "tools/list",
      "resources/list",
      "resources/templates/list",
      "resources/read",
      "prompts/list",
      "prompts/get",
      "tools/call"
    ],
    resourceUris: [
      "splunkready://certification/posture",
      "splunkready://client-config/stdio",
      "splunkready://client-config/splunk-and-splunkready",
      "splunkready://client-config/claude-desktop",
      "splunkready://client-config/cursor",
      "splunkready://workflows/splunk-mcp-certification-loop",
      "splunkready://workflows/mcp-composition-scorecard",
      "splunkready://workflows/hosted-model-diagnostic",
      "splunkready://receipts/pass"
    ],
    promptNames: [
      "splunkready_certify_mcp_transcript",
      "splunkready_splunk_mcp_certification_loop",
      "splunkready_mcp_composition_review",
      "splunkready_hosted_model_diagnostic"
    ],
    toolNames: [
      "splunkready_describe_certification",
      "splunkready_certify_mcp_transcript",
      "splunkready_certify_mcp_transcript_content",
      "splunkready_check_hosted_model_access"
    ],
    deterministicAuthority: true,
    mutation: false
  },
  artifacts: [
    "submission-evidence/mcp-proof/mcp-proof-summary.json",
    "submission-evidence/mcp-proof/mcp-client-session.jsonl",
    "submission-evidence/mcp-proof/mcp-client-session.md",
    "submission-evidence/mcp-proof/mcp-transcript-certification/receipt-external-001.json"
  ],
  nextCommands: [
    "npm run mcp",
    "npm run splunkready -- certify-mcp-transcript --transcript examples/sample-mcp-transcript-pass.jsonl --out submission-evidence/mcp-proof/mcp-transcript-certification --strict-import true --require-pass true --json"
  ]
} as const;

const judgeProofSummary = {
  source: "splunkready-judge-proof",
  status: "PASS",
  mode: "fixture",
  mutation: false,
  generatedAt: "2026-06-01T06:45:00.000Z",
  llmActivation: {
    policy: "include-when-requested-or-env-enabled",
    includeRequested: false,
    enabledByEnv: false,
    configured: false,
    included: false
  },
  proofDirs: {
    suite: "artifacts/judge-proof/suite-proof",
    firewall: "artifacts/judge-proof/firewall-check",
    llm: "artifacts/judge-proof/llm-proof"
  },
  gates: [
    { id: "suite-proof", status: "PASS", artifacts: ["artifacts/judge-proof/suite-proof/suite-proof-summary.json"] },
    { id: "firewall-check", status: "PASS", artifacts: ["artifacts/judge-proof/firewall-check/firewall-block-before.json"] },
    { id: "certification-index", status: "PASS", artifacts: ["artifacts/judge-proof/certification-index.json"] }
  ],
  llmEvidence: {
    status: "NOT_REQUESTED",
    role: "trace-producer",
    passFailAuthority: "deterministic-rule-engine",
    proofDir: "artifacts/judge-proof/llm-proof",
    artifacts: [],
    reason: "judge-proof stayed credential-free; pass --include-llm-proof true when GEMINI_API_KEY is available.",
    nextCommand: "npm run splunkready -- judge-proof --out artifacts/judge-proof --include-llm-proof true --json"
  },
  certificationIndex: "artifacts/judge-proof/certification-index.json",
  uiArtifacts: "artifacts/judge-proof/ui-artifacts.json",
  nextCommands: [
    "npm run workbench",
    "npm run splunkready -- judge-proof --out artifacts/judge-proof --include-llm-proof true --json"
  ]
} as const;

const liveProofSummary = {
  status: "PASS",
  mode: "live",
  mutation: false,
  derivedMission: {
    strategy: "internal-query-fallback",
    reason: "No saved-search candidate returned rows; generated a bounded _internal query mission instead.",
    missionId: "mission-live-internal-query-readiness",
    artifacts: ["live-derived-mission.json"]
  },
  before: { verdict: "READY", score: 100, violations: 0 },
  after: { verdict: "READY", score: 100, violations: 0 },
  failToPass: false,
  readyWithoutPatch: true,
  proofLoop: "ready-without-patch",
  hostedModels: {
    status: "available_not_applicable",
    availableTools: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"],
    missingTools: [],
    assistanceItems: 0,
    notes: "SAIA generate/explain/optimize/ask tools were available, but this proof did not produce SPL-rule violations with query evidence."
  },
  notes:
    "The live-derived mission was already ready before policy injection; this proves live certification but not the fail-to-pass patch loop."
};

const liveSecurityProofSummary = {
  status: "PASS",
  mode: "live",
  mutation: false,
  mission: "mission-security-lateral-movement-readiness",
  readinessStatus: "READY_FOR_FLAGSHIP_LIVE_SECURITY_PROOF",
  before: { verdict: "NOT READY", score: 60, violations: 4 },
  after: {
    verdict: "READY",
    score: 100,
    violations: 0,
    evidenceRefs: [
      "saved_searches:SplunkEnterpriseSecuritySuite:ES - Lateral Movement Auth Chain",
      "live-evt-102",
      "live-evt-118",
      "live-evt-141"
    ]
  },
  failToPass: true,
  readyAfterPatch: true,
  proofLoop: "fail-to-pass",
  hostedModels: {
    status: "invoked",
    availableTools: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"],
    missingTools: [],
    assistanceItems: 1,
    notes:
      "SAIA generate/explain/optimize/ask returned advisory output for SPL-rule violations. Deterministic rules remained authoritative for pass/fail."
  },
  notes:
    "The flagship live security mission completed the LLM fail -> patch -> rerun -> pass path against read-only Splunk MCP tools."
} as const;

const liveSecurityReadiness = {
  status: "BLOCKED",
  mode: "live",
  mutation: false,
  proofMode: {
    type: "strict-flagship-security",
    fallbackAllowed: false,
    rationale:
      "The flagship lateral-movement proof requires the exact saved search and row-level evidence. It does not fall back to generic _internal proof."
  },
  mission: {
    id: "mission-security-lateral-movement-readiness",
    story: "security investigation readiness"
  },
  setupRequirements: [
    {
      id: "saved-search",
      description:
        "Read-only saved search SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain exists in the live contract.",
      satisfied: false,
      operatorOwned: true
    },
    {
      id: "evidence-rows",
      description: "Saved search returns at least one row for win-finance-07 in the -24h to now mission window.",
      satisfied: false,
      operatorOwned: true
    },
    {
      id: "evidence-identifiers",
      description: "Returned rows expose stable evidence identifiers such as eventRef, _cd, _raw, or _time.",
      satisfied: false,
      operatorOwned: true
    },
    {
      id: "operator-owned-setup",
      description:
        "Any missing app, index, saved search, or sample event setup is performed by the operator, not SplunkReady.",
      satisfied: true,
      operatorOwned: true
    }
  ],
  fallbackPolicy: {
    genericLiveCommand: "live-proof",
    genericLiveDescription:
      "Use live-proof only as generic live MCP evidence when the target deployment lacks flagship security content.",
    flagshipProofCommand: "live-security-proof",
    flagshipDescription:
      "Use live-security-proof for the prize/demo lateral-movement story after operator-owned setup makes readiness green."
  },
  contract: {
    id: "contract-192-168-1-4",
    name: "192.168.1.4",
    indexes: 13,
    savedSearches: 100,
    tools: 9
  },
  requiredTools: {
    expected: ["splunk_get_knowledge_objects", "splunk_run_saved_search"],
    missing: []
  },
  preferredIndex: {
    name: "wineventlog",
    present: false,
    sensitive: null
  },
  requiredSavedSearch: {
    app: "SplunkEnterpriseSecuritySuite",
    name: "ES - Lateral Movement Auth Chain",
    ref: "SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain",
    present: false,
    nearbySavedSearches: ["search::Errors in the last 24 hours"],
    run: {
      attempted: false,
      reason: "Exact flagship saved search is not present in the live contract."
    }
  },
  blockers: [
    "Install or create read-only saved search SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain for the lateral-movement mission.",
    "Confirm the deployment has an authentication/security index such as wineventlog for the flagship story."
  ],
  nextActions: [
    "Install or create read-only saved search SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain for the lateral-movement mission.",
    "Confirm the deployment has an authentication/security index such as wineventlog for the flagship story."
  ]
} as const;

const liveSecurityKit = {
  status: "PASS",
  mutation: false,
  operatorActionRequired: true,
  mission: "mission-security-lateral-movement-readiness",
  savedSearch: {
    app: "SplunkEnterpriseSecuritySuite",
    name: "ES - Lateral Movement Auth Chain",
    ref: "SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain"
  },
  preferredIndex: "wineventlog",
  sourcetype: "XmlWinEventLog:Security",
  sampleEvents: 3,
  generatedAt: "2026-06-01T06:30:00.000Z",
  validation: {
    status: "PASS",
    expectedFiles: [
      "SplunkEnterpriseSecuritySuite/default/app.conf",
      "SplunkEnterpriseSecuritySuite/default/indexes.conf",
      "SplunkEnterpriseSecuritySuite/default/props.conf",
      "SplunkEnterpriseSecuritySuite/default/savedsearches.conf",
      "lateral-movement-events.csv",
      "README.md"
    ],
    checks: [
      {
        id: "saved-search-stanza",
        status: "PASS",
        path: "SplunkEnterpriseSecuritySuite/default/savedsearches.conf",
        detail: "Expected lateral-movement saved-search stanza is present."
      },
      {
        id: "sample-event-refs",
        status: "PASS",
        path: "lateral-movement-events.csv",
        detail: "Expected lateral-movement evidence refs are present."
      },
      {
        id: "cleanup-guidance",
        status: "PASS",
        path: "README.md",
        detail: "README includes cleanup guidance."
      }
    ]
  },
  operatorWarnings: [
    "Operator-owned install/import only; SplunkReady generated local files and performs no Splunk write operation.",
    "If Enterprise Security is already installed, do not overwrite its app directory; merge the generated stanzas through normal Splunk administration."
  ],
  cleanupGuidance: [
    "Cleanup is operator-owned and outside SplunkReady.",
    "Delete imported sample events only in an approved disposable environment."
  ],
  artifacts: [
    "artifacts/live-security-kit/SplunkEnterpriseSecuritySuite/default/savedsearches.conf",
    "artifacts/live-security-kit/lateral-movement-events.csv",
    "artifacts/live-security-kit/README.md"
  ]
} as const;

const hostedModelProof = {
  status: "PASS",
  mode: "live",
  mutation: false,
  contract: {
    id: "contract-192-168-1-4",
    mode: "live",
    hostedModelTools: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"],
    availableTools: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"]
  },
  setup: {
    source: "splunkready-live-hosted-model-preflight",
    configured: true,
    requiredEnvironment: [
      { name: "SPLUNKREADY_LIVE_ENABLED", status: "set", requiredValue: "true", purpose: "Enables live mode." },
      { name: "SPLUNKREADY_SPLUNK_MCP_URL", status: "set", requiredValue: "set", purpose: "Sets the MCP endpoint." },
      { name: "SPLUNKREADY_SPLUNK_MCP_TOKEN", status: "set", requiredValue: "set", purpose: "Sets the MCP token." }
    ],
    optionalEnvironment: [
      {
        name: "SPLUNKREADY_SAIA_ENABLED",
        status: "set",
        requiredValue: "true",
        purpose: "Shows SAIA availability in the workbench."
      }
    ],
    operatorCommand:
      "splunkready hosted-model-diagnostic --mode live --out artifacts/hosted-model-diagnostic --require-pass true --json",
    secretHandling: "Only variable names and set/missing/invalid status are written. Secret values are never written."
  },
  query: "search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now",
  deterministicContext: {
    ruleIds: ["SPL-001", "SPL-003"],
    passFailAuthority: "deterministic-rule-engine",
    purpose:
      "Demonstrate hosted-model SAIA assistance as advisory remediation for deterministic SPL violations. No generated or optimized SPL is executed."
  },
  assistance: {
    generatedQuery: "search index=wineventlog host=win-finance-07 src=* earliest=-24h latest=now",
    generationRationale: "Generate a read-only search against the authorized Windows security index.",
    explanation: "The SPL uses a broad index wildcard and a non-contract field.",
    optimizedQuery: "| savedsearch \"ES - Lateral Movement Auth Chain\"",
    rationale: "Prefer the validated saved search from the live contract.",
    answer: "Use authorized indexes and saved searches to preserve deployment-specific guardrails.",
    warnings: []
  },
  toolCalls: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"],
  error: null,
  notes:
    "This proof calls hosted-model tools only. It does not run generated, unsafe, or optimized SPL, does not grade with an LLM, and does not mutate Splunk."
} as const;

const hostedModelDiagnostic = {
  status: "PASS",
  mode: "live",
  mutation: false,
  blockerClass: "NONE",
  proofPath: "artifacts/hosted-model-proof/hosted-model-proof.json",
  contract: {
    id: "contract-192-168-1-4",
    mode: "live"
  },
  setup: hostedModelProof.setup,
  requiredTools: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"],
  availableTools: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"],
  missingTools: [],
  remediation: {
    source: "splunkready-hosted-model-remediation",
    status: "CLEAR",
    blockerClass: "NONE",
    safeForPublicExport: true,
    mutation: false,
    summary: "No hosted-model remediation is required.",
    evidence: {
      requiredTools: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"],
      availableTools: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"],
      missingTools: [],
      passedTools: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"],
      blockedTools: []
    },
    operatorChecks: ["No hosted-model remediation required."],
    rerunCommand:
      "splunkready hosted-model-diagnostic --mode live --env-file <operator-env-file> --out artifacts/hosted-model-diagnostic --require-pass true --json"
  },
  permission: {
    status: "OK",
    blockerClass: "NONE",
    message:
      "The current MCP credentials can invoke saia_generate_spl, saia_explain_spl, saia_optimize_spl, saia_ask_splunk_question for advisory SPL remediation."
  },
  deterministicAuthority: "deterministic-rule-engine",
  notes:
    "This diagnostic calls hosted-model helper tools only. It does not execute the SPL query, does not grade with an LLM, and does not mutate Splunk."
} as const;

const proofAudit = {
  status: "PASS",
  proofType: "live-security",
  proofDir: "artifacts/live-security-proof",
  mode: "live",
  mutation: false,
  failToPass: true,
  readyAfterPatch: true,
  hostedModelStatus: "invoked",
  checks: [
    {
      id: "contract-loaded",
      status: "PASS",
      detail: "Environment contract is present and schema-valid.",
      evidence: { id: "contract-192-168-1-4", mode: "live" }
    },
    {
      id: "fail-to-pass",
      status: "PASS",
      detail: "The proof demonstrates NOT READY -> READY.",
      evidence: { before: { verdict: "NOT READY", score: 60 }, after: { verdict: "READY", score: 100 } }
    },
    {
      id: "hosted-model-status",
      status: "PASS",
      detail: "Hosted-model assistance is present in the proof artifacts.",
      evidence: { status: "invoked" }
    }
  ]
} as const;

const proofManifestVerification = {
  source: "splunkready-proof-manifest-verification",
  generatedAt: "2026-06-01T06:46:00.000Z",
  status: "PASS",
  proofDir: "artifacts/live-security-proof",
  manifestPath: "artifacts/live-security-proof/proof-manifest.json",
  expectedAggregateSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  actualAggregateSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  expectedFiles: 12,
  actualFiles: 12,
  missingFiles: [],
  unexpectedFiles: [],
  changedFiles: []
} as const;

const publicProofExportManifest = {
  source: "splunkready-public-proof-export",
  generatedAt: "2026-06-01T06:47:00.000Z",
  sourceRunId: "run-source",
  sourceCommit: "abcdef123456",
  sourceArtifactBase: "/api/artifacts/run-source",
  exportArtifactBase: "/api/artifacts/run-after",
  redactionStatus: "REDACTED",
  redaction: {
    secrets: "redacted",
    privateEndpoints: "redacted",
    privateIps: "redacted",
    userPaths: "redacted",
    rawMcpErrorBodies: "redacted"
  },
  aggregateSha256: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  files: [
    {
      path: "receipt-after-001.json",
      sourcePath: "receipt-after-001.json",
      sizeBytes: 1200,
      sha256: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      redacted: true,
      schemaValidated: true
    },
    {
      path: "trace-after.json",
      sourcePath: "trace-after.json",
      sizeBytes: 900,
      sha256: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      redacted: true,
      schemaValidated: true
    }
  ]
} as const;

const firewallBlock = {
  status: "BLOCKED",
  code: "FIREWALL_POLICY_BLOCKED",
  phase: "before",
  mode: "fixture",
  mutation: false,
  blockedBeforeSplunk: true,
  toolName: "splunk_run_query",
  requestId: "mission-security-lateral-movement-readiness-naive",
  missionId: "mission-security-lateral-movement-readiness",
  message: "SplunkReady firewall blocked splunk_run_query before Splunk execution.",
  query: "search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now",
  violations: [
    { ruleId: "SPL-001", reason: "Query uses index=* and would search every index." },
    { ruleId: "SPL-003", reason: "Query references field src_ip, which is not present in the contract." }
  ]
} as const;

const firewallProofAudit = {
  status: "PASS",
  proofType: "firewall-block",
  proofDir: "artifacts/firewall-check",
  mode: "fixture",
  mutation: false,
  checks: [
    {
      id: "contract-loaded",
      status: "PASS",
      detail: "Environment contract is present and schema-valid.",
      evidence: { id: contract.id, mode: "fixture" }
    },
    {
      id: "firewall-block-loaded",
      status: "PASS",
      detail: "Firewall block report identifies the blocked Splunk tool and phase.",
      evidence: { code: "FIREWALL_POLICY_BLOCKED", phase: "before", toolName: "splunk_run_query" }
    },
    {
      id: "firewall-block-before-splunk",
      status: "PASS",
      detail: "Query was rejected before Splunk execution and without mutation.",
      evidence: { blockedBeforeSplunk: true, mutation: false }
    }
  ]
} as const;

const suiteProofSummary = {
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
  },
  missions: [
    {
      missionId: "mission-security-lateral-movement-readiness",
      title: "Security Investigation Readiness",
      domain: "security",
      artifactDir: "artifacts/suite-proof/mission-security-lateral-movement-readiness",
      proofLoop: "fail-to-pass",
      before: { verdict: "NOT READY", score: 0, violations: 5 },
      after: { verdict: "READY", score: 100, violations: 0, evidenceRefs: ["evt-102", "evt-118", "evt-141"] }
    },
    {
      missionId: "mission-security-exfiltration-readiness",
      title: "Security Exfiltration Readiness",
      domain: "security",
      artifactDir: "artifacts/suite-proof/mission-security-exfiltration-readiness",
      proofLoop: "fail-to-pass",
      before: { verdict: "NOT READY", score: 0, violations: 5 },
      after: { verdict: "READY", score: 100, violations: 0, evidenceRefs: ["dns-301", "dns-302", "dns-303"] }
    },
    {
      missionId: "mission-observability-latency-readiness",
      title: "Observability Latency Readiness",
      domain: "observability",
      artifactDir: "artifacts/suite-proof/mission-observability-latency-readiness",
      proofLoop: "fail-to-pass",
      before: { verdict: "NOT READY", score: 50, violations: 2 },
      after: { verdict: "READY", score: 100, violations: 0, evidenceRefs: ["obs-201", "obs-202", "obs-203", "obs-204"] }
    }
  ]
} as const;

const suiteProofAudit = {
  status: "PASS",
  proofType: "suite",
  proofDir: "artifacts/suite-proof",
  mode: "fixture",
  mutation: false,
  failToPass: true,
  readyAfterPatch: true,
  proofLoop: "fail-to-pass",
  checks: [
    {
      id: "suite-summary-loaded",
      status: "PASS",
      detail: "Suite proof summary must be present with suite identity and mission count."
    },
    {
      id: "suite-fail-to-pass",
      status: "PASS",
      detail: "Every mission in the suite must demonstrate NOT READY -> READY."
    }
  ]
} as const;

const certificationIndex = {
  status: "FAIL",
  source: "splunkready-certification-index",
  mutation: false,
  generatedAt: "2026-06-01T07:30:00.000Z",
  proofDirs: ["artifacts/mcp-transcript-pass", "artifacts/suite-proof"],
  totals: {
    proofs: 2,
    ready: 1,
    notReady: 1,
    pass: 1,
    warn: 0,
    fail: 1
  },
  entries: [
    {
      label: "External MCP Agent",
      proofDir: "artifacts/mcp-transcript-pass",
      proofType: "external-trace",
      status: "PASS",
      manifestStatus: "PASS",
      mode: "fixture",
      mutation: false,
      agent: { name: "External MCP Agent", version: "jsonrpc-pass-001" },
      receipt: {
        id: "receipt-external-001",
        verdict: "READY",
        score: 100,
        violations: 0,
        evidenceRefs: 6
      },
      missions: ["mission-security-lateral-movement-readiness"],
      domains: ["security"],
      proofLoop: "ready-without-patch",
      hostedModelStatus: "not-applicable",
      manifest: {
        aggregateSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        files: 12
      },
      href: "?artifacts=artifacts%2Fmcp-transcript-pass#receipt"
    },
    {
      label: "Phase Live multi-mission readiness proof",
      proofDir: "artifacts/suite-proof",
      proofType: "suite",
      status: "FAIL",
      manifestStatus: "UNVERIFIED",
      mode: "fixture",
      mutation: false,
      agent: { name: "Phase Live multi-mission readiness proof", version: "n/a" },
      receipt: null,
      missions: [
        "mission-security-lateral-movement-readiness",
        "mission-security-exfiltration-readiness",
        "mission-observability-latency-readiness"
      ],
      domains: ["observability", "security"],
      proofLoop: "fail-to-pass",
      manifest: {
        aggregateSha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        files: 38
      },
      href: "?artifacts=artifacts%2Fsuite-proof#receipt"
    }
  ]
} as const;

const jsonResponse = (value: unknown): Response => new Response(JSON.stringify(value), { status: 200 });

const htmlResponse = (): Response => new Response("<!doctype html><div id=\"app\"></div>", {
  status: 200,
  headers: { "content-type": "text/html; charset=utf-8" }
});

const fetcherFor = (files: Record<string, unknown>) => async (url: string): Promise<Response> => {
  const fileName = decodeURIComponent(url.split("/").at(-1) ?? "");
  const value = files[fileName];

  return value === undefined ? new Response("not found", { status: 404 }) : jsonResponse(value);
};

const sidebarHtml = (html: string): string => html.match(/<aside class="side-rail">[\s\S]*?<\/aside>/)?.[0] ?? "";

describe("Vite UI artifact app", () => {
  it("normalizes artifact base URLs and preserves file names", () => {
    expect(normalizeArtifactBase(undefined)).toBe("/__splunkready_artifacts/");
    expect(normalizeArtifactBase("/custom")).toBe("/custom/");
    expect(normalizeArtifactBase("artifacts/live-security-ui")).toBe("artifacts/live-security-ui/");
    expect(normalizeArtifactBase("https://example.test/artifacts")).toBe("/__splunkready_artifacts/");
    expect(normalizeArtifactBase("//example.test/artifacts")).toBe("/__splunkready_artifacts/");
    expect(normalizeArtifactBase("data:application/json,{}")).toBe("/__splunkready_artifacts/");
    expect(defaultArtifactOptions.map((option) => option.path)).toContain("artifacts/live-security-ui");
    expect(defaultArtifactOptions.map((option) => option.path)).toContain("artifacts/certification-index");
    expect(defaultArtifactOptions.map((option) => option.path)).toContain("artifacts/suite-proof");
    expect(defaultArtifactOptions.map((option) => option.path)).toContain("artifacts/judge-proof");
    expect(defaultArtifactOptions.map((option) => option.path)).toContain("artifacts/mcp-proof");
    expect(defaultArtifactOptions.map((option) => option.path)).toContain("artifacts/mcp-transcript");
    expect(artifactUrl("/custom", "receipt-after-001.json")).toBe("/custom/receipt-after-001.json");
    expect(artifactUrl("artifacts/live-security-ui", "receipt-after-001.json")).toBe(
      "artifacts/live-security-ui/receipt-after-001.json"
    );
    expect(artifactBaseFromLocation({ search: "?artifacts=https%3A%2F%2Fexample.test%2Fproof" })).toBe(
      "/__splunkready_artifacts/"
    );
  });

  it("loads and summarizes schema-backed artifacts from a configurable base", async () => {
    const bundle = await loadUiArtifactBundle(
      "/artifact-base",
      fetcherFor({
        "environment-contract.json": contract,
        "missions.json": [mission],
        "receipt-before-001.json": receipt({ id: "receipt-before-001", verdict: "NOT READY", score: 0, violations: [violation.id] }),
        "receipt-after-001.json": receipt({}),
        "policy-patch.json": policyPatch,
        "trace-before.json": beforeTrace,
        "trace-after.json": afterTrace,
        "violations-before.json": [violation],
        "violations-after.json": []
      })
    );

    expect(bundle.artifactBase).toBe("/artifact-base/");
    expect(bundle.receipt?.verdict).toBe("READY");
    expect(bundle.policyPatch?.splAssistance).toHaveLength(1);
    expect(bundle.beforeTrace[0]?.toolName).toBe("splunk_run_query");
    expect(bundle.afterTrace[0]?.toolName).toBe("splunk_run_saved_search");
  });

  it("treats static-host SPA fallback HTML as missing optional artifacts", async () => {
    const bundle = await loadUiArtifactBundle("artifacts/mcp-proof", async (url) => {
      const fileName = decodeURIComponent(url.split("/").at(-1) ?? "");

      return fileName === "mcp-proof-summary.json" ? jsonResponse(mcpProofSummary) : htmlResponse();
    });

    expect(bundle.mcpProofSummary?.status).toBe("PASS");
    expect(bundle.receipt).toBeUndefined();
    expect(bundle.missing).toContain("receipt-after-001.json");
  });

  it("uses public artifact manifests to avoid probing absent optional files", async () => {
    const requested: string[] = [];
    const bundle = await loadUiArtifactBundle("artifacts/mcp-proof", async (url) => {
      const fileName = decodeURIComponent(url.split("/").at(-1) ?? "");
      requested.push(fileName);

      if (fileName === "artifact-manifest.json") {
        return jsonResponse({
          source: "splunkready-artifact-file-manifest",
          generatedAt: "2026-06-06T00:00:00.000Z",
          files: ["mcp-proof-summary.json", "mcp-client-walkthrough.md"]
        });
      }

      return fileName === "mcp-proof-summary.json" ? jsonResponse(mcpProofSummary) : htmlResponse();
    });

    expect(bundle.mcpProofSummary?.status).toBe("PASS");
    expect(requested).toEqual(["artifact-manifest.json", "mcp-proof-summary.json"]);
    expect(bundle.missing).toEqual([]);
  });

  it("loads and renders the public judge proof LLM evidence boundary", async () => {
    const requested: string[] = [];
    const bundle = await loadUiArtifactBundle("artifacts/judge-proof", async (url) => {
      const fileName = decodeURIComponent(url.split("/").at(-1) ?? "");
      requested.push(fileName);

      if (fileName === "artifact-manifest.json") {
        return jsonResponse({
          source: "splunkready-artifact-file-manifest",
          generatedAt: "2026-06-06T00:00:00.000Z",
          files: ["judge-proof-summary.json"]
        });
      }

      return fileName === "judge-proof-summary.json" ? jsonResponse(judgeProofSummary) : htmlResponse();
    });
    const html = renderApp(bundle, "proof-browser", { artifactOptions: defaultArtifactOptions });

    expect(bundle.judgeProofSummary?.status).toBe("PASS");
    expect(bundle.judgeProofSummary?.llmEvidence.status).toBe("NOT_REQUESTED");
    expect(requested).toEqual(["artifact-manifest.json", "judge-proof-summary.json"]);
    expect(html).toContain("Judge proof");
    expect(html).toContain("trace-producer");
    expect(html).toContain("deterministic-rule-engine");
    expect(html).toContain("--include-llm-proof true");
  });

  it("loads artifact selector options from a generated UI manifest", async () => {
    const bundle = await loadUiArtifactBundle(
      "artifacts/certification-index",
      fetcherFor({
        "certification-index.json": certificationIndex,
        "ui-artifacts.json": {
          source: "splunkready-ui-artifacts",
          generatedAt: "2026-06-03T00:00:00.000Z",
          defaultArtifact: "artifacts/certification-index",
          artifacts: [
            { label: "Certification index", path: "artifacts/certification-index" },
            { label: "External MCP Agent - jsonrpc-pass-001 / PASS", path: "artifacts/mcp-transcript-pass" },
            { label: "Suite proof - fail-to-pass / PASS", path: "artifacts/suite-proof" }
          ]
        }
      })
    );
    const html = renderApp(bundle, "agent-index", { artifactOptions: bundle.artifactOptions });

    expect(bundle.artifactOptions).toEqual([
      { label: "Certification index", path: "artifacts/certification-index" },
      { label: "External MCP Agent - jsonrpc-pass-001 / PASS", path: "artifacts/mcp-transcript-pass" },
      { label: "Suite proof - fail-to-pass / PASS", path: "artifacts/suite-proof" }
    ]);
    expect(html).toContain("External MCP Agent - jsonrpc-pass-001 / PASS");
    expect(html).toContain('value="artifacts/certification-index" selected');
  });

  it("renders an artifact source selector from real proof bundle presets", async () => {
    const bundle = await loadUiArtifactBundle(
      "artifacts/live-security-ui",
      fetcherFor({
        "environment-contract.json": contract,
        "missions.json": [mission],
        "receipt-after-001.json": receipt({}),
        "trace-after.json": afterTrace,
        "violations-after.json": []
      })
    );
    const html = renderApp(bundle, "receipt", { artifactOptions: defaultArtifactOptions });

    expect(html).toContain("Artifact source");
    expect(html).toContain('data-artifact-selector');
    expect(html).toContain('value="artifacts/live-security-ui" selected');
    expect(html).toContain("LLM fixture proof");
    expect(html).toContain("Certification index");
    expect(html).toContain("MCP proof");
    expect(html).toContain("MCP transcript import");
    expect(html).toContain("Hosted model proof");
  });

  it("keeps sidebar navigation, artifact selector, and receipt footer separated", async () => {
    const bundle = await loadUiArtifactBundle(
      "artifacts/live-security-ui",
      fetcherFor({
        "environment-contract.json": contract,
        "missions.json": [mission],
        "receipt-after-001.json": receipt({}),
        "trace-after.json": afterTrace,
        "violations-after.json": []
      })
    );
    const rail = sidebarHtml(renderApp(bundle, "certification-replay", { artifactOptions: defaultArtifactOptions }));

    expect(rail).toContain("<nav aria-label=\"Views\">");
    expect(rail).toContain('class="rail-body"');
    expect(rail).toContain('class="rail-footer"');
    expect(rail).toContain('class="artifact-picker"');
    expect(rail).toContain('class="rail-receipt"');
    expect(rail.indexOf('data-view-link="live-connect"')).toBeLessThan(rail.indexOf('class="artifact-picker"'));
    expect(rail.indexOf('class="artifact-picker"')).toBeLessThan(rail.indexOf('class="rail-receipt"'));
    expect(rail).toContain("READY / 100/100");
    expect(rail).not.toContain("not loaded");
    expect(rail).not.toContain("security not loaded");
    expect(rail).not.toContain("kit not loaded");
    expect(rail).not.toContain("index not loaded");
  });

  it("loads and renders the certification index as a multi-agent proof ledger", async () => {
    const bundle = await loadUiArtifactBundle(
      "artifacts/certification-index",
      fetcherFor({
        "certification-index.json": certificationIndex
      })
    );
    const html = renderApp(bundle, "agent-index", {
      artifactOptions: defaultArtifactOptions,
      workbench: {
        available: true,
        healthStatus: "available",
        runs: [
          {
            runId: "run-proof-ready",
            artifactBase: "/api/artifacts/run-proof-ready",
            fileCount: 12,
            files: ["receipt-external-001.json", "proof-audit.json", "proof-manifest.json"],
            workflow: "external-trace-certification",
            state: "succeeded",
            verdict: "READY",
            score: 100,
            violations: 0,
            evidenceRefs: 6,
            proofAuditStatus: "PASS",
            manifestStatus: "UNVERIFIED",
            missionIds: [mission.id],
            ruleIds: [],
            createdAt: "2026-06-01T07:02:00.000Z"
          },
          {
            runId: "run-proof-fail",
            artifactBase: "/api/artifacts/run-proof-fail",
            fileCount: 13,
            files: ["receipt-external-001.json", "proof-audit.json", "proof-manifest.json"],
            workflow: "external-trace-certification",
            state: "succeeded",
            verdict: "NOT READY",
            score: 0,
            violations: 5,
            evidenceRefs: 0,
            proofAuditStatus: "FAIL",
            manifestStatus: "PASS",
            missionIds: [mission.id],
            ruleIds: ["SPL-001"],
            createdAt: "2026-06-01T07:01:00.000Z"
          },
          {
            runId: "run-kit",
            artifactBase: "/api/artifacts/run-kit",
            fileCount: 7,
            files: ["live-security-kit.json"],
            workflow: "live-security-kit",
            state: "succeeded",
            verdict: "NO RECEIPT",
            score: null,
            violations: 0,
            evidenceRefs: 0,
            proofAuditStatus: "not loaded",
            manifestStatus: "MISSING",
            missionIds: [],
            ruleIds: [],
            createdAt: "2026-06-01T07:03:00.000Z"
          }
        ]
      }
    });

    expect(bundle.certificationIndex?.totals.proofs).toBe(2);
    expect(html).toContain('data-view="agent-index"');
    expect(html).toContain('href="#agent-index"');
    expect(html).toContain('class="active">Agents</a>');
    expect(html).toContain("Agent certification index");
    expect(html).toContain("Index summary");
    expect(html).toContain("Agent proofs");
    expect(html).toContain("Generate from managed runs");
    expect(html).toContain("managed artifact run IDs only");
    expect(html).toContain("server verifies every proof manifest before indexing");
    expect(html).toContain('data-certification-index-form');
    expect(html.match(/data-index-run/g)).toHaveLength(2);
    expect(html).toContain('value="run-proof-ready" data-index-run checked');
    expect(html).toContain('value="run-proof-fail" data-index-run checked');
    expect(html).not.toContain('value="run-kit" data-index-run');
    expect(html).toContain("FAIL");
    expect(html).toContain("External MCP Agent");
    expect(html).toContain("jsonrpc-pass-001");
    expect(html).toContain("Domain / mission");
    expect(html).toContain("security");
    expect(html).toContain("mission-security-lateral-movement-readiness");
    expect(html).toContain("Phase Live multi-mission readiness proof");
    expect(html).toContain("observability / security");
    expect(html).toContain("ready-without-patch");
    expect(html).toContain("fail-to-pass");
    expect(html).toContain("UNVERIFIED");
    expect(html).toContain("12 files");
    expect(html).toContain("aaaaaaaaaaaa");
    expect(html).toContain("?artifacts=artifacts%2Fmcp-transcript-pass#receipt");
    expect(html).toContain("?artifacts=artifacts%2Fmcp-transcript-pass#trace-timeline");
    expect(html).toContain('data-proof-artifact="artifacts/mcp-transcript-pass"');
    expect(html).toContain('data-proof-view="receipt"');
    expect(html).toContain('data-proof-view="trace-timeline"');
    expect(html).toContain("artifacts/suite-proof");
    expect(html).toContain("fail 2 proof index");
    expect(html).not.toContain("Artifact bundle incomplete");
  });

  it("loads and renders imported MCP transcript artifacts for external agents", async () => {
    const bundle = await loadUiArtifactBundle(
      "artifacts/mcp-transcript",
      fetcherFor({
        "environment-contract.json": contract,
        "missions.json": [mission],
        "readiness-profile.json": readinessProfile,
        "receipt-external-001.json": receipt({
          id: "receipt-external-001",
          agent: { name: "External MCP Transcript Agent", version: "jsonrpc-smoke-001" },
          verdict: "NOT READY",
          score: 0,
          passedMissions: [],
          failedMissions: [mission.id],
          criticalViolations: [externalViolation.id],
          violations: [externalViolation.id],
          traceRefs: importedMcpTrace.map((event) => event.id),
          evidenceRefs: []
        }),
        "trace-imported.json": importedMcpTrace,
        "trace-external.json": importedMcpTrace,
        "violations-external.json": [externalViolation],
        "mcp-transcript-import.json": mcpTranscriptImport
      })
    );
    const receiptHtml = renderApp(bundle, "receipt", { artifactOptions: defaultArtifactOptions });
    const traceHtml = renderApp(bundle, "trace-timeline", { artifactOptions: defaultArtifactOptions });

    expect(bundle.receipt?.id).toBe("receipt-external-001");
    expect(bundle.externalReceipt?.agent.name).toBe("External MCP Transcript Agent");
    expect(bundle.mcpTranscriptImport?.strictImport).toBe(true);
    expect(receiptHtml).toContain("External agent receipt");
    expect(receiptHtml).toContain("External MCP Transcript Agent jsonrpc-smoke-001");
    expect(receiptHtml).toContain("MCP transcript import");
    expect(receiptHtml).toContain("Strict import");
    expect(receiptHtml).toContain("<td>yes</td>");
    expect(receiptHtml).toContain("Unmatched tool calls");
    expect(receiptHtml).toContain("mcp import strict");
    expect(receiptHtml).not.toContain("Artifact bundle incomplete");
    expect(traceHtml).toContain("External graded trace");
    expect(traceHtml).toContain("mission-security-lateral-movement-readiness-imported-trace-001");
    expect(traceHtml).toContain("search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now");
    expect(traceHtml).toContain("SPL-001");
    expect(traceHtml).toContain("examples/sample-mcp-transcript.jsonl");
    expect(traceHtml).toContain("artifacts/mcp-transcript/trace-imported.json");
    expect(traceHtml).not.toContain("Artifact bundle incomplete");
  });

  it("loads and renders MCP proof summary as a first-class certification loop", async () => {
    const bundle = await loadUiArtifactBundle(
      "artifacts/mcp-proof",
      fetcherFor({
        "mcp-proof-summary.json": mcpProofSummary
      })
    );
    const html = renderApp(bundle, "mcp-proof", { artifactOptions: defaultArtifactOptions });

    expect(bundle.mcpProofSummary?.status).toBe("PASS");
    expect(html).toContain('data-view="mcp-proof"');
    expect(html).toContain('class="active">MCP</a>');
    expect(html).toContain("MCP proof");
    expect(html).toContain("Certification loop");
    expect(html).toContain("MCP composition scorecard");
    expect(html).toContain("Official Splunk MCP tool coverage");
    expect(html).toContain("MCP client session");
    expect(html).toContain("dual-server-client-config: PASS");
    expect(html).toContain("external-mcp-client-configs: PASS");
    expect(html).toContain("existing-splunk-mcp-boundary: PASS");
    expect(html).toContain("official-splunk-mcp-tool-coverage: PASS");
    expect(html).toContain("mission-scoped-tool-boundary: PASS");
    expect(html).toContain("splunk_get_info");
    expect(html).toContain("splunk: Existing Splunk MCP server");
    expect(html).toContain("splunkready://client-config/claude-desktop");
    expect(html).toContain("splunkready://client-config/cursor");
    expect(html).toContain("splunkready://workflows/splunk-mcp-certification-loop");
    expect(html).toContain("splunkready://workflows/hosted-model-diagnostic");
    expect(html).toContain("splunkready://receipts/{receiptId}");
    expect(html).toContain("splunkready://receipts/pass");
    expect(html).toContain("splunkready_splunk_mcp_certification_loop");
    expect(html).toContain("splunkready_hosted_model_diagnostic");
    expect(html).toContain("splunkready_certify_mcp_transcript");
    expect(html).toContain("splunkready_certify_mcp_transcript_content");
    expect(html).toContain("splunkready_check_hosted_model_access");
    expect(html).toContain("Inline transcript certification");
    expect(html).toContain("submission-evidence/mcp-proof/mcp-inline-transcript-certification");
    expect(html).toContain("Hosted-model access");
    expect(html).toContain("Hosted-model blocker");
    expect(html).toContain("Hosted-model permission blocker");
    expect(html).toContain("Hosted-model remediation");
    expect(html).toContain("No hosted-model remediation is required.");
    expect(html).toContain("Hosted-model passed tools");
    expect(html).toContain("Hosted-model tool results");
    expect(html).toContain("saia_generate_spl:PASS");
    expect(html).toContain("saia_ask_splunk_question:PASS");
    expect(html).toContain("submission-evidence/mcp-proof/mcp-hosted-model-access");
    expect(html).toContain("resources/read");
    expect(html).toContain("resources/templates/list");
    expect(html).toContain("prompts/get");
    expect(html).toContain("tools/call");
    expect(html).toContain("submission-evidence/mcp-proof/mcp-client-session.jsonl");
    expect(html).toContain("splunk_get_knowledge_objects / splunk_run_saved_search");
    expect(html).toContain("Saved-search execution");
    expect(html).toContain("evt-102 / evt-118 / evt-141");
    expect(html).toContain("Deterministic");
    expect(html).toContain("mcp proof pass 5 tools");
    expect(html).toContain("<td>no</td>");
    expect(html).not.toContain("Artifact bundle incomplete");
  });

  it("renders a multi-mission suite proof ledger from artifact data", async () => {
    const bundle = await loadUiArtifactBundle(
      "artifacts/suite-proof",
      fetcherFor({
        "suite-proof-summary.json": suiteProofSummary,
        "proof-audit.json": suiteProofAudit
      })
    );
    const html = renderApp(bundle, "suite-proof", { artifactOptions: defaultArtifactOptions });

    expect(bundle.suiteProofSummary?.missionCount).toBe(3);
    expect(html).toContain('data-view="suite-proof"');
    expect(html).toContain('href="#suite-proof"');
    expect(html).toContain('class="active">Suite</a>');
    expect(html).toContain("Suite proof");
    expect(html).toContain("Suite summary");
    expect(html).toContain("Proof audit");
    expect(html).toContain("suite-summary-loaded / PASS");
    expect(html).toContain("suite-fail-to-pass / PASS");
    expect(html).toContain("Phase Live multi-mission readiness proof");
    expect(html).toContain("fixtures/acme-soc-dev/suites/phase-live-readiness-suite.json");
    expect(html).toContain("Mission ledger");
    expect(html).toContain("phase-live-multi-mission-proof");
    expect(html).toContain("mission-security-lateral-movement-readiness");
    expect(html).toContain("mission-security-exfiltration-readiness");
    expect(html).toContain("mission-observability-latency-readiness");
    expect(html).toContain("observability / security");
    expect(html).toContain("fail-to-pass");
    expect(html).toContain("<tr><th>Status</th><td>PASS</td></tr>");
    expect(html).toContain("<tr><th>Missions</th><td>3</td></tr>");
    expect(html).toContain("<tr><th>Proof type</th><td>suite</td></tr>");
    expect(html).toContain("artifacts/suite-proof/mission-observability-latency-readiness");
    expect(html).not.toContain("Artifact bundle incomplete");
  });

  it("renders one active app pane with SAIA-backed patch evidence", async () => {
    const bundle = await loadUiArtifactBundle(
      "/artifact-base",
      fetcherFor({
        "environment-contract.json": contract,
        "missions.json": [mission],
        "receipt-before-001.json": receipt({ id: "receipt-before-001", verdict: "NOT READY", score: 0, violations: [violation.id] }),
        "receipt-after-001.json": receipt({}),
        "policy-patch.json": policyPatch,
        "trace-before.json": beforeTrace,
        "trace-after.json": afterTrace,
        "violations-before.json": [violation],
        "violations-after.json": []
      })
    );
    const replay = renderApp(bundle, "certification-replay");
    const trace = renderApp(bundle, "trace-timeline");

    expect(replay).toContain('data-view="certification-replay"');
    expect(replay).not.toContain('data-view="trace-timeline"');
    expect(replay).toContain("SAIA Explanation:");
    expect(replay).toContain("SAIA Optimized Query:");
    expect(trace).toContain('data-view="trace-timeline"');
    expect(trace).not.toContain('data-view="certification-replay"');
    expect(trace).toContain("SPL-001");
    expect(trace).toContain("Before SPL");
    expect(trace).toContain("SAIA recommended SPL");
    expect(trace).toContain("search index=wineventlog host=win-finance-07 src=* earliest=-24h latest=now");
  });

  it("renders executable fixture certification job states from workbench data", async () => {
    const bundle = await loadUiArtifactBundle(
      "/artifact-base",
      fetcherFor({
        "environment-contract.json": contract,
        "missions.json": [mission],
        "receipt-before-001.json": receipt({ id: "receipt-before-001", verdict: "NOT READY", score: 0, violations: [violation.id] }),
        "receipt-after-001.json": receipt({}),
        "policy-patch.json": policyPatch,
        "trace-before.json": beforeTrace,
        "trace-after.json": afterTrace,
        "violations-before.json": [violation],
        "violations-after.json": []
      })
    );
    const idle = renderApp(bundle, "certification-replay", {
      workbench: { available: true, healthStatus: "available" }
    });
    const running = renderApp(bundle, "certification-replay", {
      workbench: {
        available: true,
        healthStatus: "available",
        job: {
          id: "job-1",
          state: "running",
          runId: "run-001",
          artifactBase: "/api/artifacts/run-001",
          events: [{ id: 1, type: "phase", message: "Running Agent Readiness Compiler fixture certification." }]
        }
      }
    });
    const failed = renderApp(bundle, "certification-replay", {
      workbench: {
        available: true,
        healthStatus: "available",
        job: {
          id: "job-2",
          state: "failed",
          runId: "run-002",
          artifactBase: "/api/artifacts/run-002",
          error: "TOKEN=[REDACTED] failed",
          events: [{ id: 1, type: "error", message: "TOKEN=[REDACTED] failed" }]
        }
      }
    });

    expect(idle).toContain("Fixture certification run");
    expect(idle).toContain("Run fixture certification");
    expect(idle).toContain("Start a server-owned fixture certification");
    expect(running).toContain("job-1 / running");
    expect(running).toContain("Running Agent Readiness Compiler fixture certification.");
    expect(running).toContain("disabled");
    expect(failed).toContain("job-2 / failed");
    expect(failed).toContain("TOKEN=[REDACTED] failed");
    expect(failed).not.toContain("secret-value");
  });

  it("renders server-owned live action states without browser credential inputs", async () => {
    const bundle = await loadUiArtifactBundle(
      "/artifact-base",
      fetcherFor({
        "live-smoke-contract.json": { ...contract, mode: "live" },
        "live-security-readiness.json": liveSecurityReadiness
      })
    );
    const unavailable = renderApp(bundle, "live-connect", {
      workbench: {
        available: true,
        healthStatus: "available",
        liveAvailable: false,
        liveMissing: ["SPLUNKREADY_LIVE_ENABLED=true", "SPLUNKREADY_SPLUNK_MCP_URL", "SPLUNKREADY_SPLUNK_MCP_TOKEN"]
      }
    });
    const running = renderApp(bundle, "live-connect", {
      workbench: {
        available: true,
        healthStatus: "available",
        liveAvailable: true,
        saiaAvailable: true,
        liveMissing: [],
        job: {
          id: "job-live-1",
          workflow: "live-smoke",
          state: "running",
          runId: "run-live-001",
          artifactBase: "/api/artifacts/run-live-001",
          events: [{ id: 1, type: "phase", message: "Running Agent Readiness Compiler live smoke." }]
        }
      }
    });

    expect(unavailable).toContain("Live workbench actions");
    expect(unavailable).toContain("Live mode unavailable for live checks");
    expect(unavailable).toContain("local operator kit can still be generated without credentials");
    expect(unavailable).toContain("SPLUNKREADY_SPLUNK_MCP_URL");
    expect(unavailable).toContain('data-run-workflow="live-security-kit" >');
    expect(unavailable).toContain("Run live smoke");
    expect(unavailable).toContain("Scan saved searches");
    expect(unavailable).toContain("Check security readiness");
    expect(unavailable).toContain("Run security proof");
    expect(unavailable).toContain("Check SAIA entitlement");
    expect(unavailable).toContain("Run hosted-model proof");
    expect(unavailable).toContain("SAIA authority</th><td>advisory only");
    expect(unavailable).toContain("disabled");
    expect(unavailable).toContain("Browser credentials</th><td>not accepted");
    expect(unavailable).not.toContain("<input");
    expect(unavailable).not.toContain("type=\"password\"");
    expect(unavailable).not.toContain("name=\"token\"");
    expect(running).toContain("job-live-1 / live-smoke / running");
    expect(running).toContain("Running Agent Readiness Compiler live smoke.");
    expect(running).toContain("SAIA</th><td>available");

    const blocked = renderApp(bundle, "live-connect", {
      workbench: {
        available: true,
        healthStatus: "available",
        liveAvailable: true,
        saiaAvailable: false,
        liveMissing: []
      }
    });

    expect(blocked).toContain("SAIA</th><td>not confirmed; diagnostic may return BLOCKED");
    expect(blocked).toContain("Check SAIA entitlement");
    expect(blocked).toContain("Call hosted-model helper tools only; report PASS or BLOCKED.");
    expect(blocked).toContain("Run hosted-model proof");
    expect(blocked).not.toContain("type=\"password\"");
  });

  it("renders external import certification forms with explicit trust boundaries", async () => {
    const bundle = await loadUiArtifactBundle(
      "/artifact-base",
      fetcherFor({
        "environment-contract.json": contract,
        "missions.json": [mission],
        "receipt-external-001.json": receipt({
          id: "receipt-external-001",
          agent: { name: "Uploaded Trace Agent", version: "sample-pass" },
          verdict: "READY",
          score: 100
        }),
        "trace-external.json": afterTrace,
        "violations-external.json": []
      })
    );
    const html = renderApp(bundle, "import-certification", {
      workbench: {
        available: true,
        healthStatus: "available",
        job: {
          id: "job-import-1",
          workflow: "external-trace-certification",
          state: "succeeded",
          runId: "run-import-001",
          artifactBase: "/api/artifacts/run-import-001",
          inputSummary: "3 trace event(s); requirePass=false",
          events: [{ id: 1, type: "complete", message: "external trace certification completed." }]
        }
      }
    });

    expect(html).toContain('data-view="import-certification"');
    expect(html).toContain('class="active">Import</a>');
    expect(html).toContain("External trace");
    expect(html).toContain("MCP transcript");
    expect(html).toContain('data-external-trace-form');
    expect(html).toContain('data-mcp-transcript-form');
    expect(html).toContain("producer-supplied canonical TraceEvent array");
    expect(html).toContain("read-only Splunk MCP JSON-RPC transcript");
    expect(html).toContain("checks transcript structure, not independent readiness");
    expect(html).toContain("producer-provided and appended server-side");
    expect(html).toContain("Mutation</th><td>false");
    expect(html).toContain("job-import-1 / external-trace-certification / succeeded");
    expect(html).toContain("3 trace event(s); requirePass=false");
    expect(html).toContain("Receipt</th><td>receipt-external-001");
    expect(html).not.toContain("SDK");
  });

  it("renders live proof summaries without implying a fake patch loop", async () => {
    const bundle = await loadUiArtifactBundle(
      "/artifact-base",
      fetcherFor({
        "environment-contract.json": { ...contract, mode: "live" },
        "missions.json": [mission],
        "receipt-before-001.json": receipt({ id: "receipt-before-001", mode: "live", verdict: "READY", score: 100, violations: [] }),
        "receipt-after-001.json": receipt({ mode: "live" }),
        "live-proof-summary.json": liveProofSummary,
        "live-security-proof-summary.json": liveSecurityProofSummary,
        "live-security-readiness.json": liveSecurityReadiness,
        "live-security-kit.json": liveSecurityKit,
        "hosted-model-proof.json": hostedModelProof,
        "hosted-model-diagnostic.json": hostedModelDiagnostic,
        "proof-audit.json": proofAudit,
        "trace-before.json": beforeTrace,
        "trace-after.json": afterTrace,
        "violations-before.json": [],
        "violations-after.json": []
      })
    );
    const replay = renderApp(bundle, "certification-replay");
    const liveConnect = renderApp(bundle, "live-connect");

    expect(replay).toContain("ready-without-patch");
    expect(replay).toContain("Certify");
    expect(replay).toContain("not needed");
    expect(replay).toContain("No policy patch was exported because the live-derived mission was READY before policy injection.");
    expect(replay).toContain("Live proof summary");
    expect(replay).toContain("mission-live-internal-query-readiness");
    expect(liveConnect).toContain("Proof loop");
    expect(liveConnect).toContain("ready-without-patch");
    expect(liveConnect).toContain("Ready without patch");
    expect(liveConnect).toContain("internal-query-fallback");
    expect(liveConnect).toContain("Flagship security proof");
    expect(liveConnect).toContain("READY_FOR_FLAGSHIP_LIVE_SECURITY_PROOF");
    expect(liveConnect).toContain("fail-to-pass");
    expect(liveConnect).toContain("saved_searches:SplunkEnterpriseSecuritySuite:ES - Lateral Movement Auth Chain");
    expect(liveConnect).toContain("Flagship security readiness");
    expect(liveConnect).toContain("BLOCKED");
    expect(liveConnect).toContain("strict-flagship-security / fallback blocked");
    expect(liveConnect).toContain("saved-search: missing");
    expect(liveConnect).toContain("operator-owned-setup: ready");
    expect(liveConnect).toContain("live-proof / Use live-proof only as generic live MCP evidence");
    expect(liveConnect).toContain("SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain / missing");
    expect(liveConnect).toContain("wineventlog / missing");
    expect(liveConnect).toContain('data-run-workflow="live-security-kit"');
    expect(liveConnect).toContain("Generate operator kit");
    expect(liveConnect).toContain("local generation; no live credentials required");
    expect(liveConnect).toContain("Operator security kit");
    expect(liveConnect).toContain("Validation");
    expect(liveConnect).toContain("PASS / 0 failed check(s)");
    expect(liveConnect).toContain("Validation checks");
    expect(liveConnect).toContain("saved-search-stanza");
    expect(liveConnect).toContain("sample-event-refs");
    expect(liveConnect).toContain("Operator warnings");
    expect(liveConnect).toContain("no Splunk write operation");
    expect(liveConnect).toContain("do not overwrite");
    expect(liveConnect).toContain("Cleanup guidance");
    expect(liveConnect).toContain("Cleanup is operator-owned");
    expect(liveConnect).toContain("SplunkReady write operations");
    expect(liveConnect).toContain("<td>none</td>");
    expect(liveConnect).toContain("Operator action");
    expect(liveConnect).toContain("required");
    expect(liveConnect).toContain("Hosted model assistance");
    expect(liveConnect).toContain("saia_generate_spl / saia_explain_spl / saia_optimize_spl / saia_ask_splunk_question");
    expect(liveConnect).toContain("advisory only; deterministic grader decides pass/fail");
    expect(liveConnect).toContain("Hosted model diagnostic");
    expect(liveConnect).toContain("hosted-model-status / PASS");
    expect(liveConnect).toContain("Permission");
    expect(liveConnect).toContain("OK");
    expect(liveConnect).toContain("Remediation");
    expect(liveConnect).toContain("No hosted-model remediation is required.");
    expect(liveConnect).toContain("--env-file &lt;operator-env-file&gt;");
    expect(liveConnect).toContain("deterministic-rule-engine");
    expect(liveConnect).toContain("Hosted model proof");
    expect(liveConnect).toContain("Live setup");
    expect(liveConnect).toContain("configured");
    expect(liveConnect).toContain("SPLUNKREADY_SPLUNK_MCP_TOKEN:set");
    expect(liveConnect).toContain("Secret values are never written.");
    expect(liveConnect).toContain("Proof audit");
    expect(liveConnect).toContain("live-security");
    expect(liveConnect).toContain("fail-to-pass / PASS");
    expect(liveConnect).toContain("Warnings or failures");
    expect(liveConnect).toContain("Hosted models");
    expect(liveConnect).toContain("invoked");
    expect(liveConnect).toContain("Before SPL");
    expect(liveConnect).toContain("SAIA recommended SPL");
    expect(liveConnect).toContain("| savedsearch &quot;ES - Lateral Movement Auth Chain&quot;");
    expect(liveConnect).toContain("Mutation");
    expect(liveConnect).toContain("no");
    expect(liveConnect).toContain("artifacts/live-security-kit/SplunkEnterpriseSecuritySuite/default/savedsearches.conf");
  });

  it("loads live proof summaries that predate proof-loop artifacts", async () => {
    const { proofLoop: _liveProofLoop, ...legacyLiveProofSummary } = liveProofSummary;
    const { proofLoop: _securityProofLoop, ...legacySecurityProofSummary } = liveSecurityProofSummary;
    const bundle = await loadUiArtifactBundle(
      "/artifact-base",
      fetcherFor({
        "environment-contract.json": { ...contract, mode: "live" },
        "missions.json": [mission],
        "receipt-before-001.json": receipt({ id: "receipt-before-001", mode: "live", verdict: "READY", score: 100, violations: [] }),
        "receipt-after-001.json": receipt({ mode: "live" }),
        "live-proof-summary.json": legacyLiveProofSummary,
        "live-security-proof-summary.json": legacySecurityProofSummary,
        "trace-before.json": beforeTrace,
        "trace-after.json": afterTrace,
        "violations-before.json": [],
        "violations-after.json": []
      })
    );
    const liveConnect = renderApp(bundle, "live-connect");

    expect(bundle.liveProofSummary?.proofLoop).toBe("ready-without-patch");
    expect(bundle.liveSecurityProofSummary?.proofLoop).toBe("fail-to-pass");
    expect(liveConnect).toContain("ready-without-patch");
    expect(liveConnect).toContain("fail-to-pass");
  });

  it("renders firewall block bundles as pre-execution proof", async () => {
    const bundle = await loadUiArtifactBundle(
      "/artifact-base",
      fetcherFor({
        "environment-contract.json": contract,
        "firewall-block-before.json": firewallBlock,
        "proof-audit.json": firewallProofAudit
      })
    );
    const receipt = renderApp(bundle, "receipt");
    const liveConnect = renderApp(bundle, "live-connect");

    expect(bundle.firewallBlock?.code).toBe("FIREWALL_POLICY_BLOCKED");
    expect(receipt).toContain("Firewall block");
    expect(receipt).toContain("BLOCKED");
    expect(receipt).toContain("Blocked before Splunk");
    expect(receipt).toContain("SPL-001 / SPL-003");
    expect(receipt).toContain("firewall-block");
    expect(receipt).not.toContain("Artifact bundle incomplete");
    expect(liveConnect).toContain("Firewall block");
    expect(liveConnect).toContain("Query uses index=* and would search every index.");
    expect(liveConnect).toContain("<tr><th>Phase</th><td>before</td></tr>");
    expect(liveConnect).toContain("<tr><th>Tool</th><td>splunk_run_query</td></tr>");
    expect(liveConnect).toContain("firewall-block-before-splunk / PASS");
  });

  it("renders policy patch and firewall controls as a receipt-grounded safety loop", async () => {
    const bundle = await loadUiArtifactBundle(
      "/artifact-base",
      fetcherFor({
        "environment-contract.json": contract,
        "missions.json": [mission],
        "receipt-before-001.json": receipt({
          id: "receipt-before-001",
          verdict: "NOT READY",
          score: 0,
          violations: [violation.id],
          evidenceRefs: []
        }),
        "receipt-after-001.json": receipt({}),
        "policy-patch.json": policyPatch,
        "trace-before.json": beforeTrace,
        "trace-after.json": afterTrace,
        "violations-before.json": [violation],
        "violations-after.json": [],
        "firewall-block-before.json": firewallBlock,
        "proof-audit.json": firewallProofAudit
      })
    );
    const html = renderApp(bundle, "policy-firewall", {
      workbench: { available: true, healthStatus: "available" }
    });

    expect(html).toContain('data-view="policy-firewall"');
    expect(html).toContain('class="active">Policy</a>');
    expect(html).toContain("Policy workbench");
    expect(html).toContain('data-run-workflow="policy-backed-rerun"');
    expect(html).toContain('data-run-workflow="firewall-check"');
    expect(html).toContain("exported additions for human review");
    expect(html).toContain("pre-execution Splunk tool gate");
    expect(html).toContain("NOT READY / 0");
    expect(html).toContain("READY / 100");
    expect(html).toContain("receipt artifacts");
    expect(html).toContain("UI recalculation</th><td>none");
    expect(html).toContain("Exported policy additions");
    expect(html).toContain("Splunk apply action</th><td>none");
    expect(html).toContain("inject-contract-summary");
    expect(html).toContain("violation-spl-001");
    expect(html).toContain("SPL-001");
    expect(html).toContain("trace-before-call");
    expect(html).toContain("Query contains a forbidden SPL pattern.");
    expect(html).toContain("SAIA optimized SPL");
    expect(html).toContain("search index=wineventlog host=win-finance-07 src=* earliest=-24h latest=now");
    expect(html).toContain("Firewall block");
    expect(html).toContain("Blocked before Splunk");
    expect(html).toContain("Mutation</th><td>no");
    expect(html).toContain("firewall-block-before-splunk / PASS");
  });

  it("shows an actionable warning when proof artifacts are missing from the UI bundle", async () => {
    const bundle = await loadUiArtifactBundle(
      "/artifact-base",
      fetcherFor({
        "environment-contract.json": { ...contract, mode: "live" },
        "live-security-readiness.json": liveSecurityReadiness,
        "live-security-kit.json": liveSecurityKit
      })
    );
    const receipt = renderApp(bundle, "receipt");
    const trace = renderApp(bundle, "trace-timeline");
    const liveConnect = renderApp(bundle, "live-connect");

    expect(receipt).toContain("Artifact bundle incomplete");
    expect(receipt).toContain("Receipt loaded");
    expect(receipt).toContain("Trace loaded");
    expect(receipt).toContain("live-security-ui-bundle");
    expect(trace).toContain("Artifact bundle incomplete");
    expect(liveConnect).not.toContain("Artifact bundle incomplete");
  });

  it("keeps receipt sections inside a single aligned ledger", async () => {
    const bundle = await loadUiArtifactBundle(
      "/artifact-base",
      fetcherFor({
        "environment-contract.json": { ...contract, mode: "live" },
        "missions.json": [mission],
        "receipt-before-001.json": receipt({ id: "receipt-before-001", mode: "live", verdict: "READY", score: 100, violations: [] }),
        "receipt-after-001.json": receipt({ mode: "live" }),
        "live-proof-summary.json": liveProofSummary,
        "trace-before.json": beforeTrace,
        "trace-after.json": afterTrace,
        "violations-before.json": [],
        "violations-after.json": []
      })
    );
    const receiptHtml = renderApp(bundle, "receipt");

    expect(receiptHtml).toContain('class="panel receipt-book"');
    expect(receiptHtml.match(/class="receipt-book-section"/g)).toHaveLength(4);
    expect(receiptHtml).not.toContain("Artifact bundle incomplete");
    expect(receiptHtml).not.toContain("receipt-book-grid");
    expect(receiptHtml).not.toContain("receipt-slot");
  });

  it("renders security readiness in the receipt when proof summaries are not present", async () => {
    const bundle = await loadUiArtifactBundle(
      "/artifact-base",
      fetcherFor({
        "environment-contract.json": { ...contract, mode: "live" },
        "missions.json": [mission],
        "receipt-before-001.json": receipt({ id: "receipt-before-001", mode: "live", verdict: "NOT READY", score: 60, violations: [violation.id] }),
        "receipt-after-001.json": receipt({ mode: "live", verdict: "NOT READY", score: 60, violations: [violation.id] }),
        "live-security-readiness.json": liveSecurityReadiness,
        "trace-before.json": beforeTrace,
        "trace-after.json": afterTrace,
        "violations-before.json": [violation],
        "violations-after.json": [violation]
      })
    );
    const receiptHtml = renderApp(bundle, "receipt");

    expect(receiptHtml).toContain("Flagship security readiness");
    expect(receiptHtml).toContain("Exact flagship saved search is not present in the live contract.");
    expect(receiptHtml).not.toContain("Live proof summary artifact not loaded.");
  });

  it("renders a receipt-grounded policy simulator from readiness profile rules", async () => {
    const bundle = await loadUiArtifactBundle(
      "/artifact-base",
      fetcherFor({
        "environment-contract.json": contract,
        "missions.json": [mission],
        "readiness-profile.json": readinessProfile,
        "receipt-before-001.json": receipt({
          id: "receipt-before-001",
          verdict: "NOT READY",
          score: 60,
          violations: [violation.id, koViolation.id],
          criticalViolations: [violation.id]
        }),
        "receipt-after-001.json": receipt({}),
        "trace-before.json": beforeTrace,
        "trace-after.json": afterTrace,
        "violations-before.json": [violation, koViolation],
        "violations-after.json": []
      })
    );
    const initial = renderApp(bundle, "receipt");
    const withoutCritical = renderApp(bundle, "receipt", { disabledRuleIds: new Set(["SPL-001"]) });
    const withoutCriticalOrHigh = renderApp(bundle, "receipt", { disabledRuleIds: new Set(["SPL-001", "KO-001"]) });

    expect(initial).toContain('id="policy-simulator"');
    expect(initial).toContain('data-policy-rule="SPL-001" checked');
    expect(initial).toContain('data-policy-rule="KO-001" checked');
    expect(initial).toContain('data-policy-rule="EVD-001" checked');
    expect(initial).toContain("NOT READY (SIMULATED)");
    expect(initial).toContain("<td>60</td>");
    expect(withoutCritical).toContain('data-policy-rule="SPL-001" >');
    expect(withoutCritical).toContain("NOT READY (SIMULATED)");
    expect(withoutCritical).toContain("<td>85</td>");
    expect(withoutCriticalOrHigh).toContain("READY (SIMULATED)");
    expect(withoutCriticalOrHigh).toContain("<td>100</td>");
    expect(withoutCriticalOrHigh).toContain("deterministic-rule-engine");
  });

  it("renders proof bundle browser filters, run summaries, receipt diff, trace timeline, and manifest audit", async () => {
    const runAfterCall: TraceEvent = { ...afterTrace[0], step: 1 };
    const runAfterResult: TraceEvent = {
      ...afterTrace[0],
      id: "trace-after-result",
      type: "tool_result",
      parentId: "trace-after-call",
      toolOutputSummary: "Saved search returned 3 row(s).",
      resultCount: 3,
      step: 2
    };
    const runAfterEnrichment: TraceEvent = {
      ...afterTrace[0],
      id: "trace-after-enrichment",
      toolName: "splunk_get_knowledge_objects",
      toolInput: { name: "ES - Lateral Movement Auth Chain" },
      evidenceRefs: [],
      step: 3
    };
    const runAfterFinal: TraceEvent = {
      ...afterTrace[0],
      id: "trace-after-final",
      type: "final_answer",
      toolName: null,
      toolInput: null,
      toolOutputSummary: "Evidence supports the investigation.",
      resultCount: 3,
      parentId: "trace-after-result",
      step: 4
    };
    const runAfterTrace: TraceEvent[] = [runAfterResult, runAfterFinal, runAfterEnrichment, runAfterCall];
    const bundle = await loadUiArtifactBundle(
      "/api/artifacts/run-after",
      fetcherFor({
        "environment-contract.json": contract,
        "missions.json": [mission],
        "receipt-before-001.json": receipt({
          id: "receipt-before-001",
          verdict: "NOT READY",
          score: 0,
          violations: [violation.id],
          evidenceRefs: []
        }),
        "receipt-after-001.json": receipt({}),
        "policy-patch.json": policyPatch,
        "proof-audit.json": proofAudit,
        "proof-manifest-verification.json": proofManifestVerification,
        "public-proof-export-manifest.json": publicProofExportManifest,
        "trace-before.json": beforeTrace,
        "trace-after.json": runAfterTrace,
        "violations-before.json": [violation],
        "violations-after.json": []
      })
    );
    const html = renderApp(bundle, "proof-browser", {
      artifactOptions: defaultArtifactOptions,
      workbench: {
        available: true,
        healthStatus: "available",
        runs: [
          {
            runId: "run-after",
            artifactBase: "/api/artifacts/run-after",
            fileCount: 12,
            files: ["receipt-before-001.json", "receipt-after-001.json", "proof-audit.json", "proof-manifest.json"],
            workflow: "fixture-certification",
            state: "succeeded",
            verdict: "READY",
            score: 100,
            violations: 0,
            evidenceRefs: 1,
            proofAuditStatus: "PASS",
            manifestStatus: "PASS",
            missionIds: [mission.id],
            ruleIds: [],
            createdAt: "2026-06-01T06:45:00.000Z"
          },
          {
            runId: "run-before",
            artifactBase: "/api/artifacts/run-before",
            fileCount: 9,
            files: ["receipt-external-001.json", "trace-external.json", "violations-external.json"],
            workflow: "external-trace-certification",
            state: "failed",
            verdict: "NOT READY",
            score: 0,
            violations: 1,
            evidenceRefs: 0,
            proofAuditStatus: "FAIL",
            manifestStatus: "UNVERIFIED",
            missionIds: [mission.id],
            ruleIds: ["SPL-001"],
            createdAt: "2026-06-01T06:31:00.000Z"
          }
        ]
      }
    });

    expect(bundle.proofManifestVerification?.status).toBe("PASS");
    expect(html).toContain('data-view="proof-browser"');
    expect(html).toContain('class="active">Runs</a>');
    expect(html).toContain('data-run-filter');
    expect(html).toContain('data-run-status-filter');
    expect(html).toContain('data-run-workflow-filter');
    expect(html).toContain("fixture-certification");
    expect(html).toContain("external-trace-certification");
    expect(html).toContain("run-after");
    expect(html).toContain("run-before");
    expect(html).toContain("run-card");
    expect(html).toContain("run-card-facts");
    expect(html).toContain('data-public-proof-export="run-after"');
    expect(html).toContain("Export");
    expect(html).toContain("2026-06-01 06:45:00Z");
    expect(html.indexOf("run-after")).toBeLessThan(html.indexOf("run-before"));
    expect(html).not.toContain("external-trace-certification / failed");
    expect(html).toContain("Receipt comparison");
    expect(html).toContain("NOT READY");
    expect(html).toContain("READY");
    expect(html).toContain("<td>0</td>");
    expect(html).toContain("<td>100</td>");
    expect(html).toContain("SPL-001");
    expect(html).toContain("<th>Evidence refs</th><td>0</td><td>1</td>");
    expect(html).toContain("<th>Policy patch</th><td>1 rule(s)</td><td>exported</td>");
    expect(html).toContain("/api/artifacts/run-after/receipt-before-001.json");
    expect(html).toContain("/api/artifacts/run-after/receipt-after-001.json");
    expect(html).toContain("Proof audit");
    expect(html).toContain("Public proof export");
    expect(html).toContain("REDACTED");
    expect(html).toContain("rawMcpErrorBodies: redacted");
    expect(html).toContain("sanitized derivative bundle; not the unredacted source proof");
    expect(html).toContain("cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc");
    expect(html).toContain("contract-loaded / PASS");
    expect(html).toContain("Manifest verification");
    expect(html).toContain("<th>Expected files</th><td>12</td>");
    expect(html).toContain("<th>Unexpected files</th><td>none</td>");
    expect(html).toContain('data-verify-manifest="run-after"');
    expect(html).toContain("Trace preview");
    expect(html).toContain("Full Trace view");
    expect(html).toContain("Selected run trace events grouped by phase.");
    expect(html.indexOf("Trace preview")).toBeLessThan(html.indexOf("Proof audit"));
    expect(html).toContain("trace-preview-phases");
    expect(html).toContain("trace-preview-phase");
    expect(html).toContain('data-trace-preview-phase="before"');
    expect(html).toContain('data-trace-preview-phase="after"');
    expect(html).toContain('data-trace-preview-sequence="B01"');
    expect(html).toContain('data-trace-preview-sequence="A01"');
    expect(html).toContain("<dt>Events</dt><dd>4</dd>");
    expect(html).toContain("<dt>Evidence refs</dt><dd>3</dd>");
    expect(html).toContain("<strong>Span</strong>after-call to after-final");
    expect(html).toContain("<strong>Rule IDs</strong>");
    expect(html).toContain("trace-preview-rule-summary");
    expect(html).toContain("4 event(s) / 2 tool(s) / 0 finding(s) / 3 evidence ref(s)");
    expect(html).toContain("after-call to after-final");
    expect(html).toContain("trace-preview-list");
    expect(html).toContain("trace-preview-event");
    expect(html).toContain('data-trace-preview-event="tool_call"');
    expect(html).toContain('data-trace-preview-event="final_answer"');
    expect(html.indexOf('data-trace-preview-id="trace-after-call"')).toBeLessThan(
      html.indexOf('data-trace-preview-id="trace-after-result"')
    );
    expect(html.indexOf('data-trace-preview-id="trace-after-result"')).toBeLessThan(
      html.indexOf('data-trace-preview-id="trace-after-enrichment"')
    );
    expect(html.indexOf('data-trace-preview-id="trace-after-enrichment"')).toBeLessThan(
      html.indexOf('data-trace-preview-id="trace-after-final"')
    );
    expect(html).toContain("parent after-call");
    expect(html).toContain("2026-06-01 06:45:00Z");
    expect(html).toContain("tool_call / splunk_run_saved_search");
    expect(html).toContain("final_answer");
    expect(html).toContain("3 result(s)");
    expect(html).toContain("3 evidence ref(s)");
    expect(html).toContain("splunk_get_knowledge_objects");
    expect(html).not.toContain("trace-preview-table");
    expect(html).not.toContain("SAIA recommended SPL");
    expect(html).not.toContain("compact-trace-table");
    expect(html).toContain("splunk_run_query");
    expect(html).toContain("splunk_run_saved_search");
  });

  it("keeps Runs trace preview rows stable for long metadata and hidden events", () => {
    const longTrace = Array.from({ length: 10 }, (_, index): TraceEvent => {
      const sequence = String(index + 1).padStart(2, "0");
      const previous = index > 0 ? `trace-after-long-${String(index).padStart(2, "0")}` : undefined;

      return {
        ...afterTrace[0],
        id: `trace-after-long-${sequence}`,
        type: index % 2 === 0 ? "tool_call" : "tool_result",
        toolName: "splunk_run_saved_search_with_enterprise_security_context",
        queryRef: `saved-search-lateral-movement-investigation-ref-${sequence}-with-long-context`,
        parentId: previous,
        resultCount: index % 2 === 0 ? null : index,
        evidenceRefs: index % 2 === 0 ? [] : [`evt-long-${sequence}`],
        step: index + 1
      };
    });
    const bundle: UiArtifactBundle = {
      artifactBase: "/api/artifacts/run-after",
      missions: [],
      beforeTrace: [],
      afterTrace: longTrace,
      externalTrace: [],
      importedTrace: [],
      beforeViolations: [],
      afterViolations: [{ ...violation, id: "violation-long-009", traceEventId: "trace-after-long-09", ruleId: "EVD-001" }],
      externalViolations: [],
      missing: []
    };
    const html = renderTracePreview(bundle);

    expect(html).toContain('data-trace-preview-sequence="A01"');
    expect(html).toContain('data-trace-preview-sequence="A08"');
    expect(html).toContain("saved-search-lateral-movement-investigation-ref-08-with-long-context");
    expect(html).toContain('class="trace-preview-more" data-trace-preview-more');
    expect(html).toContain("+2 more event(s) in full Trace view");
    expect(html).not.toContain("trace-preview-event trace-preview-event-more");
  });

  it("keeps the app styling away from generic AI dashboard patterns", async () => {
    const css = await readFile(new URL("../../ui/src/styles.css", import.meta.url), "utf8");
    const entry = await readFile(new URL("../../ui/src/main.ts", import.meta.url), "utf8");

    expect(css).not.toMatch(/glass|backdrop-filter|linear-gradient|radial-gradient|translate|letter-spacing:\s*-/i);
    expect(css).not.toMatch(/border-radius:\s*(?:1[2-9]|[2-9]\d)px/i);
    expect(css).not.toMatch(/"Avenir Next"|"Helvetica Neue"|\bAvenir\b|\bHelvetica\b|\bArial\b|\bInter\b|\bRoboto\b|"Segoe UI"/i);
    expect(css).toContain("Spline Sans Variable");
    expect(css).toContain("Spline Sans Mono");
    expect(css).toContain("Geist Mono");
    expect(entry).toContain("@fontsource-variable/spline-sans");
    expect(entry).toContain("@fontsource-variable/spline-sans-mono");
    expect(entry).toContain("@fontsource-variable/geist-mono");
    expect(css).not.toContain("dashboard");
  });
});
