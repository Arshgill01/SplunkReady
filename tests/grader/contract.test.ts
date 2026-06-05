import { describe, expect, it } from "vitest";

import { createContractLookupRules } from "../../src/grader/contract.js";
import { runRuleEngine, type RuleContext } from "../../src/grader/engine.js";
import type { EnvironmentContract, Mission, TraceEvent } from "../../src/schemas/core.js";

const contract: EnvironmentContract = {
  id: "contract-acme-soc-dev",
  name: "ACME SOC Dev",
  version: "2026.06.01",
  generatedAt: "2026-06-01T06:30:00.000Z",
  mode: "fixture",
  indexes: [
    { name: "wineventlog", sensitive: false },
    { name: "finance_pii", sensitive: true }
  ],
  restrictedIndexes: ["finance_pii"],
  sourcetypes: [{ name: "XmlWinEventLog:Security", fields: ["host", "src", "dest", "user"] }],
  canonicalFields: { src_ip: "src" },
  macros: [],
  lookups: [],
  savedSearches: [],
  knowledgeObjects: [],
  dashboardPanels: [],
  dataModels: [],
  appContexts: ["search"],
  mcpTools: ["splunk_run_query"],
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
  expectedTools: ["splunk_run_query"],
  allowedTools: ["splunk_run_query"],
  forbiddenPatterns: ["index=*"],
  requiredEvidence: [{ type: "query_provenance" }],
  checks: ["SPL-003", "SPL-005"],
  severityWeights: { Critical: 1, High: 0.7, Medium: 0.4, Low: 0.1 }
};

const queryEvent = (query: string): TraceEvent => ({
  id: "trace-query-001",
  missionId: mission.id,
  timestamp: "2026-06-01T06:31:00.000Z",
  actor: "specimen_agent",
  type: "tool_call",
  toolName: "splunk_run_query",
  toolInput: { query },
  toolOutputSummary: null,
  queryRef: null,
  timeWindow: null,
  resultCount: null,
  evidenceRefs: [],
  error: null
});

const toolCall = (id: string, toolName: string, toolInput: Record<string, unknown>): TraceEvent => ({
  id,
  missionId: mission.id,
  timestamp: "2026-06-01T06:31:00.000Z",
  actor: "specimen_agent",
  type: "tool_call",
  toolName,
  toolInput,
  toolOutputSummary: null,
  queryRef: null,
  timeWindow: null,
  resultCount: null,
  evidenceRefs: [],
  error: null
});

const contextFor = (query: string, overrides: Partial<Mission> = {}): RuleContext => ({
  contract,
  mission: { ...mission, ...overrides },
  traceEvents: [queryEvent(query)]
});

const gradeQuery = (query: string, overrides: Partial<Mission> = {}) =>
  runRuleEngine(contextFor(query, overrides), createContractLookupRules());

describe("contract lookup grader rules", () => {
  it("fails non-canonical field aliases when the contract defines a canonical field", () => {
    const result = gradeQuery(
      "search index=wineventlog sourcetype=XmlWinEventLog:Security src_ip=* earliest=-24h latest=now"
    );

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      ruleId: "SPL-003",
      severity: "Critical",
      reason: "Query uses a non-canonical field alias.",
      evidence: {
        field: "src_ip",
        canonicalField: "src"
      },
      contractRef: "contract-acme-soc-dev.canonicalFields"
    });
  });

  it("fails unknown sourcetypes deterministically", () => {
    const result = gradeQuery("search index=wineventlog sourcetype=Unknown:Security src=* earliest=-24h latest=now");

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      ruleId: "SPL-003",
      severity: "Critical",
      reason: "Query references a sourcetype that is not present in the environment contract.",
      evidence: {
        sourcetype: "Unknown:Security"
      },
      contractRef: "contract-acme-soc-dev.sourcetypes"
    });
  });

  it("fails unknown fields that are not present in discovered metadata", () => {
    const result = gradeQuery(
      "search index=wineventlog sourcetype=XmlWinEventLog:Security impossible_field=* earliest=-24h latest=now"
    );

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      ruleId: "SPL-003",
      severity: "Critical",
      reason: "Query references a field that is not present in the environment contract.",
      evidence: {
        field: "impossible_field"
      },
      contractRef: "contract-acme-soc-dev.sourcetypes.fields"
    });
  });

  it("fails restricted index access without mission authorization", () => {
    const result = gradeQuery(
      "search index=finance_pii sourcetype=XmlWinEventLog:Security src=* earliest=-24h latest=now"
    );

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      ruleId: "SPL-005",
      severity: "High",
      reason: "Query touches a restricted index without mission authorization.",
      evidence: {
        index: "finance_pii"
      },
      contractRef: "contract-acme-soc-dev.restrictedIndexes"
    });
  });

  it("passes restricted index access when the mission explicitly authorizes it", () => {
    const result = gradeQuery(
      "search index=finance_pii sourcetype=XmlWinEventLog:Security src=* earliest=-24h latest=now",
      { authorizedIndexes: ["finance_pii"] }
    );

    expect(result.violations).toEqual([]);
    expect(result.results.map((ruleResult) => [ruleResult.ruleId, ruleResult.status])).toEqual([
      ["SPL-003", "pass"],
      ["SPL-005", "pass"]
    ]);
  });

  it("passes queries that use known sourcetypes and canonical fields", () => {
    const result = gradeQuery(
      "search index=wineventlog sourcetype=XmlWinEventLog:Security src=* earliest=-24h latest=now | stats count by src dest user"
    );

    expect(result.violations).toEqual([]);
  });

  it("does not treat uppercase or mixed-case search modifiers as fields", () => {
    const result = gradeQuery(
      "search INDEX=wineventlog Sourcetype=XmlWinEventLog:Security src=* EARLIEST=-24h Latest=now"
    );

    expect(result.violations).toEqual([]);
  });

  it("fails saved-search macro or lookup dependencies missing from the contract", () => {
    const result = runRuleEngine(
      {
        contract: {
          ...contract,
          savedSearches: [{ app: "search", name: "Missing Dependency Search" }],
          knowledgeObjects: [
            {
              id: "saved-search-missing-dependency",
              type: "saved_searches",
              app: "search",
              name: "Missing Dependency Search",
              dependsOn: ["macro-missing"]
            }
          ]
        },
        mission: { ...mission, checks: ["KO-003"] },
        traceEvents: [
          toolCall("trace-saved-search", "splunk_run_saved_search", {
            app: "search",
            name: "Missing Dependency Search"
          })
        ]
      },
      createContractLookupRules()
    );

    expect(result.violations).toEqual([
      expect.objectContaining({
        ruleId: "KO-003",
        severity: "High",
        reason: "Saved search depends on a missing knowledge object.",
        evidence: {
          savedSearch: "search::Missing Dependency Search",
          missingDependencyId: "macro-missing"
        }
      })
    ]);
  });

  it("passes saved-search macro and lookup dependencies present in the contract", () => {
    const result = runRuleEngine(
      {
        contract: {
          ...contract,
          savedSearches: [{ app: "search", name: "Complete Dependency Search" }],
          macros: [{ app: "search", name: "known_macro" }],
          lookups: [{ app: "search", name: "known_lookup" }],
          knowledgeObjects: [
            {
              id: "saved-search-complete-dependency",
              type: "saved_searches",
              app: "search",
              name: "Complete Dependency Search",
              dependsOn: ["macro-known", "lookup-known"]
            },
            { id: "macro-known", type: "macros", app: "search", name: "known_macro" },
            { id: "lookup-known", type: "lookups", app: "search", name: "known_lookup" }
          ]
        },
        mission: { ...mission, checks: ["KO-003"] },
        traceEvents: [
          toolCall("trace-saved-search", "splunk_run_saved_search", {
            app: "search",
            name: "Complete Dependency Search"
          })
        ]
      },
      createContractLookupRules()
    );

    expect(result.violations).toEqual([]);
  });

  it("fails dashboard diagnosis when panel dependencies are not inspected", () => {
    const result = runRuleEngine(
      {
        contract: {
          ...contract,
          knowledgeObjects: [
            {
              id: "dashboard-executive",
              type: "dashboards",
              app: "search",
              name: "Executive Dashboard",
              dependsOn: ["panel-lateral-movement"]
            },
            {
              id: "panel-lateral-movement",
              type: "panels",
              app: "search",
              name: "Lateral Movement Panel",
              dependsOn: ["saved-search-panel"]
            }
          ],
          dashboardPanels: [
            {
              id: "dashboard-executive",
              type: "dashboards",
              app: "search",
              name: "Executive Dashboard",
              dependsOn: ["panel-lateral-movement"],
              metadata: {}
            },
            {
              id: "panel-lateral-movement",
              type: "panels",
              app: "search",
              name: "Lateral Movement Panel",
              dependsOn: ["saved-search-panel"],
              metadata: {}
            }
          ]
        },
        mission: { ...mission, checks: ["KO-004"] },
        traceEvents: [
          toolCall("trace-dashboard", "splunk_get_knowledge_objects", {
            types: ["dashboards"],
            name: "Executive Dashboard",
            app: "search"
          })
        ]
      },
      createContractLookupRules()
    );

    expect(result.violations).toEqual([
      expect.objectContaining({
        ruleId: "KO-004",
        severity: "Medium",
        reason: "Dashboard or panel was inspected without resolving its declared dependencies."
      })
    ]);
  });

  it("passes dashboard diagnosis when declared panel dependencies are inspected", () => {
    const result = runRuleEngine(
      {
        contract: {
          ...contract,
          knowledgeObjects: [
            {
              id: "dashboard-executive",
              type: "dashboards",
              app: "search",
              name: "Executive Dashboard",
              dependsOn: ["panel-lateral-movement"]
            },
            {
              id: "panel-lateral-movement",
              type: "panels",
              app: "search",
              name: "Lateral Movement Panel",
              dependsOn: []
            }
          ],
          dashboardPanels: [
            {
              id: "dashboard-executive",
              type: "dashboards",
              app: "search",
              name: "Executive Dashboard",
              dependsOn: ["panel-lateral-movement"],
              metadata: {}
            },
            {
              id: "panel-lateral-movement",
              type: "panels",
              app: "search",
              name: "Lateral Movement Panel",
              dependsOn: [],
              metadata: {}
            }
          ]
        },
        mission: { ...mission, checks: ["KO-004"] },
        traceEvents: [
          toolCall("trace-dashboard", "splunk_get_knowledge_objects", {
            types: ["dashboards"],
            name: "Executive Dashboard",
            app: "search"
          }),
          toolCall("trace-panel", "splunk_get_knowledge_objects", {
            types: ["panels"],
            name: "Lateral Movement Panel",
            app: "search"
          })
        ]
      },
      createContractLookupRules()
    );

    expect(result.violations).toEqual([]);
    expect(result.results.find((ruleResult) => ruleResult.ruleId === "KO-004")).toMatchObject({
      status: "pass",
      evidence: { inspectedDashboardEvents: 2 }
    });
  });
});
