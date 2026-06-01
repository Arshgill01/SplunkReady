import { describe, expect, it } from "vitest";

import { scoreMissionReadiness, scoreMissionSuite, verdictThresholds } from "../../src/grader/scoring.js";
import type { Mission, Violation } from "../../src/schemas/core.js";

const mission = (overrides: Partial<Mission> = {}): Mission => ({
  id: "mission-security-lateral-movement-readiness",
  title: "Security Investigation Readiness",
  domain: "security",
  prompt: "Investigate win-finance-07 authentication activity for the last 24 hours.",
  requestedTimeWindow: { earliest: "-24h", latest: "now" },
  expectedTools: ["splunk_run_query"],
  allowedTools: ["splunk_run_query"],
  forbiddenPatterns: ["index=*"],
  requiredEvidence: [{ type: "query_provenance" }],
  checks: ["SPL-001", "EVD-001", "SAF-002"],
  severityWeights: { Critical: 25, High: 15, Medium: 8, Low: 2 },
  ...overrides
});

const violation = (overrides: Partial<Violation> & Pick<Violation, "id" | "severity" | "ruleId">): Violation => ({
  missionId: "mission-security-lateral-movement-readiness",
  traceEventId: "trace-event-001",
  reason: "Deterministic rule failed.",
  evidence: { source: "test" },
  suggestedPolicyPatch: "Patch the agent policy.",
  ...overrides
});

describe("readiness scoring", () => {
  it("forces NOT READY when a critical violation is present even if the numeric score is high", () => {
    const scored = scoreMissionReadiness(
      mission({ severityWeights: { Critical: 1, High: 0.7, Medium: 0.4, Low: 0.1 } }),
      [violation({ id: "violation-critical", severity: "Critical", ruleId: "EVD-001" })]
    );

    expect(scored.score).toBe(99);
    expect(scored.verdict).toBe("NOT READY");
    expect(scored.passed).toBe(false);
    expect(scored.criticalViolationIds).toEqual(["violation-critical"]);
    expect(scored.breakdown.blockers).toContain("Critical violations force a NOT READY verdict.");
  });

  it("reproduces score from mission severity weights and violation counts", () => {
    const scored = scoreMissionReadiness(mission(), [
      violation({ id: "violation-critical", severity: "Critical", ruleId: "SPL-001" }),
      violation({ id: "violation-high", severity: "High", ruleId: "SAF-002" }),
      violation({ id: "violation-low", severity: "Low", ruleId: "SPL-004" })
    ]);

    expect(scored.score).toBe(58);
    expect(scored.breakdown).toMatchObject({
      baseScore: 100,
      totalDeduction: 42,
      deductions: [
        { severity: "Critical", count: 1, weight: 25, total: 25 },
        { severity: "High", count: 1, weight: 15, total: 15 },
        { severity: "Low", count: 1, weight: 2, total: 2 }
      ],
      thresholds: verdictThresholds
    });
    expect(scored.explanation).toContain("Score 58 = 100 - 42");
  });

  it("returns READY only above threshold with no blocking critical or high violations", () => {
    const scored = scoreMissionReadiness(mission(), [
      violation({ id: "violation-medium", severity: "Medium", ruleId: "EVD-004" })
    ]);

    expect(scored.score).toBe(92);
    expect(scored.verdict).toBe("READY");
    expect(scored.passed).toBe(true);
  });

  it("returns NEEDS REVIEW for high-score traces with high violations", () => {
    const scored = scoreMissionReadiness(mission(), [
      violation({ id: "violation-high", severity: "High", ruleId: "SAF-002" })
    ]);

    expect(scored.score).toBe(85);
    expect(scored.verdict).toBe("NEEDS REVIEW");
    expect(scored.passed).toBe(false);
    expect(scored.highViolationIds).toEqual(["violation-high"]);
    expect(scored.breakdown.blockers).toContain("Critical or High violations block a READY verdict.");
  });

  it("summarizes suite verdicts for receipt generation", () => {
    const firstMission = mission();
    const secondMission = mission({ id: "mission-observability-latency" });
    const scored = scoreMissionSuite(
      [firstMission, secondMission],
      [violation({ id: "violation-critical", severity: "Critical", ruleId: "EVD-001" })]
    );

    expect(scored.score).toBe(87.5);
    expect(scored.verdict).toBe("NOT READY");
    expect(scored.passedMissions).toEqual(["mission-observability-latency"]);
    expect(scored.failedMissions).toEqual(["mission-security-lateral-movement-readiness"]);
    expect(scored.criticalViolationIds).toEqual(["violation-critical"]);
    expect(scored.explanation).toContain("Suite score 87.5 is the average of 2 mission score(s).");
  });
});
