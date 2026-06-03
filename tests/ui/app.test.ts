import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { artifactUrl, defaultArtifactOptions, loadUiArtifactBundle, normalizeArtifactBase } from "../../ui/src/artifacts.js";
import { renderApp } from "../../ui/src/render.js";
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
    "saia_explain_spl",
    "saia_optimize_spl"
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
    availableTools: ["saia_explain_spl", "saia_optimize_spl"],
    missingTools: [],
    assistanceItems: 0,
    notes: "SAIA explain/optimize tools were available, but this proof did not produce SPL-rule violations with query evidence."
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
    availableTools: ["saia_explain_spl", "saia_optimize_spl"],
    missingTools: [],
    assistanceItems: 1,
    notes:
      "SAIA explain/optimize returned advisory output for SPL-rule violations. Deterministic rules remained authoritative for pass/fail."
  },
  notes:
    "The flagship live security mission completed the LLM fail -> patch -> rerun -> pass path against read-only Splunk MCP tools."
} as const;

const liveSecurityReadiness = {
  status: "BLOCKED",
  mode: "live",
  mutation: false,
  mission: {
    id: "mission-security-lateral-movement-readiness",
    story: "security investigation readiness"
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
    hostedModelTools: ["saia_explain_spl", "saia_optimize_spl"],
    availableTools: ["saia_explain_spl", "saia_optimize_spl"]
  },
  query: "search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now",
  deterministicContext: {
    ruleIds: ["SPL-001", "SPL-003"],
    passFailAuthority: "deterministic-rule-engine",
    purpose:
      "Demonstrate hosted-model explain/optimize as advisory remediation for a deterministic SPL violation. The query is not executed."
  },
  assistance: {
    explanation: "The SPL uses a broad index wildcard and a non-contract field.",
    optimizedQuery: "| savedsearch \"ES - Lateral Movement Auth Chain\"",
    rationale: "Prefer the validated saved search from the live contract.",
    warnings: []
  },
  toolCalls: ["saia_explain_spl", "saia_optimize_spl"],
  error: null,
  notes:
    "This proof calls hosted-model tools only. It does not run the SPL query, does not grade with an LLM, and does not mutate Splunk."
} as const;

const hostedModelDiagnostic = {
  status: "PASS",
  mode: "live",
  mutation: false,
  proofPath: "artifacts/hosted-model-proof/hosted-model-proof.json",
  contract: {
    id: "contract-192-168-1-4",
    mode: "live"
  },
  requiredTools: ["saia_explain_spl", "saia_optimize_spl"],
  availableTools: ["saia_explain_spl", "saia_optimize_spl"],
  missingTools: [],
  permission: {
    status: "OK",
    message: "The current MCP credentials can invoke saia_explain_spl and saia_optimize_spl for advisory SPL remediation."
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

const jsonResponse = (value: unknown): Response => new Response(JSON.stringify(value), { status: 200 });

const fetcherFor = (files: Record<string, unknown>) => async (url: string): Promise<Response> => {
  const fileName = decodeURIComponent(url.split("/").at(-1) ?? "");
  const value = files[fileName];

  return value === undefined ? new Response("not found", { status: 404 }) : jsonResponse(value);
};

describe("Vite UI artifact app", () => {
  it("normalizes artifact base URLs and preserves file names", () => {
    expect(normalizeArtifactBase(undefined)).toBe("/__splunkready_artifacts/");
    expect(normalizeArtifactBase("/custom")).toBe("/custom/");
    expect(normalizeArtifactBase("artifacts/live-security-ui")).toBe("/artifacts/live-security-ui/");
    expect(defaultArtifactOptions.map((option) => option.path)).toContain("artifacts/live-security-ui");
    expect(defaultArtifactOptions.map((option) => option.path)).toContain("artifacts/suite-proof");
    expect(defaultArtifactOptions.map((option) => option.path)).toContain("artifacts/mcp-transcript");
    expect(artifactUrl("/custom", "receipt-after-001.json")).toBe("/custom/receipt-after-001.json");
    expect(artifactUrl("artifacts/live-security-ui", "receipt-after-001.json")).toBe(
      "/artifacts/live-security-ui/receipt-after-001.json"
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
    expect(html).toContain("MCP transcript import");
    expect(html).toContain("Hosted model proof");
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
    expect(html).toContain("pass 3 mission suite");
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
    expect(liveConnect).toContain("security fail-to-pass");
    expect(liveConnect).toContain("saved_searches:SplunkEnterpriseSecuritySuite:ES - Lateral Movement Auth Chain");
    expect(liveConnect).toContain("Flagship security readiness");
    expect(liveConnect).toContain("BLOCKED");
    expect(liveConnect).toContain("SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain / missing");
    expect(liveConnect).toContain("wineventlog / missing");
    expect(liveConnect).toContain("Operator security kit");
    expect(liveConnect).toContain("operator kit available");
    expect(liveConnect).toContain("hosted diagnostic pass");
    expect(liveConnect).toContain("Operator action");
    expect(liveConnect).toContain("required");
    expect(liveConnect).toContain("Hosted model assistance");
    expect(liveConnect).toContain("saia_explain_spl / saia_optimize_spl");
    expect(liveConnect).toContain("advisory only; deterministic grader decides pass/fail");
    expect(liveConnect).toContain("Hosted model diagnostic");
    expect(liveConnect).toContain("Permission");
    expect(liveConnect).toContain("OK");
    expect(liveConnect).toContain("deterministic-rule-engine");
    expect(liveConnect).toContain("Hosted model proof");
    expect(liveConnect).toContain("Proof audit");
    expect(liveConnect).toContain("live-security");
    expect(liveConnect).toContain("fail-to-pass / PASS");
    expect(liveConnect).toContain("Warnings or failures");
    expect(liveConnect).toContain("audit pass");
    expect(liveConnect).toContain("Hosted models");
    expect(liveConnect).toContain("invoked");
    expect(liveConnect).toContain("Before SPL");
    expect(liveConnect).toContain("SAIA recommended SPL");
    expect(liveConnect).toContain("| savedsearch &quot;ES - Lateral Movement Auth Chain&quot;");
    expect(liveConnect).toContain("Mutation");
    expect(liveConnect).toContain("no");
    expect(liveConnect).toContain("artifacts/live-security-kit/SplunkEnterpriseSecuritySuite/default/savedsearches.conf");
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
    expect(liveConnect).toContain("before splunk_run_query");
    expect(liveConnect).toContain("audit pass");
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
