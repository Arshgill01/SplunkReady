import type {
  KnowledgeObjectType,
  QueryResult,
  SavedSearchResult,
  SplunkAccessAdapter
} from "../adapters/splunk-access.js";
import type { MissionDefinition } from "../missions/dsl.js";
import type { AgentPolicy } from "../policy/compiler.js";
import type { TraceEvent } from "../schemas/core.js";

export interface SpecimenAgentInput {
  mission: MissionDefinition;
  adapter: SplunkAccessAdapter;
  policy?: AgentPolicy;
  now?: string;
}

export interface SpecimenAgentRun {
  finalAnswer: string;
  traceEvents: TraceEvent[];
}

const defaultNow = "2026-06-01T07:00:00.000Z";
const defaultApp = "SplunkEnterpriseSecuritySuite";

const hostPattern = /\b([a-z][a-z0-9-]*-\d{2})\b/i;

const extractHost = (prompt: string): string | undefined => hostPattern.exec(prompt)?.[1];

const savedSearchParts = (ref: string): { app: string; name: string } => {
  const [app, ...nameParts] = ref.split("::");
  return { app: app || defaultApp, name: nameParts.join("::") || ref };
};

const savedSearchRef = (input: { app: string; name: string }): string => `${input.app}::${input.name}`;

const traceEvent = (event: TraceEvent): TraceEvent => event;

const policySavedSearchRefs = (policy: AgentPolicy): string[] => {
  const savedSearchRule = policy.knowledgeRules.find((rule) => rule.ruleId === "KO-001" && rule.action === "prefer");
  const value = savedSearchRule?.value;

  if (!value || typeof value !== "object" || !("savedSearches" in value) || !Array.isArray(value.savedSearches)) {
    return [];
  }

  return value.savedSearches
    .filter(
      (candidate): candidate is { app: string; name: string } =>
        Boolean(candidate) &&
        typeof candidate === "object" &&
        "app" in candidate &&
        "name" in candidate &&
        typeof candidate.app === "string" &&
        typeof candidate.name === "string"
    )
    .map(savedSearchRef);
};

const policyPreferredSavedSearchRef = (mission: MissionDefinition, policy?: AgentPolicy): string | undefined => {
  if (!policy) {
    return undefined;
  }

  const missionRefs = new Set(mission.preferredSavedSearchRefs ?? []);
  return policySavedSearchRefs(policy).find((ref) => missionRefs.has(ref));
};

export class NaiveSpecimenAgent {
  async run(input: SpecimenAgentInput): Promise<SpecimenAgentRun> {
    const traceEvents: TraceEvent[] = [];
    const timestamp = input.now ?? defaultNow;
    const preferredSavedSearchRef = policyPreferredSavedSearchRef(input.mission, input.policy);

    if (preferredSavedSearchRef) {
      return this.runWithInjectedPolicy(input, traceEvents, timestamp, preferredSavedSearchRef);
    }

    return this.runWithoutPolicy(input, traceEvents, timestamp);
  }

  private async runWithoutPolicy(
    input: SpecimenAgentInput,
    traceEvents: TraceEvent[],
    timestamp: string
  ): Promise<SpecimenAgentRun> {
    const host = extractHost(input.mission.prompt);
    const query = [
      "search index=*",
      host ? `host=${host}` : undefined,
      "src_ip=*",
      `earliest=${input.mission.requestedTimeWindow.earliest}`,
      `latest=${input.mission.requestedTimeWindow.latest}`
    ]
      .filter(Boolean)
      .join(" ");
    const callId = this.addToolCall(traceEvents, {
      missionId: input.mission.id,
      timestamp,
      step: 1,
      toolName: "splunk_run_query",
      toolInput: {
        query,
        timeWindow: input.mission.requestedTimeWindow,
        maxRows: 10
      }
    });
    const result = await input.adapter.runQuery(
      { query, timeWindow: input.mission.requestedTimeWindow, maxRows: 10 },
      { requestId: `${input.mission.id}-naive`, missionId: input.mission.id, traceEventId: callId }
    );
    this.addQueryResult(traceEvents, input.mission.id, timestamp, callId, 2, result);

    const finalAnswer =
      result.resultCount > 0
        ? `Found ${result.resultCount} matching result(s), but this naive run did not inspect validated Splunk knowledge.`
        : "No evidence was found by the naive broad search.";
    this.addFinalAnswer(traceEvents, input.mission.id, timestamp, 3, finalAnswer, result, `${callId}-result`);

    return { finalAnswer, traceEvents };
  }

  private async runWithInjectedPolicy(
    input: SpecimenAgentInput,
    traceEvents: TraceEvent[],
    timestamp: string,
    preferredSavedSearchRef: string
  ): Promise<SpecimenAgentRun> {
    const knowledgeCallId = this.addToolCall(traceEvents, {
      missionId: input.mission.id,
      timestamp,
      step: 1,
      toolName: "splunk_get_knowledge_objects",
      toolInput: {
        types: ["saved_searches", "macros", "lookups"],
        query: input.mission.title
      }
    });
    const knowledgeTypes: KnowledgeObjectType[] = ["saved_searches", "macros", "lookups"];
    const knowledgeObjects = await input.adapter.getKnowledgeObjects(
      { types: knowledgeTypes, query: input.mission.title },
      { requestId: `${input.mission.id}-policy`, missionId: input.mission.id, traceEventId: knowledgeCallId }
    );
    traceEvents.push(
      traceEvent({
        id: `${knowledgeCallId}-result`,
        missionId: input.mission.id,
        timestamp,
        actor: "splunk_adapter",
        type: "tool_result",
        toolName: "splunk_get_knowledge_objects",
        toolInput: null,
        toolOutputSummary: `Found ${knowledgeObjects.resultCount} knowledge object(s).`,
        queryRef: null,
        timeWindow: null,
        resultCount: knowledgeObjects.resultCount,
        evidenceRefs: knowledgeObjects.objects.map((object) => object.id),
        error: null,
        step: 2,
        parentId: knowledgeCallId
      })
    );

    const preferredSearch = savedSearchParts(preferredSavedSearchRef);
    const host = extractHost(input.mission.prompt);
    const savedSearchCallId = this.addToolCall(traceEvents, {
      missionId: input.mission.id,
      timestamp,
      step: 3,
      toolName: "splunk_run_saved_search",
      toolInput: {
        name: preferredSearch.name,
        app: preferredSearch.app,
        tokens: {
          ...(host ? { host } : {}),
          earliest: input.mission.requestedTimeWindow.earliest,
          latest: input.mission.requestedTimeWindow.latest
        },
        maxRows: 10
      }
    });
    const result = await input.adapter.runSavedSearch(
      {
        name: preferredSearch.name,
        app: preferredSearch.app,
        tokens: {
          ...(host ? { host } : {}),
          earliest: input.mission.requestedTimeWindow.earliest,
          latest: input.mission.requestedTimeWindow.latest
        },
        maxRows: 10
      },
      { requestId: `${input.mission.id}-policy`, missionId: input.mission.id, traceEventId: savedSearchCallId }
    );
    this.addSavedSearchResult(traceEvents, input.mission.id, timestamp, savedSearchCallId, 4, result);

    const finalAnswer =
      result.resultCount > 0
        ? `Evidence supports the investigation: ${result.resultCount} result(s), evidence ${result.evidenceRefs.join(", ")}.`
        : "The validated saved search returned no evidence; confidence is limited.";
    this.addFinalAnswer(traceEvents, input.mission.id, timestamp, 5, finalAnswer, result, `${savedSearchCallId}-result`);

    return { finalAnswer, traceEvents };
  }

  private addToolCall(
    traceEvents: TraceEvent[],
    input: {
      missionId: string;
      timestamp: string;
      step: number;
      toolName: string;
      toolInput: Record<string, unknown>;
    }
  ): string {
    const eventId = `${input.missionId}-trace-${String(input.step).padStart(3, "0")}`;
    traceEvents.push(
      traceEvent({
        id: eventId,
        missionId: input.missionId,
        timestamp: input.timestamp,
        actor: "specimen_agent",
        type: "tool_call",
        toolName: input.toolName,
        toolInput: input.toolInput,
        toolOutputSummary: null,
        queryRef: null,
        timeWindow: null,
        resultCount: null,
        evidenceRefs: [],
        error: null,
        step: input.step
      })
    );

    return eventId;
  }

  private addQueryResult(
    traceEvents: TraceEvent[],
    missionId: string,
    timestamp: string,
    parentId: string,
    step: number,
    result: QueryResult
  ): void {
    traceEvents.push(
      traceEvent({
        id: `${parentId}-result`,
        missionId,
        timestamp,
        actor: "splunk_adapter",
        type: "tool_result",
        toolName: "splunk_run_query",
        toolInput: null,
        toolOutputSummary: `Query returned ${result.resultCount} row(s).`,
        queryRef: result.queryRef,
        timeWindow: null,
        resultCount: result.resultCount,
        evidenceRefs: result.evidenceRefs,
        error: null,
        step,
        parentId
      })
    );
  }

  private addSavedSearchResult(
    traceEvents: TraceEvent[],
    missionId: string,
    timestamp: string,
    parentId: string,
    step: number,
    result: SavedSearchResult
  ): void {
    traceEvents.push(
      traceEvent({
        id: `${parentId}-result`,
        missionId,
        timestamp,
        actor: "splunk_adapter",
        type: "tool_result",
        toolName: "splunk_run_saved_search",
        toolInput: null,
        toolOutputSummary: `Saved search returned ${result.resultCount} row(s).`,
        queryRef: result.savedSearchRef,
        timeWindow: null,
        resultCount: result.resultCount,
        evidenceRefs: result.evidenceRefs,
        error: null,
        step,
        parentId
      })
    );
  }

  private addFinalAnswer(
    traceEvents: TraceEvent[],
    missionId: string,
    timestamp: string,
    step: number,
    finalAnswer: string,
    result: QueryResult | SavedSearchResult,
    parentId: string
  ): void {
    traceEvents.push(
      traceEvent({
        id: `${missionId}-trace-${String(step).padStart(3, "0")}`,
        missionId,
        timestamp,
        actor: "specimen_agent",
        type: "final_answer",
        toolName: null,
        toolInput: null,
        toolOutputSummary: finalAnswer,
        queryRef: null,
        timeWindow: null,
        resultCount: result.resultCount,
        evidenceRefs: result.evidenceRefs,
        error: null,
        step,
        parentId
      })
    );
  }
}
