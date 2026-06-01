import { describe, expect, it } from "vitest";

import { createAppContextRules } from "../../src/grader/app-context.js";
import { runRuleEngine, type RuleContext } from "../../src/grader/engine.js";
import type { EnvironmentContract, Mission, TraceEvent } from "../../src/schemas/core.js";

const duplicateSearchName = "ES - Lateral Movement Auth Chain";

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
  macros: [
    { app: "SplunkEnterpriseSecuritySuite", name: "security_content_ctime" },
    { app: "search", name: "security_content_ctime" }
  ],
  lookups: [{ app: "SplunkEnterpriseSecuritySuite", name: "asset_lookup" }],
  savedSearches: [
    { app: "SplunkEnterpriseSecuritySuite", name: duplicateSearchName },
    { app: "search", name: duplicateSearchName }
  ],
  dashboardPanels: [],
  dataModels: [],
  appContexts: ["SplunkEnterpriseSecuritySuite", "search"],
  mcpTools: ["splunk_get_knowledge_objects", "splunk_run_saved_search"],
  queryBudgets: { maxToolCalls: 5, maxResultRows: 100, timeoutSeconds: 30 },
  evidenceRules: [],
  forbiddenQueryPatterns: ["index=*"]
};

const mission: Mission = {
  id: "mission-security-saved-search-app-context",
  title: "Use the correct app-scoped saved search",
  domain: "security",
  prompt: "Run the validated lateral movement saved search in the correct app context.",
  requestedTimeWindow: { earliest: "-24h", latest: "now" },
  expectedTools: ["splunk_run_saved_search"],
  allowedTools: ["splunk_get_knowledge_objects", "splunk_run_saved_search"],
  forbiddenPatterns: ["index=*"],
  requiredEvidence: [{ type: "saved_search_app" }],
  checks: ["KO-002"],
  severityWeights: { Critical: 1, High: 0.7, Medium: 0.4, Low: 0.1 },
  preferredSavedSearchRefs: [`SplunkEnterpriseSecuritySuite::${duplicateSearchName}`]
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

const savedSearchCall = (app?: string): TraceEvent =>
  traceEvent({
    id: "trace-saved-search-call",
    type: "tool_call",
    toolName: "splunk_run_saved_search",
    toolInput: {
      ...(app ? { app } : {}),
      name: duplicateSearchName
    }
  });

const macroDiscoveryCall = (app: string): TraceEvent =>
  traceEvent({
    id: "trace-macro-discovery-call",
    type: "tool_call",
    toolName: "splunk_get_knowledge_objects",
    toolInput: {
      types: ["macros"],
      name: "security_content_ctime",
      app
    }
  });

const contextFor = (traceEvents: TraceEvent[]): RuleContext => ({
  contract,
  mission,
  traceEvents
});

const gradeTrace = (traceEvents: TraceEvent[]) => runRuleEngine(contextFor(traceEvents), createAppContextRules());

describe("app-context grader rules", () => {
  it("fails a duplicate-name saved search when the wrong app is used", () => {
    const result = gradeTrace([savedSearchCall("search")]);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      ruleId: "KO-002",
      severity: "High",
      reason: "Knowledge object app context does not match the mission preference.",
      evidence: {
        kind: "saved_searches",
        name: duplicateSearchName,
        app: "search",
        expectedApps: ["SplunkEnterpriseSecuritySuite"],
        duplicateName: true,
        blastRadius: "Wrong app context can run a same-name object with different SPL, macros, or lookups."
      }
    });
  });

  it("fails duplicate-name saved searches when app context is omitted", () => {
    const result = gradeTrace([savedSearchCall()]);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      ruleId: "KO-002",
      reason: "App-scoped knowledge object was used without an app context.",
      evidence: {
        expectedApps: ["SplunkEnterpriseSecuritySuite", "search"]
      }
    });
  });

  it("fails app contexts that are not present in the contract", () => {
    const result = gradeTrace([savedSearchCall("unknown_app")]);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      ruleId: "KO-002",
      reason: "Knowledge object uses an app outside the environment contract.",
      evidence: {
        app: "unknown_app",
        allowedAppContexts: ["SplunkEnterpriseSecuritySuite", "search"]
      }
    });
  });

  it("grades macro app context with the same deterministic rule", () => {
    const result = gradeTrace([macroDiscoveryCall("unknown_app")]);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      ruleId: "KO-002",
      evidence: {
        kind: "macros",
        name: "security_content_ctime"
      }
    });
  });

  it("passes when the duplicate-name saved search includes the correct app context", () => {
    const result = gradeTrace([savedSearchCall("SplunkEnterpriseSecuritySuite")]);

    expect(result.violations).toEqual([]);
    expect(result.results[0]).toMatchObject({
      ruleId: "KO-002",
      status: "pass",
      evidence: { inspectedAppScopedRefs: 1 }
    });
  });
});
