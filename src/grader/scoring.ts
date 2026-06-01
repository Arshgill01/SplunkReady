import type { Mission, Violation } from "../schemas/core.js";

type Severity = Violation["severity"];

export type ReadinessVerdict = "READY" | "NEEDS REVIEW" | "NOT READY";

export const verdictThresholds = {
  readyMinimumScore: 90,
  reviewMinimumScore: 75,
  readyBlockedBySeverities: ["Critical", "High"] as Severity[],
  notReadyBlockedBySeverities: ["Critical"] as Severity[]
};

export interface SeverityDeduction {
  severity: Severity;
  count: number;
  weight: number;
  total: number;
}

export interface ScoreBreakdown {
  baseScore: number;
  deductions: SeverityDeduction[];
  totalDeduction: number;
  score: number;
  thresholds: typeof verdictThresholds;
  blockers: string[];
}

export interface MissionScore {
  missionId: string;
  score: number;
  verdict: ReadinessVerdict;
  passed: boolean;
  violationIds: string[];
  criticalViolationIds: string[];
  highViolationIds: string[];
  breakdown: ScoreBreakdown;
  explanation: string;
}

export interface MissionSuiteScore {
  score: number;
  verdict: ReadinessVerdict;
  passedMissions: string[];
  failedMissions: string[];
  criticalViolationIds: string[];
  missionScores: MissionScore[];
  explanation: string;
}

const severityOrder: Severity[] = ["Critical", "High", "Medium", "Low"];

const roundScore = (value: number): number => Math.round(value * 100) / 100;

const clampScore = (value: number): number => Math.max(0, Math.min(100, roundScore(value)));

const severityCountsFrom = (violations: Violation[]): Map<Severity, number> => {
  const counts = new Map<Severity, number>();

  for (const violation of violations) {
    counts.set(violation.severity, (counts.get(violation.severity) ?? 0) + 1);
  }

  return counts;
};

const deductionsFrom = (mission: Mission, violations: Violation[]): SeverityDeduction[] => {
  const counts = severityCountsFrom(violations);

  return severityOrder
    .map((severity) => {
      const count = counts.get(severity) ?? 0;
      const weight = mission.severityWeights[severity] ?? 0;

      return { severity, count, weight, total: roundScore(count * weight) };
    })
    .filter((deduction) => deduction.count > 0);
};

const blockerReasonsFrom = (score: number, violations: Violation[]): string[] => {
  const severities = new Set(violations.map((violation) => violation.severity));
  const blockers: string[] = [];

  if (verdictThresholds.notReadyBlockedBySeverities.some((severity) => severities.has(severity))) {
    blockers.push("Critical violations force a NOT READY verdict.");
  }

  if (verdictThresholds.readyBlockedBySeverities.some((severity) => severities.has(severity))) {
    blockers.push("Critical or High violations block a READY verdict.");
  }

  if (score < verdictThresholds.reviewMinimumScore) {
    blockers.push(`Score ${score} is below the review threshold ${verdictThresholds.reviewMinimumScore}.`);
  }

  return blockers;
};

const verdictFrom = (score: number, violations: Violation[]): ReadinessVerdict => {
  const severities = new Set(violations.map((violation) => violation.severity));
  const hasNotReadyBlocker = verdictThresholds.notReadyBlockedBySeverities.some((severity) =>
    severities.has(severity)
  );
  const hasReadyBlocker = verdictThresholds.readyBlockedBySeverities.some((severity) => severities.has(severity));

  if (hasNotReadyBlocker || score < verdictThresholds.reviewMinimumScore) {
    return "NOT READY";
  }

  if (hasReadyBlocker || score < verdictThresholds.readyMinimumScore) {
    return "NEEDS REVIEW";
  }

  return "READY";
};

const formatDeductions = (deductions: SeverityDeduction[]): string =>
  deductions.length === 0
    ? "no deductions"
    : deductions
        .map((deduction) => `${deduction.count} ${deduction.severity} x ${deduction.weight} = ${deduction.total}`)
        .join("; ");

const missionViolations = (mission: Mission, violations: Violation[]): Violation[] =>
  violations.filter((violation) => violation.missionId === mission.id);

export const scoreMissionReadiness = (mission: Mission, violations: Violation[]): MissionScore => {
  const relevantViolations = missionViolations(mission, violations);
  const deductions = deductionsFrom(mission, relevantViolations);
  const totalDeduction = roundScore(deductions.reduce((sum, deduction) => sum + deduction.total, 0));
  const score = clampScore(100 - totalDeduction);
  const verdict = verdictFrom(score, relevantViolations);
  const breakdown: ScoreBreakdown = {
    baseScore: 100,
    deductions,
    totalDeduction,
    score,
    thresholds: verdictThresholds,
    blockers: blockerReasonsFrom(score, relevantViolations)
  };

  return {
    missionId: mission.id,
    score,
    verdict,
    passed: verdict === "READY",
    violationIds: relevantViolations.map((violation) => violation.id),
    criticalViolationIds: relevantViolations
      .filter((violation) => violation.severity === "Critical")
      .map((violation) => violation.id),
    highViolationIds: relevantViolations.filter((violation) => violation.severity === "High").map((violation) => violation.id),
    breakdown,
    explanation: `Score ${score} = 100 - ${totalDeduction}; deductions: ${formatDeductions(deductions)}. Verdict: ${verdict}.`
  };
};

const suiteVerdictFrom = (missionScores: MissionScore[], score: number): ReadinessVerdict => {
  if (missionScores.some((missionScore) => missionScore.verdict === "NOT READY")) {
    return "NOT READY";
  }

  if (missionScores.some((missionScore) => missionScore.verdict === "NEEDS REVIEW")) {
    return "NEEDS REVIEW";
  }

  return score >= verdictThresholds.readyMinimumScore ? "READY" : "NEEDS REVIEW";
};

export const scoreMissionSuite = (missions: Mission[], violations: Violation[]): MissionSuiteScore => {
  const missionScores = missions.map((mission) => scoreMissionReadiness(mission, violations));
  const score =
    missionScores.length === 0
      ? 0
      : clampScore(missionScores.reduce((sum, missionScore) => sum + missionScore.score, 0) / missionScores.length);
  const verdict = suiteVerdictFrom(missionScores, score);

  return {
    score,
    verdict,
    passedMissions: missionScores.filter((missionScore) => missionScore.passed).map((missionScore) => missionScore.missionId),
    failedMissions: missionScores.filter((missionScore) => !missionScore.passed).map((missionScore) => missionScore.missionId),
    criticalViolationIds: missionScores.flatMap((missionScore) => missionScore.criticalViolationIds),
    missionScores,
    explanation: `Suite score ${score} is the average of ${missionScores.length} mission score(s). Verdict: ${verdict}.`
  };
};
