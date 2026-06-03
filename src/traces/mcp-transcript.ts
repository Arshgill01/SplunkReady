import { readOnlySplunkToolNameSchema, traceEventSchema, type ReadOnlySplunkToolName, type TraceEvent } from "../schemas/core.js";

export interface ImportedMcpTranscriptSummary {
  status: "PASS";
  source: "mcp-jsonrpc-transcript";
  mutation: false;
  missionId: string;
  recordCount: number;
  importedEvents: number;
  toolCalls: number;
  toolResults: number;
  errors: number;
  finalAnswers: number;
  skippedRecords: number;
  toolNames: string[];
}

export interface ImportedMcpTranscript {
  traceEvents: TraceEvent[];
  summary: ImportedMcpTranscriptSummary;
}

interface PendingToolCall {
  traceEventId: string;
  toolName: ReadOnlySplunkToolName;
  input: Record<string, unknown>;
}

const defaultTimestamp = "2026-06-01T06:00:00.000Z";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const stringValue = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;

const numberValue = (value: unknown): number | undefined => (typeof value === "number" ? value : undefined);

const recordAt = (value: Record<string, unknown>, key: string): Record<string, unknown> | undefined => {
  const nested = value[key];
  return isRecord(nested) ? nested : undefined;
};

const unwrapRecord = (record: unknown): Record<string, unknown> | undefined => {
  if (!isRecord(record)) {
    return undefined;
  }

  return recordAt(record, "message") ?? recordAt(record, "payload") ?? recordAt(record, "request") ?? recordAt(record, "response") ?? record;
};

export const parseMcpTranscriptRecords = (text: string): unknown[] => {
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error("MCP transcript is empty.");
  }

  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed) as unknown;

    if (!Array.isArray(parsed)) {
      throw new Error("MCP transcript JSON must be an array or JSONL records.");
    }

    return parsed;
  }

  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as unknown);
};

const mcpCallInput = (record: Record<string, unknown>): { id: string; toolName: ReadOnlySplunkToolName; input: Record<string, unknown> } | null => {
  const method = stringValue(record.method);
  const params = recordAt(record, "params");
  const toolName = stringValue(params?.name);
  const input = recordAt(params ?? {}, "arguments") ?? recordAt(params ?? {}, "input") ?? {};
  const parsedToolName = toolName ? readOnlySplunkToolNameSchema.safeParse(toolName) : undefined;

  if (
    !method ||
    !["tools/call", "tool/call", "tools.call"].includes(method) ||
    !parsedToolName?.success ||
    !isRecord(input)
  ) {
    return null;
  }

  return {
    id: String(record.id ?? `${parsedToolName.data}:${toolName}`),
    toolName: parsedToolName.data,
    input
  };
};

const isMcpResponse = (record: Record<string, unknown>): boolean => "id" in record && ("result" in record || "error" in record);

const rowsFrom = (value: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  if (isRecord(value) && Array.isArray(value.results)) {
    return value.results.filter(isRecord);
  }

  if (isRecord(value) && Array.isArray(value.rows)) {
    return value.rows.filter(isRecord);
  }

  if (isRecord(value) && Array.isArray(value.objects)) {
    return value.objects.filter(isRecord);
  }

  return [];
};

const extractStructuredOutput = (result: unknown): unknown => {
  if (!isRecord(result)) {
    return result;
  }

  if ("structuredContent" in result) {
    return result.structuredContent;
  }

  if ("output" in result) {
    return result.output;
  }

  const content = result.content;
  if (Array.isArray(content)) {
    const textParts = content
      .filter(isRecord)
      .map((part) => stringValue(part.text))
      .filter((part): part is string => Boolean(part));

    if (textParts.length > 0) {
      return { text: textParts.join("\n") };
    }
  }

  return result;
};

const evidenceRefsFromRows = (rows: Array<Record<string, unknown>>): string[] =>
  rows
    .map((row) => stringValue(row.eventRef) ?? stringValue(row._cd) ?? stringValue(row._raw) ?? stringValue(row.id))
    .filter((ref): ref is string => Boolean(ref));

const evidenceRefsFromOutput = (output: unknown): string[] => {
  const rows = rowsFrom(output);
  const rowRefs = evidenceRefsFromRows(rows);

  if (rowRefs.length > 0) {
    return rowRefs;
  }

  if (isRecord(output) && Array.isArray(output.evidenceRefs)) {
    return output.evidenceRefs.filter((ref): ref is string => typeof ref === "string" && ref.length > 0);
  }

  return [];
};

const resultCountFromOutput = (output: unknown): number | null => {
  if (isRecord(output)) {
    const explicit =
      numberValue(output.resultCount) ?? numberValue(output.total_rows) ?? numberValue(output.totalRows) ?? numberValue(output.count);

    if (explicit !== undefined) {
      return explicit;
    }
  }

  const rows = rowsFrom(output);
  return rows.length > 0 ? rows.length : null;
};

const queryRefFor = (toolCall: PendingToolCall, output: unknown): string | null => {
  if (isRecord(output)) {
    const explicit = stringValue(output.queryRef) ?? stringValue(output.savedSearchRef);

    if (explicit) {
      return explicit;
    }
  }

  if (toolCall.toolName === "splunk_run_query") {
    return stringValue(toolCall.input.query) ?? null;
  }

  if (toolCall.toolName === "splunk_run_saved_search") {
    const app = stringValue(toolCall.input.app);
    const name = stringValue(toolCall.input.name) ?? stringValue(toolCall.input.saved_search_name);
    return app && name ? `${app}:${name}` : (name ?? null);
  }

  return null;
};

const outputSummaryFor = (toolName: string, output: unknown, resultCount: number | null): string => {
  if (isRecord(output)) {
    const summary = stringValue(output.summary) ?? stringValue(output.message) ?? stringValue(output.text);

    if (summary) {
      return summary;
    }
  }

  return resultCount === null ? `${toolName} returned a result.` : `${toolName} returned ${resultCount} row(s).`;
};

const finalAnswerText = (record: Record<string, unknown>): string | undefined =>
  stringValue(record.finalAnswer) ?? stringValue(record.outputSummary) ?? stringValue(record.answer) ?? stringValue(record.text);

const isFinalAnswerRecord = (record: Record<string, unknown>): boolean =>
  record.type === "final_answer" || record.event === "final_answer" || record.kind === "final_answer";

export const importMcpTranscript = (records: unknown[], missionId: string): ImportedMcpTranscript => {
  const traceEvents: TraceEvent[] = [];
  const pending = new Map<string, PendingToolCall>();
  const toolNames = new Set<string>();
  let skippedRecords = 0;
  let toolCalls = 0;
  let toolResults = 0;
  let errors = 0;
  let finalAnswers = 0;

  const addTraceEvent = (input: Omit<TraceEvent, "id" | "missionId" | "step">): string => {
    const step = traceEvents.length + 1;
    const event = traceEventSchema.parse({
      ...input,
      id: `${missionId}-imported-trace-${String(step).padStart(3, "0")}`,
      missionId,
      step
    });
    traceEvents.push(event);
    return event.id;
  };

  for (const rawRecord of records) {
    const record = unwrapRecord(rawRecord);

    if (!record) {
      skippedRecords += 1;
      continue;
    }

    const timestamp = stringValue(record.timestamp) ?? stringValue(record.time) ?? defaultTimestamp;
    const toolCall = mcpCallInput(record);

    if (toolCall) {
      const traceEventId = addTraceEvent({
        timestamp,
        actor: "specimen_agent",
        type: "tool_call",
        toolName: toolCall.toolName,
        toolInput: toolCall.input,
        toolOutputSummary: null,
        queryRef: null,
        timeWindow: null,
        resultCount: null,
        evidenceRefs: [],
        error: null,
        rawRef: toolCall.id,
        metadata: { source: "mcp-jsonrpc-transcript" }
      });
      pending.set(toolCall.id, { traceEventId, toolName: toolCall.toolName, input: toolCall.input });
      toolNames.add(toolCall.toolName);
      toolCalls += 1;
      continue;
    }

    if (isMcpResponse(record)) {
      const responseId = String(record.id);
      const parent = pending.get(responseId);

      if (!parent) {
        skippedRecords += 1;
        continue;
      }

      const result = record.result;
      const error = record.error ?? (isRecord(result) && result.isError === true ? result : undefined);

      if (error) {
        addTraceEvent({
          timestamp,
          actor: "splunk_adapter",
          type: "error",
          toolName: parent.toolName,
          toolInput: null,
          toolOutputSummary: null,
          queryRef: null,
          timeWindow: null,
          resultCount: null,
          evidenceRefs: [],
          error: isRecord(error) ? error : { message: String(error) },
          parentId: parent.traceEventId,
          rawRef: responseId,
          metadata: { source: "mcp-jsonrpc-transcript" }
        });
        errors += 1;
        continue;
      }

      const output = extractStructuredOutput(result);
      const resultCount = resultCountFromOutput(output);
      const evidenceRefs = evidenceRefsFromOutput(output);
      addTraceEvent({
        timestamp,
        actor: "splunk_adapter",
        type: "tool_result",
        toolName: parent.toolName,
        toolInput: null,
        toolOutputSummary: outputSummaryFor(parent.toolName, output, resultCount),
        queryRef: queryRefFor(parent, output),
        timeWindow: null,
        resultCount,
        evidenceRefs,
        error: null,
        parentId: parent.traceEventId,
        rawRef: responseId,
        metadata: { source: "mcp-jsonrpc-transcript" }
      });
      toolResults += 1;
      continue;
    }

    if (isFinalAnswerRecord(record)) {
      const text = finalAnswerText(record);

      if (!text) {
        skippedRecords += 1;
        continue;
      }

      const evidenceRefs = Array.isArray(record.evidenceRefs)
        ? record.evidenceRefs.filter((ref): ref is string => typeof ref === "string" && ref.length > 0)
        : [];
      addTraceEvent({
        timestamp,
        actor: "specimen_agent",
        type: "final_answer",
        toolName: null,
        toolInput: null,
        toolOutputSummary: text,
        queryRef: null,
        timeWindow: null,
        resultCount: numberValue(record.resultCount) ?? null,
        evidenceRefs,
        error: null,
        parentId: traceEvents.at(-1)?.id,
        metadata: { source: "mcp-jsonrpc-transcript" }
      });
      finalAnswers += 1;
      continue;
    }

    skippedRecords += 1;
  }

  if (traceEvents.length === 0) {
    throw new Error("MCP transcript did not contain importable Splunk MCP tool calls or final answers.");
  }

  return {
    traceEvents,
    summary: {
      status: "PASS",
      source: "mcp-jsonrpc-transcript",
      mutation: false,
      missionId,
      recordCount: records.length,
      importedEvents: traceEvents.length,
      toolCalls,
      toolResults,
      errors,
      finalAnswers,
      skippedRecords,
      toolNames: [...toolNames].sort()
    }
  };
};
