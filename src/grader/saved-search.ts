import { createViolation, fail, pass, ruleSeverityById, type GraderRule, type RuleContext } from "./engine.js";
import type { TraceEvent } from "../schemas/core.js";

const isToolCall = (event: TraceEvent, toolName: string): boolean =>
  event.type === "tool_call" && event.toolName === toolName;

const eventRefFromInput = (input: Record<string, unknown> | null): string | undefined => {
  if (!input) {
    return undefined;
  }

  const savedSearchRef = input["savedSearchRef"];

  if (typeof savedSearchRef === "string") {
    return savedSearchRef;
  }

  const app = input["app"];
  const name = input["name"] ?? input["saved_search_name"];

  return typeof app === "string" && typeof name === "string" ? `${app}::${name}` : undefined;
};

const firstTraceId = (context: RuleContext): string => context.traceEvents[0]?.id ?? `${context.mission.id}-trace`;

const createKnowledgeViolation = (
  context: RuleContext,
  traceEventId: string,
  reason: string,
  evidence: Record<string, unknown>,
  suggestedPolicyPatch: string,
  contractRef?: string,
  evidenceRefs?: string[]
) =>
  createViolation({
    missionId: context.mission.id,
    traceEventId,
    ruleId: "KO-001",
    reason,
    evidence,
    suggestedPolicyPatch,
    contractRef,
    evidenceRefs
  });

export const savedSearchDiscoveryRule: GraderRule = {
  id: "KO-001",
  severity: ruleSeverityById["KO-001"],
  evaluate(context) {
    const preferredRefs = context.mission.preferredSavedSearchRefs ?? [];

    if (preferredRefs.length === 0) {
      return pass("KO-001", { requiresSavedSearchDiscovery: false });
    }

    const discoveryIndex = context.traceEvents.findIndex((event) => isToolCall(event, "splunk_get_knowledge_objects"));
    const firstCustomQueryIndex = context.traceEvents.findIndex((event) => isToolCall(event, "splunk_run_query"));
    const firstCustomQuery = firstCustomQueryIndex >= 0 ? context.traceEvents[firstCustomQueryIndex] : undefined;

    if (discoveryIndex < 0) {
      return fail("KO-001", [
        createKnowledgeViolation(
          context,
          firstCustomQuery?.id ?? firstTraceId(context),
          "Mission requires saved-search discovery, but the trace never inspected knowledge objects.",
          {
            preferredSavedSearchRefs: preferredRefs,
            firstCustomQueryTool: firstCustomQuery?.toolName
          },
          "Inspect saved searches with splunk_get_knowledge_objects before generating custom SPL.",
          `${context.contract.id}.savedSearches`
        )
      ]);
    }

    if (firstCustomQueryIndex >= 0 && firstCustomQueryIndex < discoveryIndex) {
      return fail("KO-001", [
        createKnowledgeViolation(
          context,
          firstCustomQuery?.id ?? firstTraceId(context),
          "Custom SPL ran before saved-search discovery.",
          {
            preferredSavedSearchRefs: preferredRefs,
            discoveryTraceEventId: context.traceEvents[discoveryIndex]?.id,
            customQueryTraceEventId: firstCustomQuery?.id
          },
          "Move saved-search discovery before any custom splunk_run_query call.",
          `${context.contract.id}.savedSearches`
        )
      ]);
    }

    const savedSearchCalls = context.traceEvents.filter((event) => isToolCall(event, "splunk_run_saved_search"));
    const preferredSavedSearchCall = savedSearchCalls.find((event) => {
      const ref = eventRefFromInput(event.toolInput);
      return ref ? preferredRefs.includes(ref) : false;
    });

    if (!preferredSavedSearchCall) {
      return fail("KO-001", [
        createKnowledgeViolation(
          context,
          savedSearchCalls[0]?.id ?? context.traceEvents[discoveryIndex]?.id ?? firstTraceId(context),
          "Mission preferred saved searches were discovered but not run.",
          {
            preferredSavedSearchRefs: preferredRefs,
            attemptedSavedSearchRefs: savedSearchCalls.map((event) => eventRefFromInput(event.toolInput)).filter(Boolean)
          },
          "Run one of the mission preferred saved searches before falling back to custom SPL.",
          `${context.contract.id}.savedSearches`
        )
      ]);
    }

    const savedSearchResult = context.traceEvents.find(
      (event) => event.type === "tool_result" && event.parentId === preferredSavedSearchCall.id
    );

    if (!savedSearchResult?.queryRef) {
      return fail("KO-001", [
        createKnowledgeViolation(
          context,
          preferredSavedSearchCall.id,
          "Preferred saved-search run does not cite saved-search provenance.",
          {
            preferredSavedSearchRef: eventRefFromInput(preferredSavedSearchCall.toolInput),
            resultTraceEventId: savedSearchResult?.id,
            queryRef: savedSearchResult?.queryRef,
            evidenceRefs: savedSearchResult?.evidenceRefs
          },
          "Record a saved-search queryRef or evidence reference on the saved-search result.",
          `${context.contract.id}.savedSearches`
        )
      ]);
    }

    return pass("KO-001", {
      requiresSavedSearchDiscovery: true,
      discoveryTraceEventId: context.traceEvents[discoveryIndex]?.id,
      preferredSavedSearchRef: eventRefFromInput(preferredSavedSearchCall.toolInput),
      savedSearchEvidenceRef: savedSearchResult.queryRef
    });
  }
};

export const createSavedSearchRules = (): GraderRule[] => [savedSearchDiscoveryRule];
