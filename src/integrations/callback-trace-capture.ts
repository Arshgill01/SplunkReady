import type { TraceEvent } from "../schemas/core.js";
import {
  createSplunkReadyTraceBridge,
  type ExternalTracePayloadInput,
  type SplunkReadyTraceBridgeOptions
} from "./agent-trace-bridge.js";
import type { ExternalTraceCertificationPayload } from "../workflows/external-certification.js";

export interface CallbackToolStartInput {
  runId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  timeWindow?: TraceEvent["timeWindow"];
}

export interface CallbackToolEndInput {
  runId: string;
  outputSummary: string;
  queryRef?: string | null;
  timeWindow?: TraceEvent["timeWindow"];
  resultCount?: number | null;
  evidenceRefs?: string[];
}

export interface CallbackToolErrorInput {
  runId: string;
  error: Record<string, unknown>;
}

export interface CallbackFinalAnswerInput {
  outputSummary: string;
  parentRunId?: string;
  timeWindow?: TraceEvent["timeWindow"];
  resultCount?: number | null;
  evidenceRefs?: string[];
}

export interface SplunkReadyCallbackTraceCapture {
  onToolStart(input: CallbackToolStartInput): string;
  onToolEnd(input: CallbackToolEndInput): string;
  onToolError(input: CallbackToolErrorInput): string;
  onFinalAnswer(input: CallbackFinalAnswerInput): string;
  events(): TraceEvent[];
  externalTracePayload(input?: ExternalTracePayloadInput): ExternalTraceCertificationPayload;
}

interface PendingToolCall {
  traceEventId: string;
  toolName: string;
}

export const createSplunkReadyCallbackTraceCapture = (
  options: SplunkReadyTraceBridgeOptions
): SplunkReadyCallbackTraceCapture => {
  const bridge = createSplunkReadyTraceBridge(options);
  const toolCallsByRun = new Map<string, PendingToolCall>();
  const openToolRunIds = new Set<string>();

  const toolCallForRun = (runId: string): PendingToolCall => {
    const pending = toolCallsByRun.get(runId);

    if (!pending) {
      throw new Error(`No SplunkReady tool call is registered for callback run ${runId}.`);
    }

    return pending;
  };

  const openToolCallForRun = (runId: string): PendingToolCall => {
    if (!openToolRunIds.has(runId)) {
      throw new Error(`Callback run ${runId} has no open SplunkReady tool call.`);
    }

    return toolCallForRun(runId);
  };

  return {
    onToolStart(input) {
      if (toolCallsByRun.has(input.runId)) {
        throw new Error(`Callback run ${input.runId} is already registered.`);
      }

      const traceEventId = bridge.recordToolCall({
        toolName: input.toolName,
        toolInput: input.toolInput,
        timeWindow: input.timeWindow
      });

      toolCallsByRun.set(input.runId, { traceEventId, toolName: input.toolName });
      openToolRunIds.add(input.runId);

      return traceEventId;
    },

    onToolEnd(input) {
      const pending = openToolCallForRun(input.runId);
      openToolRunIds.delete(input.runId);

      return bridge.recordToolResult({
        parentId: pending.traceEventId,
        toolName: pending.toolName,
        outputSummary: input.outputSummary,
        queryRef: input.queryRef,
        timeWindow: input.timeWindow,
        resultCount: input.resultCount,
        evidenceRefs: input.evidenceRefs
      });
    },

    onToolError(input) {
      const pending = openToolCallForRun(input.runId);
      openToolRunIds.delete(input.runId);

      return bridge.recordToolError({
        parentId: pending.traceEventId,
        toolName: pending.toolName,
        error: input.error
      });
    },

    onFinalAnswer(input) {
      return bridge.recordFinalAnswer({
        outputSummary: input.outputSummary,
        parentId: input.parentRunId ? toolCallForRun(input.parentRunId).traceEventId : undefined,
        timeWindow: input.timeWindow,
        resultCount: input.resultCount,
        evidenceRefs: input.evidenceRefs
      });
    },

    events: bridge.events,
    externalTracePayload: bridge.externalTracePayload
  };
};
