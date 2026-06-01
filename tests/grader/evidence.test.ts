import { describe, expect, it } from "vitest";

import { createEvidenceRules } from "../../src/grader/evidence.js";
import { runRuleEngine, type RuleContext } from "../../src/grader/engine.js";
import type { EnvironmentContract, Mission, TraceEvent } from "../../src/schemas/core.js";

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
  savedSearches: [],
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
  requiredEvidence: [{ type: "query_provenance" }, { type: "evidence_refs" }],
  checks: ["EVD-001", "EVD-002", "EVD-003", "EVD-004"],
  severityWeights: { Critical: 1, High: 0.7, Medium: 0.4, Low: 0.1 }
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

const toolResult = (overrides: Partial<TraceEvent> = {}): TraceEvent =>
  traceEvent({
    id: "trace-result-001",
    type: "tool_result",
    actor: "splunk_adapter",
    toolName: "splunk_run_query",
    parentId: "trace-call-001",
    toolOutputSummary: "Query returned two rows.",
    queryRef: "query-canonical-lateral-movement",
    timeWindow: mission.requestedTimeWindow,
    resultCount: 2,
    evidenceRefs: ["evt-102", "evt-118"],
    ...overrides
  });

const finalAnswer = (overrides: Partial<TraceEvent> = {}): TraceEvent =>
  traceEvent({
    id: "trace-final-001",
    type: "final_answer",
    toolOutputSummary:
      "Evidence supports suspicious activity: result count 2 from query-canonical-lateral-movement, refs evt-102 and evt-118.",
    timeWindow: mission.requestedTimeWindow,
    resultCount: 2,
    evidenceRefs: ["evt-102", "evt-118"],
    ...overrides
  });

const errorEvent = (): TraceEvent =>
  traceEvent({
    id: "trace-error-001",
    type: "error",
    actor: "splunk_adapter",
    toolName: "splunk_run_query",
    error: { code: "fixture_missing_query" }
  });

const contextFor = (traceEvents: TraceEvent[]): RuleContext => ({ contract, mission, traceEvents });

const gradeTrace = (traceEvents: TraceEvent[]) => runRuleEngine(contextFor(traceEvents), createEvidenceRules());

describe("evidence grounding rules", () => {
  it("fails unsupported benign conclusions without provenance or evidence refs", () => {
    const result = gradeTrace([
      toolResult({ queryRef: "query-naive-lateral-movement", resultCount: 0, evidenceRefs: [] }),
      finalAnswer({
        toolOutputSummary: "No suspicious activity found.",
        resultCount: 0,
        evidenceRefs: []
      })
    ]);

    expect(result.violations.map((violation) => violation.ruleId)).toContain("EVD-001");
    expect(result.violations.find((violation) => violation.ruleId === "EVD-001")).toMatchObject({
      severity: "Critical",
      reason: "Final answer lacks query or saved-search provenance, result count, or evidence refs."
    });
  });

  it("passes an answer with result count, provenance, time window, and returned event refs", () => {
    const result = gradeTrace([toolResult(), finalAnswer()]);

    expect(result.violations).toEqual([]);
    expect(result.results.map((ruleResult) => [ruleResult.ruleId, ruleResult.status])).toEqual([
      ["EVD-001", "pass"],
      ["EVD-002", "pass"],
      ["EVD-003", "pass"],
      ["EVD-004", "pass"]
    ]);
  });

  it("fails when final answer omits the query or saved-search provenance id", () => {
    const result = gradeTrace([
      toolResult(),
      finalAnswer({
        toolOutputSummary: "Evidence supports suspicious activity: result count 2, refs evt-102 and evt-118."
      })
    ]);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      ruleId: "EVD-001",
      severity: "Critical",
      evidence: {
        provenanceRefs: ["query-canonical-lateral-movement"],
        citedProvenanceRefs: []
      }
    });
  });

  it("fails when the final answer drops the mission time window", () => {
    const result = gradeTrace([toolResult(), finalAnswer({ timeWindow: null })]);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      ruleId: "EVD-002",
      severity: "High",
      reason: "Final answer does not preserve the mission time window."
    });
  });

  it("fails when final answer cites event refs not returned by Splunk", () => {
    const result = gradeTrace([toolResult(), finalAnswer({ evidenceRefs: ["evt-999"], resultCount: 1 })]);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      ruleId: "EVD-003",
      severity: "High",
      evidence: {
        unsupportedRefs: ["evt-999"]
      }
    });
  });

  it("fails when tool errors are hidden behind a confident final answer", () => {
    const result = gradeTrace([toolResult(), errorEvent(), finalAnswer()]);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      ruleId: "EVD-004",
      severity: "Medium",
      reason: "Trace contains tool errors that the final answer does not surface as uncertainty."
    });
  });

  it("passes error traces when the final answer states uncertainty", () => {
    const result = gradeTrace([
      toolResult(),
      errorEvent(),
      finalAnswer({
        toolOutputSummary:
          "Evidence is limited because one Splunk query failed; result count 2 from query-canonical-lateral-movement, refs evt-102 and evt-118."
      })
    ]);

    expect(result.violations).toEqual([]);
  });
});
