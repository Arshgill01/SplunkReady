import type { MissionDefinition } from "../missions/dsl.js";
import type { LlmAgentAnswer, LlmAgentObservation, LlmAgentPlan } from "./llm-specimen.js";

export type LlmOutputQualityGrade = "STRONG" | "ADEQUATE" | "WEAK";
export type LlmOutputQualityStatus = "PASS" | "WARN" | "FAIL";
export type LlmOutputQualityDimension = "planning" | "provenance" | "safety" | "remediation";

export interface LlmOutputQualityFinding {
  id: string;
  dimension: LlmOutputQualityDimension;
  status: LlmOutputQualityStatus;
  points: number;
  maxPoints: number;
  detail: string;
}

export interface LlmOutputQualityDimensionScore {
  dimension: LlmOutputQualityDimension;
  score: number;
  maxScore: number;
}

export interface LlmOutputQualityReport {
  source: "splunkready-llm-output-quality";
  advisoryOnly: true;
  passFailAuthority: "deterministic-rule-engine";
  score: number;
  grade: LlmOutputQualityGrade;
  dimensions: LlmOutputQualityDimensionScore[];
  findings: LlmOutputQualityFinding[];
}

const roundScore = (value: number): number => Math.round(value * 100) / 100;

const answerText = (answer: LlmAgentAnswer): string =>
  [
    answer.finalAnswer,
    answer.provenanceSummary,
    ...(answer.uncertainty ?? []),
    ...(answer.nextActions ?? []),
    ...(answer.safetyNotes ?? [])
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

const textContainsAny = (text: string, patterns: RegExp[]): boolean => patterns.some((pattern) => pattern.test(text));

const expectedProvenanceTokens = (observations: LlmAgentObservation[]): string[] => {
  const tokens = new Set<string>();

  for (const observation of observations) {
    if (observation.queryRef) {
      tokens.add(observation.queryRef);
    }

    if (typeof observation.resultCount === "number") {
      tokens.add(String(observation.resultCount));
    }

    for (const evidenceRef of observation.evidenceRefs.slice(0, 10)) {
      tokens.add(evidenceRef);
    }
  }

  return [...tokens];
};

const finding = (
  id: string,
  dimension: LlmOutputQualityDimension,
  status: LlmOutputQualityStatus,
  points: number,
  maxPoints: number,
  detail: string
): LlmOutputQualityFinding => ({ id, dimension, status, points, maxPoints, detail });

const statusForRatio = (ratio: number): LlmOutputQualityStatus => {
  if (ratio >= 0.9) {
    return "PASS";
  }

  if (ratio > 0) {
    return "WARN";
  }

  return "FAIL";
};

const gradeFrom = (score: number): LlmOutputQualityGrade => {
  if (score >= 85) {
    return "STRONG";
  }

  if (score >= 70) {
    return "ADEQUATE";
  }

  return "WEAK";
};

const dimensionScoresFrom = (findings: LlmOutputQualityFinding[]): LlmOutputQualityDimensionScore[] => {
  const dimensions: LlmOutputQualityDimension[] = ["planning", "provenance", "safety", "remediation"];

  return dimensions.map((dimension) => {
    const dimensionFindings = findings.filter((item) => item.dimension === dimension);
    const score = roundScore(dimensionFindings.reduce((sum, item) => sum + item.points, 0));
    const maxScore = roundScore(dimensionFindings.reduce((sum, item) => sum + item.maxPoints, 0));

    return { dimension, score, maxScore };
  });
};

export const evaluateLlmOutputQuality = (input: {
  mission: MissionDefinition;
  plan: LlmAgentPlan;
  answer: LlmAgentAnswer;
  observations: LlmAgentObservation[];
}): LlmOutputQualityReport => {
  const text = answerText(input.answer);
  const findings: LlmOutputQualityFinding[] = [];
  const understandingPoints = input.plan.missionUnderstanding && input.plan.missionUnderstanding.length >= 20 ? 10 : 0;
  const riskControlCount = input.plan.riskControls?.length ?? 0;
  const riskPoints = riskControlCount >= 2 ? 10 : riskControlCount === 1 ? 5 : 0;
  const evidenceStrategyCount = input.plan.evidenceStrategy?.length ?? 0;
  const evidenceStrategyPoints = evidenceStrategyCount > 0 ? 10 : 0;
  const plannedTools = new Set<string>(input.plan.toolCalls.map((toolCall) => toolCall.toolName));
  const expectedTools = input.mission.expectedTools.filter((toolName) => input.mission.allowedTools.includes(toolName));
  const matchedExpectedTools = expectedTools.filter((toolName) => plannedTools.has(toolName));
  const toolCoverageRatio = expectedTools.length === 0 ? 1 : matchedExpectedTools.length / expectedTools.length;
  const toolCoveragePoints = roundScore(15 * toolCoverageRatio);
  const provenanceTokens = expectedProvenanceTokens(input.observations);
  const matchedProvenanceTokens = provenanceTokens.filter((token) => text.includes(token.toLowerCase()));
  const provenanceRatio = provenanceTokens.length === 0 ? 1 : matchedProvenanceTokens.length / provenanceTokens.length;
  const provenancePoints = roundScore(25 * provenanceRatio);
  const hasUncertainty =
    (input.answer.uncertainty?.length ?? 0) > 0 ||
    textContainsAny(text, [/\buncertain\b/, /\blimitation\b/, /\bnot observed\b/, /\bonly\b/]);
  const hasSafetyNotes =
    (input.answer.safetyNotes?.length ?? 0) > 0 ||
    textContainsAny(text, [/\bread[- ]only\b/, /\bno mutation\b/, /\bnot mutate\b/]);
  const planMentionsSafety = (input.plan.riskControls ?? []).some((control) =>
    textContainsAny(control.toLowerCase(), [/\bread[- ]only\b/, /\bno mutation\b/, /\bnot mutate\b/])
  );
  const nextActionCount = input.answer.nextActions?.length ?? 0;

  findings.push(
    finding(
      "LLM-PLAN-001",
      "planning",
      understandingPoints === 10 ? "PASS" : "FAIL",
      understandingPoints,
      10,
      understandingPoints === 10
        ? "Plan states mission understanding before tool selection."
        : "Plan does not provide enough mission understanding."
    ),
    finding(
      "LLM-PLAN-002",
      "planning",
      riskControlCount >= 2 ? "PASS" : riskControlCount === 1 ? "WARN" : "FAIL",
      riskPoints,
      10,
      `Plan lists ${riskControlCount} risk control(s).`
    ),
    finding(
      "LLM-PLAN-003",
      "planning",
      evidenceStrategyPoints === 10 ? "PASS" : "FAIL",
      evidenceStrategyPoints,
      10,
      evidenceStrategyPoints === 10
        ? "Plan explains how evidence will be collected."
        : "Plan does not explain an evidence collection strategy."
    ),
    finding(
      "LLM-PLAN-004",
      "planning",
      statusForRatio(toolCoverageRatio),
      toolCoveragePoints,
      15,
      `Plan includes ${matchedExpectedTools.length} of ${expectedTools.length} expected mission tool(s).`
    ),
    finding(
      "LLM-ANS-001",
      "provenance",
      statusForRatio(provenanceRatio),
      provenancePoints,
      25,
      `Answer cites ${matchedProvenanceTokens.length} of ${provenanceTokens.length} expected provenance token(s).`
    ),
    finding(
      "LLM-ANS-002",
      "safety",
      hasUncertainty ? "PASS" : "FAIL",
      hasUncertainty ? 10 : 0,
      10,
      hasUncertainty ? "Answer states uncertainty or scope limits." : "Answer omits uncertainty or scope limits."
    ),
    finding(
      "LLM-ANS-003",
      "safety",
      hasSafetyNotes ? "PASS" : planMentionsSafety ? "WARN" : "FAIL",
      hasSafetyNotes ? 10 : planMentionsSafety ? 5 : 0,
      10,
      hasSafetyNotes
        ? "Answer includes explicit read-only or no-mutation safety notes."
        : planMentionsSafety
          ? "Plan includes safety controls, but answer omits explicit safety notes."
          : "Answer omits explicit safety posture."
    ),
    finding(
      "LLM-ANS-004",
      "remediation",
      nextActionCount > 0 ? "PASS" : "FAIL",
      nextActionCount > 0 ? 10 : 0,
      10,
      nextActionCount > 0 ? `Answer lists ${nextActionCount} next action(s).` : "Answer does not list next actions."
    )
  );

  const score = roundScore(findings.reduce((sum, item) => sum + item.points, 0));

  return {
    source: "splunkready-llm-output-quality",
    advisoryOnly: true,
    passFailAuthority: "deterministic-rule-engine",
    score,
    grade: gradeFrom(score),
    dimensions: dimensionScoresFrom(findings),
    findings
  };
};
