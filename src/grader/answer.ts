import { createViolation, fail, pass, ruleSeverityById, type GraderRule, type RuleContext } from "./engine.js";
import type { TraceEvent } from "../schemas/core.js";

const finalAnswerFrom = (context: RuleContext): TraceEvent | undefined =>
  [...context.traceEvents].reverse().find((event) => event.type === "final_answer");

const firstTraceId = (context: RuleContext): string => context.traceEvents[0]?.id ?? `${context.mission.id}-trace`;

const unsupportedBenignPattern = /\b(no evidence|nothing suspicious|no suspicious|benign|clear|not found|no signs)\b/i;
const uncertaintyPattern = /\b(uncertain|insufficient|incomplete|limited|could not|unable|missing)\b/i;

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

export const createAnswerRules = (): GraderRule[] => [supportedConclusionRule];
