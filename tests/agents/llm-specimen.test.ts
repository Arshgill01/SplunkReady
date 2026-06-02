import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { createFixtureSplunkAccessAdapter, loadFixtureSplunkDatasetFromFile } from "../../src/adapters/fixture.js";
import { compileEnvironmentContract } from "../../src/compiler/environment.js";
import { createAnswerRules } from "../../src/grader/answer.js";
import { createAppContextRules } from "../../src/grader/app-context.js";
import { createBudgetRules } from "../../src/grader/budget.js";
import { createContractLookupRules } from "../../src/grader/contract.js";
import { createEvidenceRules } from "../../src/grader/evidence.js";
import { runRuleEngine } from "../../src/grader/engine.js";
import { createInjectionRules } from "../../src/grader/injection.js";
import { createSavedSearchRules } from "../../src/grader/saved-search.js";
import { createSplStructuralRules } from "../../src/grader/spl.js";
import { LlmSpecimenAgent, type LlmAgentModel } from "../../src/agents/llm-specimen.js";
import { createGeminiLlmAgentModel } from "../../src/agents/gemini-model.js";
import { parseMissionDefinition } from "../../src/missions/dsl.js";
import { compileAgentPolicy } from "../../src/policy/compiler.js";
import type { EnvironmentContract } from "../../src/schemas/core.js";

const allRules = () => [
  ...createSplStructuralRules(),
  ...createContractLookupRules(),
  ...createSavedSearchRules(),
  ...createAppContextRules(),
  ...createEvidenceRules(),
  ...createAnswerRules(),
  ...createInjectionRules(),
  ...createBudgetRules()
];

const loadFixtureContext = async () => {
  const fixture = await loadFixtureSplunkDatasetFromFile("fixtures/acme-soc-dev/adapter-fixture.json");
  const adapter = createFixtureSplunkAccessAdapter(fixture);
  const contract = await compileEnvironmentContract(adapter, {
    requestId: "req-llm-agent-test-001",
    contractVersion: "2026.06.01",
    generatedAt: "2026-06-01T06:30:00.000Z"
  });
  const mission = parseMissionDefinition(
    JSON.parse(await readFile("fixtures/acme-soc-dev/missions/security-investigation-readiness.json", "utf8")) as unknown
  );

  return { adapter, contract, mission };
};

describe("LlmSpecimenAgent", () => {
  it("executes model-selected read-only Splunk tool calls and leaves pass/fail to deterministic rules", async () => {
    const { adapter, contract, mission } = await loadFixtureContext();
    const seenInputs: Array<{ allowedTools: string[]; contract: EnvironmentContract; contractInjected: boolean }> = [];
    const model: LlmAgentModel = {
      async plan(input) {
        seenInputs.push({
          allowedTools: input.allowedTools,
          contract: input.contract,
          contractInjected: input.contractInjected
        });
        return {
          rationale: "Discover validated searches, then run the preferred saved search.",
          toolCalls: [
            {
              toolName: "splunk_get_knowledge_objects",
              input: { types: ["saved_searches"], query: "Lateral Movement" }
            },
            {
              toolName: "splunk_run_saved_search",
              input: {
                app: "SplunkEnterpriseSecuritySuite",
                name: "ES - Lateral Movement Auth Chain",
                maxRows: 500
              }
            }
          ]
        };
      },
      async answer(input) {
        const lastObservation = input.observations.at(-1);
        return `Validated saved search ${lastObservation?.queryRef} returned ${lastObservation?.resultCount} results with evidence ${lastObservation?.evidenceRefs.join(", ")}.`;
      }
    };

    const run = await new LlmSpecimenAgent({ contract, model }).run({ mission, adapter });
    const violations = runRuleEngine({ contract, mission, traceEvents: run.traceEvents }, allRules()).violations;

    expect(seenInputs).toHaveLength(1);
    expect(seenInputs[0]?.allowedTools).toEqual(
      expect.arrayContaining(["splunk_get_knowledge_objects", "splunk_run_saved_search", "splunk_run_query"])
    );
    expect(seenInputs[0]?.contract.id).toBe("contract-acme-soc-dev");
    expect(seenInputs[0]).toMatchObject({ contractInjected: false });
    expect(run.traceEvents.map((event) => [event.type, event.toolName])).toEqual([
      ["tool_call", "splunk_get_knowledge_objects"],
      ["tool_result", "splunk_get_knowledge_objects"],
      ["tool_call", "splunk_run_saved_search"],
      ["tool_result", "splunk_run_saved_search"],
      ["final_answer", null]
    ]);
    expect(run.traceEvents[2]?.toolInput).toMatchObject({ maxRows: 50 });
    expect(run.observations.at(-1)).toMatchObject({
      toolName: "splunk_run_saved_search",
      queryRef: "saved-search-lateral-movement",
      resultCount: 3,
      evidenceRefs: ["evt-102", "evt-118", "evt-141"]
    });
    expect(run.finalAnswer).toContain("saved-search-lateral-movement");
    expect(violations).toEqual([]);
  });

  it("rejects unsupported or out-of-policy model tool requests before adapter execution", async () => {
    const { adapter, contract, mission } = await loadFixtureContext();
    const model = {
      async plan() {
        return {
          rationale: "Try an unsupported inventory tool.",
          toolCalls: [{ toolName: "splunk_get_indexes", input: {} }]
        };
      },
      async answer() {
        return "not reached";
      }
    } as unknown as LlmAgentModel;

    await expect(new LlmSpecimenAgent({ contract, model }).run({ mission, adapter })).rejects.toThrow(
      "unsupported tool splunk_get_indexes"
    );
  });

  it("rejects model plans that exceed the compiled tool-call budget", async () => {
    const { adapter, contract, mission } = await loadFixtureContext();
    const model: LlmAgentModel = {
      async plan() {
        return {
          rationale: "Too many calls.",
          toolCalls: Array.from({ length: 5 }, () => ({
            toolName: "splunk_get_knowledge_objects" as const,
            input: { types: ["saved_searches" as const] }
          }))
        };
      },
      async answer() {
        return "not reached";
      }
    };

    await expect(new LlmSpecimenAgent({ contract, model }).run({ mission, adapter })).rejects.toThrow(
      "max allowed is 4"
    );
  });

  it("injects compiled policy context only on policy-backed reruns", async () => {
    const { adapter, contract, mission } = await loadFixtureContext();
    const observed: Array<{ contractInjected: boolean; hasPolicy: boolean }> = [];
    const model: LlmAgentModel = {
      async plan(input) {
        observed.push({ contractInjected: input.contractInjected, hasPolicy: Boolean(input.policy) });
        return {
          rationale: "Use the preferred saved search when policy is injected.",
          toolCalls: [
            {
              toolName: "splunk_get_knowledge_objects",
              input: { types: ["saved_searches"], query: "Lateral Movement" }
            },
            {
              toolName: "splunk_run_saved_search",
              input: {
                app: "SplunkEnterpriseSecuritySuite",
                name: "ES - Lateral Movement Auth Chain"
              }
            }
          ]
        };
      },
      async answer(input) {
        return `contractInjected=${input.contractInjected}; observations=${input.observations.length}`;
      }
    };
    const agent = new LlmSpecimenAgent({ contract, model });

    await agent.run({ mission, adapter });
    await agent.run({
      mission,
      adapter,
      policy: compileAgentPolicy(contract, { policyVersion: "policy-test", compiledAt: "2026-06-01T06:45:00.000Z" })
    });

    expect(observed).toEqual([
      { contractInjected: false, hasPolicy: false },
      { contractInjected: true, hasPolicy: true }
    ]);
  });
});

describe("Gemini LLM specimen model", () => {
  it("parses JSON plan and answer responses from generateContent", async () => {
    const calls: Array<{ url: string; body: string }> = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), body: String(init?.body) });
      const payload =
        calls.length === 1
          ? {
              rationale: "Use the preferred saved search.",
              toolCalls: [
                {
                  toolName: "splunk_get_knowledge_objects",
                  input: { types: ["saved_searches"], query: "Lateral Movement" }
                }
              ]
            }
          : { finalAnswer: "Saved search provenance cited." };

      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };
    const { contract, mission } = await loadFixtureContext();
    const model = createGeminiLlmAgentModel({
      apiKey: "test-api-key",
      model: "gemini-test",
      endpointBaseUrl: "https://gemini.test/v1beta",
      fetchImpl
    });

    await expect(
      model.plan({ mission, contract, contractInjected: true, allowedTools: ["splunk_get_knowledge_objects"] })
    ).resolves.toMatchObject({
      toolCalls: [{ toolName: "splunk_get_knowledge_objects" }]
    });
    await expect(model.answer({ mission, contract, contractInjected: true, observations: [] })).resolves.toBe(
      "Saved search provenance cited."
    );
    expect(calls).toHaveLength(2);
    expect(calls[0]?.url).toBe("https://gemini.test/v1beta/models/gemini-test:generateContent?key=test-api-key");
    expect(calls[0]?.body).toContain('"responseMimeType":"application/json"');
  });
});
