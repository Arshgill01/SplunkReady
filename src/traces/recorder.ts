import { traceEventSchema, type TraceEvent } from "../schemas/core.js";

export interface TraceRecorderOptions {
  missionId: string;
  timestamp: string;
}

export interface ToolResultTraceInput {
  parentId: string;
  toolName: string;
  outputSummary: string;
  queryRef?: string | null;
  timeWindow?: TraceEvent["timeWindow"];
  resultCount?: number | null;
  evidenceRefs?: string[];
}

export interface FinalAnswerTraceInput {
  outputSummary: string;
  timeWindow?: TraceEvent["timeWindow"];
  resultCount?: number | null;
  evidenceRefs?: string[];
  parentId?: string;
}

export class TraceRecorder {
  private readonly missionId: string;
  private readonly timestamp: string;
  private readonly traceEvents: TraceEvent[] = [];
  private nextStep = 1;

  constructor(options: TraceRecorderOptions) {
    this.missionId = options.missionId;
    this.timestamp = options.timestamp;
  }

  events(): TraceEvent[] {
    return [...this.traceEvents];
  }

  recordToolCall(toolName: string, toolInput: Record<string, unknown>, timeWindow?: TraceEvent["timeWindow"]): string {
    return this.add({
      actor: "specimen_agent",
      type: "tool_call",
      toolName,
      toolInput,
      toolOutputSummary: null,
      queryRef: null,
      timeWindow: timeWindow ?? null,
      resultCount: null,
      evidenceRefs: [],
      error: null
    });
  }

  recordToolResult(input: ToolResultTraceInput): string {
    return this.add({
      actor: "splunk_adapter",
      type: "tool_result",
      toolName: input.toolName,
      toolInput: null,
      toolOutputSummary: input.outputSummary,
      queryRef: input.queryRef ?? null,
      timeWindow: input.timeWindow ?? null,
      resultCount: input.resultCount ?? null,
      evidenceRefs: input.evidenceRefs ?? [],
      error: null,
      parentId: input.parentId
    });
  }

  recordError(parentId: string, toolName: string, error: Record<string, unknown>): string {
    return this.add({
      actor: "splunk_adapter",
      type: "error",
      toolName,
      toolInput: null,
      toolOutputSummary: null,
      queryRef: null,
      timeWindow: null,
      resultCount: null,
      evidenceRefs: [],
      error,
      parentId
    });
  }

  recordFinalAnswer(input: FinalAnswerTraceInput): string {
    return this.add({
      actor: "specimen_agent",
      type: "final_answer",
      toolName: null,
      toolInput: null,
      toolOutputSummary: input.outputSummary,
      queryRef: null,
      timeWindow: input.timeWindow ?? null,
      resultCount: input.resultCount ?? null,
      evidenceRefs: input.evidenceRefs ?? [],
      error: null,
      parentId: input.parentId
    });
  }

  private add(input: Omit<TraceEvent, "id" | "missionId" | "timestamp" | "step">): string {
    const step = this.nextStep;
    this.nextStep += 1;
    const event = traceEventSchema.parse({
      ...input,
      id: `${this.missionId}-trace-${String(step).padStart(3, "0")}`,
      missionId: this.missionId,
      timestamp: this.timestamp,
      step
    });
    this.traceEvents.push(event);

    return event.id;
  }
}
