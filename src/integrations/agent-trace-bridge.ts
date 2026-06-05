import { traceEventSchema, type TraceEvent } from "../schemas/core.js";
import { TraceRecorder } from "../traces/recorder.js";
import type { ExternalTraceCertificationPayload } from "../workflows/external-certification.js";

export interface SplunkReadyTraceBridgeOptions {
  missionId: string;
  timestamp?: string;
}

export interface AgentToolCallInput {
  toolName: string;
  toolInput: Record<string, unknown>;
  timeWindow?: TraceEvent["timeWindow"];
}

export interface AgentToolResultInput {
  parentId: string;
  toolName: string;
  outputSummary: string;
  queryRef?: string | null;
  timeWindow?: TraceEvent["timeWindow"];
  resultCount?: number | null;
  evidenceRefs?: string[];
}

export interface AgentToolErrorInput {
  parentId: string;
  toolName: string;
  error: Record<string, unknown>;
}

export interface AgentFinalAnswerInput {
  outputSummary: string;
  timeWindow?: TraceEvent["timeWindow"];
  resultCount?: number | null;
  evidenceRefs?: string[];
  parentId?: string;
}

export interface ExternalTracePayloadInput {
  requirePass?: boolean;
  agentName?: string;
  agentVersion?: string;
}

export interface SplunkReadyTraceBridge {
  recordToolCall(input: AgentToolCallInput): string;
  recordToolResult(input: AgentToolResultInput): string;
  recordToolError(input: AgentToolErrorInput): string;
  recordFinalAnswer(input: AgentFinalAnswerInput): string;
  events(): TraceEvent[];
  externalTracePayload(input?: ExternalTracePayloadInput): ExternalTraceCertificationPayload;
}

export const createSplunkReadyTraceBridge = (options: SplunkReadyTraceBridgeOptions): SplunkReadyTraceBridge => {
  const recorder = new TraceRecorder({
    missionId: options.missionId,
    timestamp: options.timestamp ?? new Date().toISOString()
  });

  const events = (): TraceEvent[] => traceEventSchema.array().parse(recorder.events());

  return {
    recordToolCall(input) {
      return recorder.recordToolCall(input.toolName, input.toolInput, input.timeWindow);
    },

    recordToolResult(input) {
      return recorder.recordToolResult(input);
    },

    recordToolError(input) {
      return recorder.recordError(input.parentId, input.toolName, input.error);
    },

    recordFinalAnswer(input) {
      return recorder.recordFinalAnswer(input);
    },

    events,

    externalTracePayload(input = {}) {
      return {
        trace: events(),
        requirePass: input.requirePass ?? false,
        agentName: input.agentName,
        agentVersion: input.agentVersion
      };
    }
  };
};
