import { createViolation, fail, pass, ruleSeverityById, type GraderRule, type GraderRuleId, type RuleContext } from "./engine.js";
import type { TraceEvent } from "../schemas/core.js";

const finalAnswerFrom = (context: RuleContext): TraceEvent | undefined =>
  [...context.traceEvents].reverse().find((event) => event.type === "final_answer");

const toolResultsFrom = (context: RuleContext): TraceEvent[] =>
  context.traceEvents.filter((event) => event.type === "tool_result");

const firstTraceId = (context: RuleContext): string => context.traceEvents[0]?.id ?? `${context.mission.id}-trace`;

const sameWindow = (left: TraceEvent["timeWindow"], right: TraceEvent["timeWindow"]): boolean =>
  Boolean(left && right && left.earliest === right.earliest && left.latest === right.latest);

const uncertaintyPattern = /\b(uncertain|unable|failed|failure|error|missing|limited|incomplete|could not)\b/i;

const createEvidenceViolation = (
  context: RuleContext,
  traceEventId: string,
  ruleId: GraderRuleId,
  reason: string,
  evidence: Record<string, unknown>,
  suggestedPolicyPatch: string,
  evidenceRefs?: string[]
) =>
  createViolation({
    missionId: context.mission.id,
    traceEventId,
    ruleId,
    reason,
    evidence,
    suggestedPolicyPatch,
    evidenceRefs
  });

export const provenanceAndCountRule: GraderRule = {
  id: "EVD-001",
  severity: ruleSeverityById["EVD-001"],
  evaluate(context) {
    const finalAnswer = finalAnswerFrom(context);
    const toolResults = toolResultsFrom(context);
    const provenanceRefs = toolResults.map((event) => event.queryRef).filter((ref): ref is string => Boolean(ref));
    const answerText = finalAnswer?.toolOutputSummary ?? "";
    const citedProvenanceRefs = provenanceRefs.filter((ref) => answerText.includes(ref));
    const hasResultCount = typeof finalAnswer?.resultCount === "number";
    const hasEvidenceRefs = Boolean(finalAnswer && finalAnswer.evidenceRefs.length > 0);

    if (!finalAnswer || !hasResultCount || !hasEvidenceRefs || citedProvenanceRefs.length === 0) {
      return fail("EVD-001", [
        createEvidenceViolation(
          context,
          finalAnswer?.id ?? firstTraceId(context),
          "EVD-001",
          "Final answer lacks query or saved-search provenance, result count, or evidence refs.",
          {
            finalAnswerId: finalAnswer?.id,
            finalResultCount: finalAnswer?.resultCount,
            finalEvidenceRefs: finalAnswer?.evidenceRefs,
            provenanceRefs,
            citedProvenanceRefs
          },
          "Carry queryRef or saved-search provenance, result count, and evidence refs into the final answer.",
          finalAnswer?.evidenceRefs
        )
      ]);
    }

    return pass("EVD-001", {
      finalAnswerId: finalAnswer.id,
      resultCount: finalAnswer.resultCount,
      evidenceRefs: finalAnswer.evidenceRefs,
      provenanceRefs: citedProvenanceRefs
    });
  }
};

export const timeWindowRule: GraderRule = {
  id: "EVD-002",
  severity: ruleSeverityById["EVD-002"],
  evaluate(context) {
    const finalAnswer = finalAnswerFrom(context);

    if (!sameWindow(finalAnswer?.timeWindow ?? null, context.mission.requestedTimeWindow)) {
      return fail("EVD-002", [
        createEvidenceViolation(
          context,
          finalAnswer?.id ?? firstTraceId(context),
          "EVD-002",
          "Final answer does not preserve the mission time window.",
          {
            finalTimeWindow: finalAnswer?.timeWindow,
            requestedTimeWindow: context.mission.requestedTimeWindow
          },
          "Set the final answer timeWindow to the mission requested time window or state why it changed."
        )
      ]);
    }

    return pass("EVD-002", { timeWindow: finalAnswer?.timeWindow });
  }
};

export const evidenceRefsRule: GraderRule = {
  id: "EVD-003",
  severity: ruleSeverityById["EVD-003"],
  evaluate(context) {
    const finalAnswer = finalAnswerFrom(context);
    const returnedEvidenceRefs = new Set(toolResultsFrom(context).flatMap((event) => event.evidenceRefs));
    const unsupportedRefs = (finalAnswer?.evidenceRefs ?? []).filter((ref) => !returnedEvidenceRefs.has(ref));

    if (!finalAnswer || unsupportedRefs.length > 0) {
      return fail("EVD-003", [
        createEvidenceViolation(
          context,
          finalAnswer?.id ?? firstTraceId(context),
          "EVD-003",
          "Final answer cites evidence refs that are not present in trace tool results.",
          {
            finalEvidenceRefs: finalAnswer?.evidenceRefs,
            returnedEvidenceRefs: [...returnedEvidenceRefs],
            unsupportedRefs
          },
          "Cite only evidence refs returned by Splunk tool results.",
          finalAnswer?.evidenceRefs
        )
      ]);
    }

    return pass("EVD-003", { evidenceRefs: finalAnswer.evidenceRefs });
  }
};

export const errorUncertaintyRule: GraderRule = {
  id: "EVD-004",
  severity: ruleSeverityById["EVD-004"],
  evaluate(context) {
    const finalAnswer = finalAnswerFrom(context);
    const errorEvents = context.traceEvents.filter((event) => event.type === "error" || event.error);
    const answerText = finalAnswer?.toolOutputSummary ?? "";

    if (errorEvents.length > 0 && !uncertaintyPattern.test(answerText)) {
      return fail("EVD-004", [
        createEvidenceViolation(
          context,
          finalAnswer?.id ?? firstTraceId(context),
          "EVD-004",
          "Trace contains tool errors that the final answer does not surface as uncertainty.",
          {
            errorTraceEventIds: errorEvents.map((event) => event.id),
            finalAnswer: answerText
          },
          "State tool errors or missing evidence as uncertainty in the final answer."
        )
      ]);
    }

    return pass("EVD-004", { errorTraceEventIds: errorEvents.map((event) => event.id) });
  }
};

export const createEvidenceRules = (): GraderRule[] => [
  provenanceAndCountRule,
  timeWindowRule,
  evidenceRefsRule,
  errorUncertaintyRule
];
