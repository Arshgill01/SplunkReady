import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { traceEventSchema } from "../../src/schemas/core.js";

type TraceFixtureEvent = Record<string, unknown>;

const loadTraceFixture = async (name: string) => {
  const fileUrl = new URL(`../../fixtures/acme-soc-dev/traces/${name}.json`, import.meta.url);
  const rawTrace = await readFile(fileUrl, "utf8");
  const parsedTrace: unknown = JSON.parse(rawTrace);

  expect(Array.isArray(parsedTrace)).toBe(true);
  return parsedTrace as TraceFixtureEvent[];
};

describe("fixture trace examples", () => {
  it("validates before and after traces against the trace event schema", async () => {
    const traces = await Promise.all([loadTraceFixture("naive-failure"), loadTraceFixture("contract-aware-pass")]);

    for (const trace of traces.flat()) {
      expect(traceEventSchema.safeParse(trace).success).toBe(true);
    }
  });

  it("captures a natural naive failure with tool inputs intact", async () => {
    const trace = await loadTraceFixture("naive-failure");
    const toolCalls = trace.filter((event) => event["type"] === "tool_call");
    const finalAnswer = trace.find((event) => event["type"] === "final_answer");

    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]).toMatchObject({
      toolName: "splunk_run_query",
      toolInput: {
        query: "search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now"
      }
    });
    expect(trace.some((event) => event["toolName"] === "splunk_get_knowledge_objects")).toBe(false);
    expect(finalAnswer).toMatchObject({
      toolName: null,
      toolInput: null,
      evidenceRefs: [],
      toolOutputSummary: "No evidence of lateral movement was found."
    });
  });

  it("captures a contract-informed pass with discovery before saved-search execution", async () => {
    const trace = await loadTraceFixture("contract-aware-pass");
    const toolCalls = trace.filter((event) => event["type"] === "tool_call");
    const savedSearchResult = trace.find((event) => event["id"] === "trace-pass-result-002");
    const finalAnswer = trace.find((event) => event["type"] === "final_answer");

    expect(toolCalls.map((event) => event["toolName"])).toEqual([
      "splunk_get_knowledge_objects",
      "splunk_run_saved_search"
    ]);
    expect(savedSearchResult).toMatchObject({
      resultCount: 3,
      evidenceRefs: ["evt-102", "evt-118", "evt-141"],
      parentId: "trace-pass-call-002"
    });
    expect(finalAnswer).toMatchObject({
      resultCount: 3,
      evidenceRefs: ["evt-102", "evt-118", "evt-141"]
    });
  });
});
