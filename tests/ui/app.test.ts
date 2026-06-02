import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { artifactUrl, loadUiArtifactBundle, normalizeArtifactBase } from "../../ui/src/artifacts.js";
import { renderApp } from "../../ui/src/render.js";
import type { EnvironmentContract, Mission, PolicyPatch, ReadinessReceipt, TraceEvent, Violation } from "../../src/schemas/core.js";

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
  notes:
    "The live-derived mission was already ready before policy injection; this proves live certification but not the fail-to-pass patch loop."
};

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
    expect(artifactUrl("/custom", "receipt-after-001.json")).toBe("/custom/receipt-after-001.json");
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
        "live-security-readiness.json": liveSecurityReadiness,
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
    expect(liveConnect).toContain("Ready without patch");
    expect(liveConnect).toContain("internal-query-fallback");
    expect(liveConnect).toContain("Flagship security readiness");
    expect(liveConnect).toContain("BLOCKED");
    expect(liveConnect).toContain("SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain / missing");
    expect(liveConnect).toContain("wineventlog / missing");
    expect(liveConnect).toContain("security blocked");
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
    expect(receiptHtml).not.toContain("receipt-book-grid");
    expect(receiptHtml).not.toContain("receipt-slot");
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
