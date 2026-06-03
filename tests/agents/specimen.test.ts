import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { createFixtureSplunkAccessAdapter, loadFixtureSplunkDatasetFromFile } from "../../src/adapters/fixture.js";
import { NaiveSpecimenAgent } from "../../src/agents/specimen.js";
import { compileEnvironmentContract } from "../../src/compiler/environment.js";
import { parseMissionDefinition } from "../../src/missions/dsl.js";
import { compileAgentPolicy } from "../../src/policy/compiler.js";
import { traceEventSchema } from "../../src/schemas/core.js";

const fixturePath = new URL("../../fixtures/acme-soc-dev/adapter-fixture.json", import.meta.url);
const missionPath = new URL(
  "../../fixtures/acme-soc-dev/missions/security-investigation-readiness.json",
  import.meta.url
);
const observabilityMissionPath = new URL(
  "../../fixtures/acme-soc-dev/missions/observability-latency-readiness.json",
  import.meta.url
);
const compileOptions = {
  requestId: "req-specimen-agent-001",
  contractVersion: "2026.06.01",
  generatedAt: "2026-06-01T06:30:00.000Z"
};

const loadMission = async () => parseMissionDefinition(JSON.parse(await readFile(missionPath, "utf8")) as unknown);
const loadObservabilityMission = async () =>
  parseMissionDefinition(JSON.parse(await readFile(observabilityMissionPath, "utf8")) as unknown);

describe("naive specimen agent", () => {
  it("runs a failing fixture mission naturally without contract or policy", async () => {
    const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
    const adapter = createFixtureSplunkAccessAdapter(fixture);
    const mission = await loadMission();
    const agent = new NaiveSpecimenAgent();
    const run = await agent.run({ mission, adapter });
    const toolCall = run.traceEvents.find((event) => event.type === "tool_call");
    const toolResult = run.traceEvents.find((event) => event.type === "tool_result");
    const finalAnswer = run.traceEvents.find((event) => event.type === "final_answer");

    expect(toolCall).toMatchObject({
      toolName: "splunk_run_query",
      toolInput: {
        query: "search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now"
      }
    });
    expect(toolResult).toMatchObject({
      queryRef: "query-naive-lateral-movement",
      resultCount: 0,
      evidenceRefs: []
    });
    expect(finalAnswer).toMatchObject({
      toolOutputSummary: "No evidence was found by the naive broad search.",
      evidenceRefs: [],
      parentId: "mission-security-lateral-movement-readiness-trace-001-result"
    });
    expect(run.traceEvents.every((event) => traceEventSchema.safeParse(event).success)).toBe(true);
  });

  it("accepts a policy injection point and uses validated saved-search preference", async () => {
    const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
    const adapter = createFixtureSplunkAccessAdapter(fixture);
    const contract = await compileEnvironmentContract(adapter, compileOptions);
    const policy = compileAgentPolicy(contract, {
      policyVersion: "policy-2026.06.01",
      compiledAt: "2026-06-01T06:45:00.000Z"
    });
    const mission = await loadMission();
    const agent = new NaiveSpecimenAgent();
    const run = await agent.run({ mission, adapter, policy });

    expect(run.traceEvents.map((event) => event.toolName)).toEqual([
      "splunk_get_knowledge_objects",
      "splunk_get_knowledge_objects",
      "splunk_run_saved_search",
      "splunk_run_saved_search",
      null
    ]);
    expect(run.traceEvents[0]).toMatchObject({
      toolName: "splunk_get_knowledge_objects",
      toolInput: {
        query: "ES - Lateral Movement Auth Chain"
      }
    });
    expect(run.traceEvents[1]).toMatchObject({
      resultCount: 2,
      evidenceRefs: ["saved-search-lateral-movement", "saved-search-lateral-movement-wrong-app"]
    });
    expect(run.traceEvents[2]).toMatchObject({
      toolName: "splunk_run_saved_search",
      toolInput: {
        name: "ES - Lateral Movement Auth Chain",
        app: "SplunkEnterpriseSecuritySuite",
        tokens: {
          host: "win-finance-07",
          earliest: "-24h",
          latest: "now"
        }
      }
    });
    expect(run.traceEvents[3]).toMatchObject({
      queryRef: "saved-search-lateral-movement",
      resultCount: 3,
      evidenceRefs: ["evt-102", "evt-118", "evt-141"]
    });
    expect(run.traceEvents[4]).toMatchObject({
      parentId: "mission-security-lateral-movement-readiness-trace-003-result"
    });
    expect(run.finalAnswer).toContain("Evidence supports the investigation");
    expect(run.traceEvents.every((event) => traceEventSchema.safeParse(event).success)).toBe(true);
  });

  it("does not switch to saved-search behavior for an unrelated policy", async () => {
    const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
    const adapter = createFixtureSplunkAccessAdapter(fixture);
    const contract = await compileEnvironmentContract(adapter, compileOptions);
    const unrelatedPolicy = {
      ...compileAgentPolicy(contract, {
        policyVersion: "policy-2026.06.01",
        compiledAt: "2026-06-01T06:45:00.000Z"
      }),
      knowledgeRules: []
    };
    const mission = await loadMission();
    const agent = new NaiveSpecimenAgent();
    const run = await agent.run({ mission, adapter, policy: unrelatedPolicy });

    expect(run.traceEvents[0]).toMatchObject({
      toolName: "splunk_run_query",
      toolInput: {
        query: "search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now"
      }
    });
    expect(run.traceEvents.map((event) => event.toolName)).not.toContain("splunk_run_saved_search");
  });

  it("uses a policy-backed bounded query for observability missions without saved-search preference", async () => {
    const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
    const adapter = createFixtureSplunkAccessAdapter(fixture);
    const contract = await compileEnvironmentContract(adapter, compileOptions);
    const policy = compileAgentPolicy(contract, {
      policyVersion: "policy-2026.06.01",
      compiledAt: "2026-06-01T06:45:00.000Z"
    });
    const mission = await loadObservabilityMission();
    const agent = new NaiveSpecimenAgent();
    const run = await agent.run({ mission, adapter, policy });

    expect(run.traceEvents.map((event) => event.toolName)).toEqual(["splunk_run_query", "splunk_run_query", null]);
    expect(run.traceEvents[0]).toMatchObject({
      toolName: "splunk_run_query",
      toolInput: {
        query:
          "search index=_internal component=HttpPubSubConnection earliest=-15m latest=now | stats p95(latency_ms) as p95_latency_ms by service"
      }
    });
    expect(run.traceEvents[1]).toMatchObject({
      queryRef: "query-observability-latency",
      resultCount: 4,
      evidenceRefs: ["obs-201", "obs-202", "obs-203", "obs-204"]
    });
    expect(run.finalAnswer).toContain("query-observability-latency");
    expect(run.finalAnswer).toContain("obs-201");
    expect(run.traceEvents.every((event) => traceEventSchema.safeParse(event).success)).toBe(true);
  });
});
