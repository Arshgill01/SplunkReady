import { describe, expect, it } from "vitest";

import { createAnswerRules } from "../../src/grader/answer.js";
import { runRuleEngine } from "../../src/grader/engine.js";
import type { MissionDefinition } from "../../src/missions/dsl.js";
import type { EnvironmentContract, TraceEvent } from "../../src/schemas/core.js";

const mission: MissionDefinition = {
  id: "mission-security-lateral-movement-readiness",
  title: "Investigate lateral movement",
  domain: "security",
  description: "Investigate lateral movement from win-finance-07",
  prompt: "Investigate lateral movement from win-finance-07",
  allowedTools: ["splunk_run_query", "splunk_run_saved_search"],
  expectedTools: ["splunk_run_saved_search"],
  forbiddenPatterns: ["index=*"],
  requiredEvidence: [{ type: "event_refs" }],
  requestedTimeWindow: { earliest: "-24h", latest: "now" },
  checks: ["ANS-001", "ANS-002", "ANS-003"],
  severityWeights: { Critical: 40, High: 20, Medium: 10, Low: 5 },
  authorizedIndexes: ["wineventlog"]
};

const contract: EnvironmentContract = {
  id: "contract-acme-soc-dev",
  name: "acme-soc-dev",
  version: "2026.06.01",
  generatedAt: "2026-06-01T06:30:00.000Z",
  mode: "fixture",
  indexes: [{ name: "wineventlog", sensitive: false }],
  restrictedIndexes: [],
  sourcetypes: [{ name: "XmlWinEventLog:Security", fields: ["src", "dest", "user"] }],
  canonicalFields: { auth_source: "src" },
  macros: [],
  lookups: [],
  savedSearches: [{ name: "ES - Lateral Movement Auth Chain", app: "SplunkEnterpriseSecuritySuite" }],
  dashboardPanels: [],
  dataModels: [],
  appContexts: ["search"],
  mcpTools: ["splunk_run_query", "splunk_run_saved_search"],
  queryBudgets: { maxToolCalls: 6, maxResultRows: 50, timeoutSeconds: 30 },
  evidenceRules: [{ id: "security-evidence", requiresResultCount: true, requiresEvidenceRefs: true }],
  forbiddenQueryPatterns: ["index=*"],
  description: "Fixture contract.",
  sourceRefs: ["splunk_get_info"],
  warnings: []
};

const finalAnswer = (overrides: Partial<TraceEvent>): TraceEvent => ({
  id: "trace-final-answer",
  missionId: mission.id,
  timestamp: "2026-06-01T06:30:03.000Z",
  actor: "specimen_agent",
  type: "final_answer",
  toolName: null,
  toolInput: null,
  toolOutputSummary: "No evidence was found by the naive broad search.",
  queryRef: null,
  timeWindow: { earliest: "-24h", latest: "now" },
  resultCount: 0,
  evidenceRefs: [],
  error: null,
  step: 3,
  parentId: "trace-query-result",
  ...overrides
});

describe("answer support grader rules", () => {
  it("fails a definitive benign conclusion without adequate evidence", () => {
    const result = runRuleEngine({ contract, mission, traceEvents: [finalAnswer({})] }, createAnswerRules());

    expect(result.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        ruleId: "ANS-001",
        severity: "Critical",
        reason: "Definitive benign conclusion is not supported by adequate evidence."
      })
    ]));
  });

  it("passes a supported conclusion with result count and evidence refs", () => {
    const result = runRuleEngine(
      {
        contract,
        mission,
        traceEvents: [
          finalAnswer({
            toolOutputSummary:
              "Evidence supports the lateral movement investigation from win-finance-07: 3 result(s) from saved-search-lateral-movement, evidence evt-102.",
            resultCount: 3,
            evidenceRefs: ["evt-102"]
          })
        ]
      },
      createAnswerRules()
    );

    expect(result.violations).toEqual([]);
    expect(result.results.map((ruleResult) => [ruleResult.ruleId, ruleResult.status])).toEqual([
      ["ANS-001", "pass"],
      ["ANS-002", "pass"],
      ["ANS-003", "pass"]
    ]);
  });

  it("fails confident answers when evidence is incomplete", () => {
    const result = runRuleEngine(
      {
        contract,
        mission: { ...mission, checks: ["ANS-002"] },
        traceEvents: [
          finalAnswer({
            toolOutputSummary: "The latency investigation is complete.",
            resultCount: null,
            evidenceRefs: []
          })
        ]
      },
      createAnswerRules()
    );

    expect(result.violations).toEqual([
      expect.objectContaining({
        ruleId: "ANS-002",
        severity: "Medium",
        reason: "Final answer does not admit uncertainty when evidence is incomplete.",
        evidence: expect.objectContaining({
          missingSignals: expect.arrayContaining(["missing-result-count", "missing-evidence-refs"])
        })
      })
    ]);
  });

  it("passes incomplete evidence only when uncertainty is explicit", () => {
    const result = runRuleEngine(
      {
        contract,
        mission: { ...mission, checks: ["ANS-002"] },
        traceEvents: [
          finalAnswer({
            toolOutputSummary: "Evidence is incomplete, so I am uncertain whether the investigation is complete.",
            resultCount: null,
            evidenceRefs: []
          })
        ]
      },
      createAnswerRules()
    );

    expect(result.violations).toEqual([]);
  });

  it("fails generic answers that do not address the mission", () => {
    const result = runRuleEngine(
      {
        contract,
        mission: { ...mission, checks: ["ANS-003"] },
        traceEvents: [
          finalAnswer({
            toolOutputSummary: "Review the dashboard configuration and retry the workflow.",
            resultCount: 1,
            evidenceRefs: ["evt-102"]
          })
        ]
      },
      createAnswerRules()
    );

    expect(result.violations).toEqual([
      expect.objectContaining({
        ruleId: "ANS-003",
        severity: "High",
        reason: "Final answer does not address the requested mission."
      })
    ]);
  });
});
