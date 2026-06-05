import { describe, expect, it } from "vitest";

import { generateReadinessReceipt } from "../../src/receipts/generator.js";
import { readinessReceiptSchema, type EnvironmentContract, type Mission, type TraceEvent, type Violation } from "../../src/schemas/core.js";

const environment: EnvironmentContract = {
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
  savedSearches: [{ name: "ES - Lateral Movement Auth Chain", app: "SplunkEnterpriseSecuritySuite" }],
  dashboardPanels: [],
  dataModels: [],
  appContexts: ["SplunkEnterpriseSecuritySuite", "search"],
  mcpTools: ["splunk_run_query", "splunk_run_saved_search"],
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
  allowedTools: ["splunk_run_query", "splunk_run_saved_search"],
  forbiddenPatterns: ["index=*"],
  requiredEvidence: [{ type: "query_provenance" }],
  checks: ["SPL-001", "EVD-001", "SAF-002"],
  severityWeights: { Critical: 25, High: 15, Medium: 8, Low: 2 }
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

const traceEvents: TraceEvent[] = [
  traceEvent({
    id: "trace-query-result",
    type: "tool_result",
    actor: "splunk_adapter",
    toolName: "splunk_run_query",
    parentId: "trace-query-call",
    queryRef: "query-naive-lateral-movement",
    resultCount: 0,
    evidenceRefs: ["evt-102"]
  }),
  traceEvent({
    id: "trace-final-answer",
    type: "final_answer",
    toolOutputSummary: "No evidence of lateral movement was found.",
    resultCount: 0,
    evidenceRefs: []
  })
];

const violation = (overrides: Partial<Violation> & Pick<Violation, "id" | "ruleId" | "severity">): Violation => ({
  missionId: mission.id,
  traceEventId: "trace-final-answer",
  reason: "Final answer lacks query or saved-search provenance.",
  evidence: { finalAnswerId: "trace-final-answer" },
  suggestedPolicyPatch: "Carry query provenance, result count, and evidence refs into the final answer.",
  evidenceRefs: ["evt-102"],
  ...overrides
});

const receiptInput = {
  id: "receipt-before-001",
  agent: { name: "Naive SOC MCP Agent", version: "0.1.0" },
  environment,
  missionSuiteVersion: "security-readiness-1",
  missions: [mission],
  traceEvents,
  violations: [
    violation({ id: "violation-evd-001", ruleId: "EVD-001", severity: "Critical" }),
    violation({
      id: "violation-saf-002",
      ruleId: "SAF-002",
      severity: "High",
      reason: "Trace exceeds the compiled tool-call budget."
    })
  ],
  policyPatchSummary: [{ id: "patch-security-readiness", status: "exported" }],
  rerunComparison: {
    beforeScore: 60,
    afterScore: 92,
    beforeVerdict: "NOT READY",
    afterVerdict: "READY",
    resolvedViolations: ["violation-evd-001", "violation-saf-002"]
  }
};

describe("readiness receipt generator", () => {
  it("generates schema-valid JSON receipt fields from score, violations, traces, and policy patches", () => {
    const generated = generateReadinessReceipt(receiptInput);

    expect(readinessReceiptSchema.safeParse(generated.receipt).success).toBe(true);
    expect(generated.receipt).toMatchObject({
      id: "receipt-before-001",
      agent: { name: "Naive SOC MCP Agent", version: "0.1.0" },
      environment: { id: "contract-acme-soc-dev", name: "ACME SOC Dev" },
      mode: "fixture",
      contractVersion: "2026.06.01",
      missionSuiteVersion: "security-readiness-1",
      verdict: "NOT READY",
      score: 60,
      passedMissions: [],
      failedMissions: ["mission-security-lateral-movement-readiness"],
      criticalViolations: ["violation-evd-001"],
      violations: ["violation-evd-001", "violation-saf-002"],
      traceRefs: ["trace-query-result", "trace-final-answer"],
      evidenceRefs: ["evt-102"],
      policyPatchSummary: [{ id: "patch-security-readiness", status: "exported" }]
    });
    expect(JSON.parse(generated.json)).toEqual(generated.receipt);
  });

  it("renders a Markdown receipt with readable critical issues and score explanation", () => {
    const { markdown } = generateReadinessReceipt(receiptInput);

    expect(markdown).toContain("# Readiness Receipt: receipt-before-001");
    expect(markdown).toContain("Generated by: Agent Readiness Compiler");
    expect(markdown).toContain("- Verdict: NOT READY");
    expect(markdown).toContain("- Score: 60");
    expect(markdown).toContain("Suite score 60 is the average of 1 mission score(s).");
    expect(markdown).toContain(
      "`violation-evd-001` (EVD-001) on trace `trace-final-answer`: Final answer lacks query or saved-search provenance."
    );
    expect(markdown).toContain("`violation-saf-002` High SAF-002, trace `trace-final-answer`");
    expect(markdown).not.toContain("dashboard export");
  });

  it("keeps receipt provenance complete for trace, evidence, and violation claims", () => {
    const { markdown, receipt } = generateReadinessReceipt(receiptInput);

    for (const traceRef of receipt.traceRefs) {
      expect(markdown).toContain(`\`${traceRef}\``);
    }

    for (const evidenceRef of receipt.evidenceRefs) {
      expect(markdown).toContain(`\`${evidenceRef}\``);
    }

    for (const violationRef of receipt.violations) {
      expect(markdown).toContain(`\`${violationRef}\``);
    }
  });

  it("renders before and after rerun support", () => {
    const { markdown } = generateReadinessReceipt(receiptInput);

    expect(markdown).toContain('"beforeScore": 60');
    expect(markdown).toContain('"afterScore": 92');
    expect(markdown).toContain('"afterVerdict": "READY"');
    expect(markdown).toContain('"resolvedViolations"');
  });

  it("discloses live mode without changing receipt scoring or verdict semantics", () => {
    const fixtureReceipt = generateReadinessReceipt(receiptInput).receipt;
    const liveReceipt = generateReadinessReceipt({
      ...receiptInput,
      environment: { ...environment, mode: "live" }
    }).receipt;

    expect(liveReceipt.mode).toBe("live");
    expect(liveReceipt.verdict).toBe(fixtureReceipt.verdict);
    expect(liveReceipt.score).toBe(fixtureReceipt.score);
    expect(liveReceipt.passedMissions).toEqual(fixtureReceipt.passedMissions);
    expect(liveReceipt.failedMissions).toEqual(fixtureReceipt.failedMissions);
    expect(liveReceipt.violations).toEqual(fixtureReceipt.violations);
    expect(liveReceipt.criticalViolations).toEqual(fixtureReceipt.criticalViolations);
  });
});
