import {
  type KnowledgeObjectRequest,
  type KnowledgeObjectResult,
  type QueryResult,
  type RunQueryRequest,
  type RunSavedSearchRequest,
  type SavedSearchResult
} from "../adapters/splunk-access.js";
import type { MissionDefinition } from "../missions/dsl.js";
import type { AgentPolicy } from "../policy/compiler.js";
import type { EnvironmentContract, ReadOnlySplunkToolName, TraceEvent } from "../schemas/core.js";
import { TraceRecorder } from "../traces/recorder.js";
import type { SpecimenAgentInput, SpecimenAgentRun } from "./specimen.js";

export type LlmAgentToolCall =
  | { toolName: "splunk_get_knowledge_objects"; input: KnowledgeObjectRequest }
  | { toolName: "splunk_run_query"; input: RunQueryRequest }
  | { toolName: "splunk_run_saved_search"; input: RunSavedSearchRequest };

export interface LlmAgentPlan {
  toolCalls: LlmAgentToolCall[];
  rationale: string;
}

export interface LlmAgentObservation {
  toolName: ReadOnlySplunkToolName;
  summary: string;
  resultCount: number | null;
  evidenceRefs: string[];
  queryRef: string | null;
}

export interface LlmAgentModel {
  plan(input: {
    mission: MissionDefinition;
    contract: EnvironmentContract;
    policy?: AgentPolicy;
    contractInjected: boolean;
    allowedTools: ReadOnlySplunkToolName[];
  }): Promise<LlmAgentPlan>;
  answer(input: {
    mission: MissionDefinition;
    contract: EnvironmentContract;
    policy?: AgentPolicy;
    contractInjected: boolean;
    observations: LlmAgentObservation[];
  }): Promise<string>;
}

export interface LlmSpecimenAgentOptions {
  contract: EnvironmentContract;
  model: LlmAgentModel;
}

export interface LlmSpecimenAgentRun extends SpecimenAgentRun {
  finalAnswer: string;
  traceEvents: TraceEvent[];
  observations: LlmAgentObservation[];
}

const defaultNow = "2026-06-01T07:05:00.000Z";

const allowedExecutionTools = new Set<ReadOnlySplunkToolName>([
  "splunk_get_knowledge_objects",
  "splunk_run_query",
  "splunk_run_saved_search"
]);

const assertAllowedTool = (
  toolCall: LlmAgentToolCall,
  mission: MissionDefinition,
  contract: EnvironmentContract
): void => {
  const missionAllowed = new Set(mission.allowedTools);
  const contractAllowed = new Set(contract.mcpTools);

  if (!allowedExecutionTools.has(toolCall.toolName)) {
    throw new Error(`LLM specimen requested unsupported tool ${toolCall.toolName}.`);
  }

  if (!missionAllowed.has(toolCall.toolName) || !contractAllowed.has(toolCall.toolName)) {
    throw new Error(`LLM specimen requested tool ${toolCall.toolName} outside mission or contract allowlist.`);
  }
};

const clampQueryInput = (input: RunQueryRequest, contract: EnvironmentContract): RunQueryRequest => ({
  ...input,
  maxRows: Math.min(input.maxRows ?? contract.queryBudgets.maxResultRows, contract.queryBudgets.maxResultRows)
});

const clampSavedSearchInput = (
  input: RunSavedSearchRequest,
  contract: EnvironmentContract
): RunSavedSearchRequest => ({
  ...input,
  maxRows: Math.min(input.maxRows ?? contract.queryBudgets.maxResultRows, contract.queryBudgets.maxResultRows)
});

const queryObservation = (result: QueryResult): LlmAgentObservation => ({
  toolName: "splunk_run_query",
  summary: `Query returned ${result.resultCount} row(s).`,
  resultCount: result.resultCount,
  evidenceRefs: result.evidenceRefs,
  queryRef: result.queryRef
});

const savedSearchObservation = (result: SavedSearchResult): LlmAgentObservation => ({
  toolName: "splunk_run_saved_search",
  summary: `Saved search returned ${result.resultCount} row(s).`,
  resultCount: result.resultCount,
  evidenceRefs: result.evidenceRefs,
  queryRef: result.savedSearchRef
});

const knowledgeObservation = (result: KnowledgeObjectResult): LlmAgentObservation => ({
  toolName: "splunk_get_knowledge_objects",
  summary: `Found ${result.resultCount} knowledge object(s).`,
  resultCount: result.resultCount,
  evidenceRefs: result.objects.map((object) => object.id),
  queryRef: null
});

const traceInput = (input: object): Record<string, unknown> => ({ ...input });

export class LlmSpecimenAgent {
  private readonly contract: EnvironmentContract;
  private readonly model: LlmAgentModel;

  constructor(options: LlmSpecimenAgentOptions) {
    this.contract = options.contract;
    this.model = options.model;
  }

  async run(input: SpecimenAgentInput): Promise<LlmSpecimenAgentRun> {
    const recorder = new TraceRecorder({ missionId: input.mission.id, timestamp: input.now ?? defaultNow });
    const allowedTools = input.mission.allowedTools.filter((toolName) => this.contract.mcpTools.includes(toolName));
    const contractInjected = Boolean(input.policy);
    const plan = await this.model.plan({
      mission: input.mission,
      contract: this.contract,
      policy: input.policy,
      contractInjected,
      allowedTools
    });
    const maxToolCalls = Math.min(this.contract.queryBudgets.maxToolCalls, input.mission.expectedTools.length + 2);

    if (plan.toolCalls.length === 0) {
      throw new Error("LLM specimen returned no Splunk tool calls.");
    }

    if (plan.toolCalls.length > maxToolCalls) {
      throw new Error(`LLM specimen requested ${plan.toolCalls.length} tool calls; max allowed is ${maxToolCalls}.`);
    }

    const observations: LlmAgentObservation[] = [];

    for (const toolCall of plan.toolCalls) {
      assertAllowedTool(toolCall, input.mission, this.contract);

      if (toolCall.toolName === "splunk_get_knowledge_objects") {
        const callId = recorder.recordToolCall(toolCall.toolName, traceInput(toolCall.input));
        const result = await input.adapter.getKnowledgeObjects(toolCall.input, {
          requestId: `${input.mission.id}-llm-agent`,
          missionId: input.mission.id,
          traceEventId: callId
        });
        const observation = knowledgeObservation(result);
        observations.push(observation);
        recorder.recordToolResult({
          parentId: callId,
          toolName: toolCall.toolName,
          outputSummary: observation.summary,
          resultCount: observation.resultCount,
          evidenceRefs: observation.evidenceRefs
        });
      } else if (toolCall.toolName === "splunk_run_query") {
        const toolInput = clampQueryInput(toolCall.input, this.contract);
        const callId = recorder.recordToolCall(toolCall.toolName, traceInput(toolInput), toolInput.timeWindow ?? null);
        const result = await input.adapter.runQuery(toolInput, {
          requestId: `${input.mission.id}-llm-agent`,
          missionId: input.mission.id,
          traceEventId: callId
        });
        const observation = queryObservation(result);
        observations.push(observation);
        recorder.recordToolResult({
          parentId: callId,
          toolName: toolCall.toolName,
          outputSummary: observation.summary,
          queryRef: observation.queryRef,
          timeWindow: toolInput.timeWindow ?? null,
          resultCount: observation.resultCount,
          evidenceRefs: observation.evidenceRefs
        });
      } else {
        const toolInput = clampSavedSearchInput(toolCall.input, this.contract);
        const callId = recorder.recordToolCall(toolCall.toolName, traceInput(toolInput));
        const result = await input.adapter.runSavedSearch(toolInput, {
          requestId: `${input.mission.id}-llm-agent`,
          missionId: input.mission.id,
          traceEventId: callId
        });
        const observation = savedSearchObservation(result);
        observations.push(observation);
        recorder.recordToolResult({
          parentId: callId,
          toolName: toolCall.toolName,
          outputSummary: observation.summary,
          queryRef: observation.queryRef,
          resultCount: observation.resultCount,
          evidenceRefs: observation.evidenceRefs
        });
      }
    }

    const finalAnswer = await this.model.answer({
      mission: input.mission,
      contract: this.contract,
      policy: input.policy,
      contractInjected,
      observations
    });
    const lastObservation = observations.at(-1);
    const finalAnswerParent = recorder.events().at(-1)?.id;
    recorder.recordFinalAnswer({
      outputSummary: finalAnswer,
      timeWindow: input.mission.requestedTimeWindow,
      resultCount: lastObservation?.resultCount ?? null,
      evidenceRefs: lastObservation?.evidenceRefs ?? [],
      parentId: finalAnswerParent
    });

    return { finalAnswer, traceEvents: recorder.events(), observations };
  }
}
