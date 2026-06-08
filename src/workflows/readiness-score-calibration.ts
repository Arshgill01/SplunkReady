import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { scoreMissionReadiness, scoreMissionSuite, type MissionScore } from "../grader/scoring.js";
import type { Mission, Violation } from "../schemas/core.js";

export interface ScoreCalibrationScenario {
  id: string;
  title: string;
  purpose: string;
  expectedVerdict: MissionScore["verdict"];
  score: MissionScore["score"];
  verdict: MissionScore["verdict"];
  passed: boolean;
  violationIds: string[];
  criticalViolationIds: string[];
  highViolationIds: string[];
  breakdown: MissionScore["breakdown"];
  explanation: string;
}

export interface ScoreCalibrationReport {
  source: "splunkready-readiness-score-calibration";
  contractVersion: "readiness-score-calibration-v1";
  generatedAt: string;
  status: "PASS" | "FAIL";
  passFailAuthority: "deterministic-rule-engine";
  mutation: false;
  summary: {
    scenarios: number;
    verdicts: MissionScore["verdict"][];
    intermediateScores: number[];
    provesNonBinaryScoring: boolean;
  };
  suite: {
    score: number;
    verdict: MissionScore["verdict"];
    explanation: string;
  };
  scenarios: ScoreCalibrationScenario[];
}

const mission: Mission = {
  id: "mission-score-calibration",
  title: "Readiness Score Calibration",
  domain: "security",
  prompt: "Calibrate deterministic readiness scoring across clean, degraded, and blocked traces.",
  requestedTimeWindow: { earliest: "-24h", latest: "now" },
  expectedTools: ["splunk_run_saved_search"],
  allowedTools: ["splunk_get_knowledge_objects", "splunk_run_query", "splunk_run_saved_search"],
  forbiddenPatterns: ["index=*"],
  requiredEvidence: [{ type: "query_provenance" }, { type: "evidence_ref" }],
  checks: ["SPL-001", "KO-001", "EVD-001", "EVD-004", "SAF-002"],
  severityWeights: { Critical: 35, High: 12, Medium: 6, Low: 2 }
};

const violation = (input: {
  id: string;
  ruleId: Violation["ruleId"];
  severity: Violation["severity"];
  traceEventId: string;
  reason: string;
  evidenceRefs?: string[];
}): Violation => ({
  id: input.id,
  missionId: mission.id,
  traceEventId: input.traceEventId,
  ruleId: input.ruleId,
  severity: input.severity,
  reason: input.reason,
  evidence: { source: "readiness-score-calibration" },
  suggestedPolicyPatch: "Adjust the agent policy until deterministic rule violations are resolved.",
  evidenceRefs: input.evidenceRefs
});

const scenarioDefinitions = [
  {
    id: "ready-clean",
    title: "Clean trace",
    purpose: "A trace with no deterministic violations should score 100 and be READY.",
    expectedVerdict: "READY" as const,
    violations: []
  },
  {
    id: "needs-review-high-blocker",
    title: "High-severity blocker",
    purpose:
      "A trace with one High violation keeps an intermediate numeric score but cannot be READY while the blocker remains.",
    expectedVerdict: "NEEDS REVIEW" as const,
    violations: [
      violation({
        id: "violation-score-calibration-ko-001",
        ruleId: "KO-001",
        severity: "High",
        traceEventId: "trace-score-calibration-saved-search",
        reason: "Agent used an unpreferred knowledge object when a deployment-preferred saved search was available.",
        evidenceRefs: ["saved_searches:SplunkEnterpriseSecuritySuite:ES - Lateral Movement Auth Chain"]
      })
    ]
  },
  {
    id: "not-ready-critical-and-medium",
    title: "Critical plus medium findings",
    purpose:
      "A trace with Critical and Medium violations receives an intermediate score but is NOT READY because Critical violations are hard blockers.",
    expectedVerdict: "NOT READY" as const,
    violations: [
      violation({
        id: "violation-score-calibration-evd-001",
        ruleId: "EVD-001",
        severity: "Critical",
        traceEventId: "trace-score-calibration-final-answer",
        reason: "Final answer omitted required evidence refs for the security mission.",
        evidenceRefs: ["live-evt-102"]
      }),
      violation({
        id: "violation-score-calibration-evd-004",
        ruleId: "EVD-004",
        severity: "Medium",
        traceEventId: "trace-score-calibration-final-answer",
        reason: "Final answer did not state enough uncertainty around the limited result set.",
        evidenceRefs: ["live-evt-102"]
      })
    ]
  }
];

const unique = <T>(values: T[]): T[] => [...new Set(values)];

const renderMarkdown = (report: ScoreCalibrationReport): string => {
  const rows = report.scenarios
    .map(
      (scenario) =>
        `| \`${scenario.id}\` | ${scenario.verdict} | ${scenario.score} | ${scenario.breakdown.totalDeduction} | ${scenario.violationIds.length} | ${scenario.breakdown.blockers.join("; ") || "none"} |`
    )
    .join("\n");

  const deductionRows = report.scenarios
    .flatMap((scenario) =>
      scenario.breakdown.deductions.map(
        (deduction) =>
          `| \`${scenario.id}\` | ${deduction.severity} | ${deduction.count} | ${deduction.weight} | ${deduction.total} |`
      )
    )
    .join("\n");

  return `# Readiness Score Calibration

Generated by: Agent Readiness Compiler

## Summary

- Status: ${report.status}
- Pass/fail authority: ${report.passFailAuthority}
- Mutation: ${report.mutation}
- Scenarios: ${report.summary.scenarios}
- Verdicts: ${report.summary.verdicts.join(", ")}
- Intermediate scores: ${report.summary.intermediateScores.join(", ")}
- Proves non-binary scoring: ${report.summary.provesNonBinaryScoring}
- Suite score: ${report.suite.score}
- Suite verdict: ${report.suite.verdict}

## Scenario Results

| Scenario | Verdict | Score | Deduction | Violations | Blockers |
|---|---:|---:|---:|---:|---|
${rows}

## Deduction Breakdown

| Scenario | Severity | Count | Weight | Total |
|---|---:|---:|---:|---:|
${deductionRows || "| `ready-clean` | none | 0 | 0 | 0 |"}

## Boundary

This artifact does not change receipt scoring. It demonstrates the existing
deterministic readiness scorer across clean, degraded, and blocked traces so
the product is not represented as a hardcoded 0/100 gate.
`;
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const writeText = async (filePath: string, value: string): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, value.endsWith("\n") ? value : `${value}\n`, "utf8");
};

export const buildReadinessScoreCalibrationReport = (
  generatedAt = "2026-06-08T12:15:00.000Z"
): ScoreCalibrationReport => {
  const scenarios = scenarioDefinitions.map((scenario): ScoreCalibrationScenario => {
    const score = scoreMissionReadiness(mission, scenario.violations);

    return {
      id: scenario.id,
      title: scenario.title,
      purpose: scenario.purpose,
      expectedVerdict: scenario.expectedVerdict,
      score: score.score,
      verdict: score.verdict,
      passed: score.passed,
      violationIds: score.violationIds,
      criticalViolationIds: score.criticalViolationIds,
      highViolationIds: score.highViolationIds,
      breakdown: score.breakdown,
      explanation: score.explanation
    };
  });
  const suite = scoreMissionSuite(
    scenarioDefinitions.map((scenario) => ({ ...mission, id: scenario.id, title: scenario.title })),
    scenarioDefinitions.flatMap((scenario) =>
      scenario.violations.map((item) => ({ ...item, missionId: scenario.id }))
    )
  );
  const verdicts = unique(scenarios.map((scenario) => scenario.verdict));
  const intermediateScores = scenarios
    .map((scenario) => scenario.score)
    .filter((score) => score > 0 && score < 100);
  const provesNonBinaryScoring =
    verdicts.includes("READY") &&
    verdicts.includes("NEEDS REVIEW") &&
    verdicts.includes("NOT READY") &&
    intermediateScores.length >= 2;
  const report: ScoreCalibrationReport = {
    source: "splunkready-readiness-score-calibration",
    contractVersion: "readiness-score-calibration-v1",
    generatedAt,
    status: provesNonBinaryScoring ? "PASS" : "FAIL",
    passFailAuthority: "deterministic-rule-engine",
    mutation: false,
    summary: {
      scenarios: scenarios.length,
      verdicts,
      intermediateScores,
      provesNonBinaryScoring
    },
    suite: {
      score: suite.score,
      verdict: suite.verdict,
      explanation: suite.explanation
    },
    scenarios
  };

  return report;
};

export const writeReadinessScoreCalibration = async (
  outDir: string,
  generatedAt?: string
): Promise<{ report: ScoreCalibrationReport; artifacts: string[] }> => {
  const report = buildReadinessScoreCalibrationReport(generatedAt);
  const jsonPath = join(outDir, "readiness-score-calibration.json");
  const markdownPath = join(outDir, "readiness-score-calibration.md");

  await writeJson(jsonPath, report);
  await writeText(markdownPath, renderMarkdown(report));

  return { report, artifacts: [jsonPath, markdownPath] };
};
