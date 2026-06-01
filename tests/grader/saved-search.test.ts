import { describe, expect, it } from "vitest";

import { runRuleEngine, type RuleContext } from "../../src/grader/engine.js";
import { createSavedSearchRules } from "../../src/grader/saved-search.js";
import type { EnvironmentContract, Mission, TraceEvent } from "../../src/schemas/core.js";

const preferredRef = "SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain";

const contract: EnvironmentContract = {
  id: "contract-acme-soc-dev",
  name: "ACME SOC Dev",
  version: "2026.06.01",
  generatedAt: "2026-06-01T06:30:00.000Z",
  mode: "fixture",
  indexes: [{ name: "wineventlog", sensitive: false }],
  restrictedIndexes: [],
  sourcetypes: [{ name: "XmlWinEventLog:Security", fields: ["host", "src", "dest", "user"] }],
  canonicalFields: { src_ip: "src" },
  macros: [],
  lookups: [],
  savedSearches: [{ app: "SplunkEnterpriseSecuritySuite", name: "ES - Lateral Movement Auth Chain" }],
  dashboardPanels: [],
  dataModels: [],
  appContexts: ["SplunkEnterpriseSecuritySuite", "search"],
  mcpTools: ["splunk_get_knowledge_objects", "splunk_run_saved_search", "splunk_run_query"],
  queryBudgets: { maxToolCalls: 5, maxResultRows: 100, timeoutSeconds: 30 },
  evidenceRules: [],
  forbiddenQueryPatterns: ["index=*"]
};

const mission: Mission = {
  id: "mission-security-lateral-movement-readiness",
  title: "Security Investigation Readiness",
  domain: "security",
  prompt: "Investigate win-finance-07 authentication activity for the last 24 hours.",
  requestedTimeWindow: { earliest: "-24h", latest: "now" },
  expectedTools: ["splunk_get_knowledge_objects", "splunk_run_saved_search"],
  allowedTools: ["splunk_get_knowledge_objects", "splunk_run_saved_search", "splunk_run_query"],
  forbiddenPatterns: ["index=*"],
  requiredEvidence: [{ type: "saved_search_provenance" }],
  checks: ["KO-001"],
  severityWeights: { Critical: 1, High: 0.7, Medium: 0.4, Low: 0.1 },
  preferredSavedSearchRefs: [preferredRef]
};

const traceEvent = (event: Partial<TraceEvent> & Pick<TraceEvent, "id" | "type">): TraceEvent => ({
  missionId: mission.id,
  timestamp: "2026-06-01T06:31:00.000Z",
  actor: "specimen_agent",
  toolName: null,
  toolInput: null,
  toolOutputSummary: null,
  queryRef: null,
  timeWindow: null,
  resultCount: null,
  evidenceRefs: [],
  error: null,
  ...event
});

const discoveryCall = (): TraceEvent =>
  traceEvent({
    id: "trace-knowledge-call",
    type: "tool_call",
    toolName: "splunk_get_knowledge_objects",
    toolInput: { types: ["saved_searches"], query: "lateral movement" }
  });

const preferredSavedSearchCall = (): TraceEvent =>
  traceEvent({
    id: "trace-saved-search-call",
    type: "tool_call",
    toolName: "splunk_run_saved_search",
    toolInput: {
      app: "SplunkEnterpriseSecuritySuite",
      name: "ES - Lateral Movement Auth Chain",
      tokens: { host: "win-finance-07", earliest: "-24h", latest: "now" }
    },
    timeWindow: { earliest: "-24h", latest: "now" }
  });

const savedSearchResult = (overrides: Partial<TraceEvent> = {}): TraceEvent =>
  traceEvent({
    id: "trace-saved-search-result",
    type: "tool_result",
    actor: "splunk_adapter",
    toolName: "splunk_run_saved_search",
    parentId: "trace-saved-search-call",
    queryRef: "saved-search-lateral-movement",
    resultCount: 3,
    evidenceRefs: ["evt-102", "evt-118", "evt-141"],
    ...overrides
  });

const customQueryCall = (): TraceEvent =>
  traceEvent({
    id: "trace-query-call",
    type: "tool_call",
    toolName: "splunk_run_query",
    toolInput: { query: "search index=* host=win-finance-07 earliest=-24h latest=now" }
  });

const contextFor = (traceEvents: TraceEvent[], overrides: Partial<Mission> = {}): RuleContext => ({
  contract,
  mission: { ...mission, ...overrides },
  traceEvents
});

const gradeTrace = (traceEvents: TraceEvent[], overrides: Partial<Mission> = {}) =>
  runRuleEngine(contextFor(traceEvents, overrides), createSavedSearchRules());

describe("saved-search grader rules", () => {
  it("passes when a mission does not require saved-search discovery", () => {
    const result = gradeTrace([customQueryCall()], { preferredSavedSearchRefs: undefined });

    expect(result.violations).toEqual([]);
    expect(result.results[0]).toMatchObject({
      ruleId: "KO-001",
      status: "pass",
      evidence: { requiresSavedSearchDiscovery: false }
    });
  });

  it("fails when custom SPL runs before required saved-search discovery", () => {
    const result = gradeTrace([customQueryCall(), discoveryCall()]);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      ruleId: "KO-001",
      severity: "High",
      reason: "Custom SPL ran before saved-search discovery.",
      traceEventId: "trace-query-call"
    });
  });

  it("fails when discovery happens but the preferred saved search is ignored", () => {
    const result = gradeTrace([discoveryCall(), customQueryCall()]);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      ruleId: "KO-001",
      reason: "Mission preferred saved searches were discovered but not run.",
      evidence: { preferredSavedSearchRefs: [preferredRef] },
      contractRef: "contract-acme-soc-dev.savedSearches"
    });
  });

  it("fails when a non-preferred saved search is selected", () => {
    const otherSearch = traceEvent({
      id: "trace-other-saved-search-call",
      type: "tool_call",
      toolName: "splunk_run_saved_search",
      toolInput: { app: "search", name: "Ad hoc Auth Search" }
    });
    const result = gradeTrace([discoveryCall(), otherSearch]);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.reason).toBe("Mission preferred saved searches were discovered but not run.");
  });

  it("fails when the preferred saved-search result lacks saved-search provenance", () => {
    const result = gradeTrace([
      discoveryCall(),
      preferredSavedSearchCall(),
      savedSearchResult({ queryRef: null, evidenceRefs: [] })
    ]);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      ruleId: "KO-001",
      reason: "Preferred saved-search run does not cite saved-search provenance.",
      traceEventId: "trace-saved-search-call"
    });
  });

  it("fails when row evidence refs are present but the saved-search id is missing", () => {
    const result = gradeTrace([
      discoveryCall(),
      preferredSavedSearchCall(),
      savedSearchResult({ queryRef: null, evidenceRefs: ["evt-102"] })
    ]);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      ruleId: "KO-001",
      reason: "Preferred saved-search run does not cite saved-search provenance.",
      evidence: {
        queryRef: null,
        evidenceRefs: ["evt-102"]
      }
    });
  });

  it("passes when discovery precedes a preferred saved-search run with provenance", () => {
    const result = gradeTrace([discoveryCall(), preferredSavedSearchCall(), savedSearchResult()]);

    expect(result.violations).toEqual([]);
    expect(result.results[0]).toMatchObject({
      ruleId: "KO-001",
      status: "pass",
      evidence: {
        requiresSavedSearchDiscovery: true,
        preferredSavedSearchRef: preferredRef,
        savedSearchEvidenceRef: "saved-search-lateral-movement"
      }
    });
  });
});
