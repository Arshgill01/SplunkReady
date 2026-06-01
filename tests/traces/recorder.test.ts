import { describe, expect, it } from "vitest";

import { TraceRecorder } from "../../src/traces/recorder.js";
import { traceEventSchema } from "../../src/schemas/core.js";

describe("trace recorder", () => {
  it("records tool call, result, and final answer with stable links", () => {
    const recorder = new TraceRecorder({
      missionId: "mission-security-lateral-movement-readiness",
      timestamp: "2026-06-01T07:00:00.000Z"
    });
    const callId = recorder.recordToolCall(
      "splunk_run_query",
      {
        query: "search index=wineventlog host=win-finance-07 src=* earliest=-24h latest=now"
      },
      { earliest: "-24h", latest: "now" }
    );
    const resultId = recorder.recordToolResult({
      parentId: callId,
      toolName: "splunk_run_query",
      outputSummary: "Query returned 3 row(s).",
      queryRef: "query-canonical-lateral-movement",
      timeWindow: { earliest: "-24h", latest: "now" },
      resultCount: 3,
      evidenceRefs: ["evt-102", "evt-118", "evt-141"]
    });
    recorder.recordFinalAnswer({
      outputSummary: "Evidence supports suspicious lateral movement.",
      timeWindow: { earliest: "-24h", latest: "now" },
      resultCount: 3,
      evidenceRefs: ["evt-102", "evt-118", "evt-141"],
      parentId: resultId
    });
    const events = recorder.events();

    expect(events.map((event) => event.id)).toEqual([
      "mission-security-lateral-movement-readiness-trace-001",
      "mission-security-lateral-movement-readiness-trace-002",
      "mission-security-lateral-movement-readiness-trace-003"
    ]);
    expect(events[1]).toMatchObject({
      type: "tool_result",
      parentId: callId,
      resultCount: 3,
      evidenceRefs: ["evt-102", "evt-118", "evt-141"]
    });
    expect(events[2]).toMatchObject({
      type: "final_answer",
      parentId: resultId,
      toolName: null,
      toolInput: null
    });
    expect(events.every((event) => traceEventSchema.safeParse(event).success)).toBe(true);
  });

  it("records adapter errors as structured trace events", () => {
    const recorder = new TraceRecorder({
      missionId: "mission-safety-sensitive-index-avoidance",
      timestamp: "2026-06-01T07:01:00.000Z"
    });
    const callId = recorder.recordToolCall("splunk_run_query", {
      query: "search index=finance_pii earliest=-24h latest=now"
    });
    const errorId = recorder.recordError(callId, "splunk_run_query", {
      code: "RESTRICTED_INDEX",
      message: "Index finance_pii is restricted."
    });
    const [call, error] = recorder.events();

    expect(call?.id).toBe(callId);
    expect(error).toMatchObject({
      id: errorId,
      type: "error",
      parentId: callId,
      toolName: "splunk_run_query",
      error: {
        code: "RESTRICTED_INDEX",
        message: "Index finance_pii is restricted."
      }
    });
    expect(traceEventSchema.safeParse(error).success).toBe(true);
  });
});
