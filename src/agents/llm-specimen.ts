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
import { evaluateLlmOutputQuality, type LlmOutputQualityReport } from "./llm-output-quality.js";
import type { SpecimenAgentInput, SpecimenAgentRun } from "./specimen.js";

export type LlmAgentToolCall =
  | { toolName: "splunk_get_knowledge_objects"; input: KnowledgeObjectRequest }
  | { toolName: "splunk_run_query"; input: RunQueryRequest }
  | { toolName: "splunk_run_saved_search"; input: RunSavedSearchRequest };

export interface LlmAgentPlan {
  toolCalls: LlmAgentToolCall[];
  rationale: string;
  missionUnderstanding?: string;
  riskControls?: string[];
  evidenceStrategy?: string[];
  selfCheck?: string[];
}

export interface LlmAgentObservation {
  toolName: ReadOnlySplunkToolName;
  summary: string;
  resultCount: number | null;
  evidenceRefs: string[];
  queryRef: string | null;
}

export interface LlmAgentAnswer {
  finalAnswer: string;
  provenanceSummary?: string;
  uncertainty?: string[];
  nextActions?: string[];
  safetyNotes?: string[];
  decisionTrace?: string[];
  claimEvidenceMatrix?: LlmAgentClaimEvidence[];
}

export type LlmAgentAnswerResult = string | LlmAgentAnswer;

export interface LlmAgentClaimEvidence {
  claim: string;
  support: "supported" | "partial" | "unsupported";
  queryRefs?: string[];
  evidenceRefs?: string[];
  limitation?: string;
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
  }): Promise<LlmAgentAnswerResult>;
}

export interface LlmSpecimenAgentOptions {
  contract: EnvironmentContract;
  model: LlmAgentModel;
}

export interface LlmSpecimenAgentRun extends SpecimenAgentRun {
  finalAnswer: string;
  traceEvents: TraceEvent[];
  observations: LlmAgentObservation[];
  plan: LlmAgentPlan;
  answer: LlmAgentAnswer;
  outputQuality: LlmOutputQualityReport;
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

const hasTimeModifier = (query: string, modifier: "earliest" | "latest"): boolean =>
  new RegExp(`\\b${modifier}\\s*=`, "i").test(query);

const appendTimeBounds = (query: string, timeWindow: RunQueryRequest["timeWindow"]): string => {
  if (!timeWindow) {
    return query;
  }

  const modifiers = [
    hasTimeModifier(query, "earliest") ? null : `earliest=${timeWindow.earliest}`,
    hasTimeModifier(query, "latest") ? null : `latest=${timeWindow.latest}`
  ].filter((modifier): modifier is string => Boolean(modifier));

  if (modifiers.length === 0) {
    return query;
  }

  const pipeIndex = query.indexOf("|");

  if (pipeIndex === -1) {
    return `${query} ${modifiers.join(" ")}`;
  }

  return `${query.slice(0, pipeIndex).trimEnd()} ${modifiers.join(" ")} ${query.slice(pipeIndex).trimStart()}`;
};

const clampQueryInput = (input: RunQueryRequest, contract: EnvironmentContract): RunQueryRequest => ({
  ...input,
  query: appendTimeBounds(input.query, input.timeWindow),
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

const evidenceLedgerFrom = (observations: LlmAgentObservation[]): string => {
  const evidenceRows = observations
    .filter(
      (observation) =>
        observation.queryRef || typeof observation.resultCount === "number" || observation.evidenceRefs.length > 0
    )
    .map((observation, index) => {
      const evidenceRefs = observation.evidenceRefs.length > 0 ? observation.evidenceRefs.join(", ") : "none";
      return `Observation ${index + 1}: tool ${observation.toolName}; provenance ${observation.queryRef ?? "none"}; resultCount ${observation.resultCount ?? "n/a"}; evidenceRefs ${evidenceRefs}.`;
    });

  return evidenceRows.length > 0 ? `Evidence ledger: ${evidenceRows.join(" ")}` : "";
};

const appendEvidenceLedger = (answer: string, observations: LlmAgentObservation[]): string => {
  const ledger = evidenceLedgerFrom(observations);
  if (!ledger) {
    return answer;
  }

  return answer.includes(ledger) ? answer : `${answer}\n${ledger}`;
};

const normalizeAnswer = (answer: LlmAgentAnswerResult): LlmAgentAnswer =>
  typeof answer === "string" ? { finalAnswer: answer } : answer;

export class LlmSpecimenAgent {
  private readonly contract: EnvironmentContract;
  private readonly model: LlmAgentModel;

  constructor(options: LlmSpecimenAgentOptions) {
    this.contract = options.contract;
    this.model = options.model;
  }

  async run(input: SpecimenAgentInput): Promise<LlmSpecimenAgentRun> {
    const recorder = new TraceRecorder({ missionId: input.mission.id, timestamp: input.now ?? defaultNow });
    const allowedTools = input.mission.allowedTools.filter(
      (toolName) => allowedExecutionTools.has(toolName) && this.contract.mcpTools.includes(toolName)
    );
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

    const modelAnswer = normalizeAnswer(
      await this.model.answer({
        mission: input.mission,
        contract: this.contract,
        policy: input.policy,
        contractInjected,
        observations
      })
    );
    const outputQuality = evaluateLlmOutputQuality({ mission: input.mission, plan, answer: modelAnswer, observations });
    const modelFinalAnswer = modelAnswer.finalAnswer;
    const finalAnswer = appendEvidenceLedger(modelFinalAnswer, observations);
    const answer: LlmAgentAnswer = { ...modelAnswer, finalAnswer };
    const lastObservation = observations.at(-1);
    const finalAnswerParent = recorder.events().at(-1)?.id;
    recorder.recordFinalAnswer({
      outputSummary: finalAnswer,
      timeWindow: input.mission.requestedTimeWindow,
      resultCount: lastObservation?.resultCount ?? null,
      evidenceRefs: lastObservation?.evidenceRefs ?? [],
      parentId: finalAnswerParent
    });

    return { finalAnswer, traceEvents: recorder.events(), observations, plan, answer, outputQuality };
  }
}
