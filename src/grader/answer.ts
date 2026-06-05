import { createViolation, fail, pass, ruleSeverityById, type GraderRule, type RuleContext } from "./engine.js";
import type { TraceEvent } from "../schemas/core.js";

const finalAnswerFrom = (context: RuleContext): TraceEvent | undefined =>
  [...context.traceEvents].reverse().find((event) => event.type === "final_answer");

const firstTraceId = (context: RuleContext): string => context.traceEvents[0]?.id ?? `${context.mission.id}-trace`;

const unsupportedBenignPattern = /\b(no evidence|nothing suspicious|no suspicious|benign|clear|not found|no signs)\b/i;
const uncertaintyPattern = /\b(uncertain|insufficient|incomplete|limited|could not|unable|missing)\b/i;
const genericAnswerStopWords = new Set([
  "about",
  "activity",
  "agent",
  "available",
  "certify",
  "cite",
  "counts",
  "evidence",
  "from",
  "identify",
  "include",
  "investigate",
  "last",
  "over",
  "possible",
  "readiness",
  "ready",
  "references",
  "result",
  "results",
  "splunk",
  "the",
  "use",
  "using",
  "validated",
  "where",
  "with"
]);

const missionKeywordMinimum = 2;

export const supportedConclusionRule: GraderRule = {
  id: "ANS-001",
  severity: ruleSeverityById["ANS-001"],
  evaluate(context) {
    const finalAnswer = finalAnswerFrom(context);
    const answerText = finalAnswer?.toolOutputSummary ?? "";
    const resultCount = finalAnswer?.resultCount ?? null;
    const evidenceRefs = finalAnswer?.evidenceRefs ?? [];
    const unsupportedBenignConclusion =
      unsupportedBenignPattern.test(answerText) &&
      !uncertaintyPattern.test(answerText) &&
      (resultCount === null || resultCount === 0 || evidenceRefs.length === 0);

    if (!finalAnswer || unsupportedBenignConclusion) {
      return fail("ANS-001", [
        createViolation({
          missionId: context.mission.id,
          traceEventId: finalAnswer?.id ?? firstTraceId(context),
          ruleId: "ANS-001",
          reason: "Definitive benign conclusion is not supported by adequate evidence.",
          evidence: {
            finalAnswerId: finalAnswer?.id,
            finalAnswer: answerText,
            resultCount,
            evidenceRefs
          },
          suggestedPolicyPatch:
            "Do not give a definitive benign or true-positive conclusion unless the answer cites adequate result count, provenance, and evidence refs.",
          evidenceRefs
        })
      ]);
    }

    return pass("ANS-001", {
      finalAnswerId: finalAnswer.id,
      resultCount,
      evidenceRefs
    });
  }
};

const answerTextFrom = (context: RuleContext): string => finalAnswerFrom(context)?.toolOutputSummary ?? "";

const missingEvidenceSignals = (context: RuleContext): string[] => {
  const finalAnswer = finalAnswerFrom(context);
  const toolErrors = context.traceEvents.filter((event) => event.type === "error" || event.error);
  const toolResults = context.traceEvents.filter((event) => event.type === "tool_result");
  const missingSignals: string[] = [];

  if (!finalAnswer) {
    return ["missing-final-answer"];
  }

  if (toolErrors.length > 0) {
    missingSignals.push("tool-error");
  }

  if (typeof finalAnswer.resultCount !== "number") {
    missingSignals.push("missing-result-count");
  }

  if (finalAnswer.evidenceRefs.length === 0) {
    missingSignals.push("missing-evidence-refs");
  }

  if (finalAnswer.resultCount === 0 && finalAnswer.evidenceRefs.length === 0) {
    missingSignals.push("zero-results-without-evidence");
  }

  if (toolResults.some((event) => event.resultCount === 0 && event.evidenceRefs.length === 0)) {
    missingSignals.push("empty-tool-result");
  }

  return [...new Set(missingSignals)];
};

export const uncertaintyWhenEvidenceIncompleteRule: GraderRule = {
  id: "ANS-002",
  severity: ruleSeverityById["ANS-002"],
  evaluate(context) {
    const finalAnswer = finalAnswerFrom(context);
    const missingSignals = missingEvidenceSignals(context);
    const answerText = answerTextFrom(context);

    if (missingSignals.length > 0 && !uncertaintyPattern.test(answerText)) {
      return fail("ANS-002", [
        createViolation({
          missionId: context.mission.id,
          traceEventId: finalAnswer?.id ?? firstTraceId(context),
          ruleId: "ANS-002",
          reason: "Final answer does not admit uncertainty when evidence is incomplete.",
          evidence: {
            missingSignals,
            finalAnswerId: finalAnswer?.id,
            finalAnswer: answerText
          },
          suggestedPolicyPatch:
            "When result counts, evidence refs, or tool calls are missing or empty, state uncertainty instead of presenting the answer as complete.",
          evidenceRefs: finalAnswer?.evidenceRefs
        })
      ]);
    }

    return pass("ANS-002", {
      missingSignals,
      admittedUncertainty: missingSignals.length > 0 ? uncertaintyPattern.test(answerText) : false
    });
  }
};

const missionKeywordsFrom = (context: RuleContext): string[] => {
  const text = `${context.mission.title} ${context.mission.prompt} ${context.mission.domain}`;
  const rawTokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !genericAnswerStopWords.has(token));

  return [...new Set(rawTokens)].slice(0, 12);
};

export const missionAddressedRule: GraderRule = {
  id: "ANS-003",
  severity: ruleSeverityById["ANS-003"],
  evaluate(context) {
    const finalAnswer = finalAnswerFrom(context);
    const answerText = answerTextFrom(context).toLowerCase();
    const missionKeywords = missionKeywordsFrom(context);
    const matchedKeywords = missionKeywords.filter((keyword) => answerText.includes(keyword));

    if (!finalAnswer || matchedKeywords.length < Math.min(missionKeywordMinimum, missionKeywords.length)) {
      return fail("ANS-003", [
        createViolation({
          missionId: context.mission.id,
          traceEventId: finalAnswer?.id ?? firstTraceId(context),
          ruleId: "ANS-003",
          reason: "Final answer does not address the requested mission.",
          evidence: {
            missionKeywords,
            matchedKeywords,
            finalAnswerId: finalAnswer?.id,
            finalAnswer: finalAnswer?.toolOutputSummary
          },
          suggestedPolicyPatch:
            "Tie the final answer back to the mission subject, target entity, and requested investigation instead of returning generic troubleshooting text.",
          evidenceRefs: finalAnswer?.evidenceRefs
        })
      ]);
    }

    return pass("ANS-003", { missionKeywords, matchedKeywords });
  }
};

export const createAnswerRules = (): GraderRule[] => [
  supportedConclusionRule,
  uncertaintyWhenEvidenceIncompleteRule,
  missionAddressedRule
];
