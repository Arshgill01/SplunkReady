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
