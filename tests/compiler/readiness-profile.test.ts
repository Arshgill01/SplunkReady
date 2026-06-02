import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { createFixtureSplunkAccessAdapter, loadFixtureSplunkDatasetFromFile } from "../../src/adapters/fixture.js";
import { compileEnvironmentContract } from "../../src/compiler/environment.js";
import { compileReadinessProfile } from "../../src/compiler/readiness-profile.js";
import { parseMissionDefinition } from "../../src/missions/dsl.js";

const fixturePath = new URL("../../fixtures/acme-soc-dev/adapter-fixture.json", import.meta.url);
const missionPath = new URL("../../fixtures/acme-soc-dev/missions/security-investigation-readiness.json", import.meta.url);
const compileOptions = {
  requestId: "req-readiness-profile-001",
  contractVersion: "2026.06.01",
  generatedAt: "2026-06-01T06:30:00.000Z"
};
const profileOptions = {
  profileVersion: "profile-2026.06.01",
  generatedAt: "2026-06-01T06:45:00.000Z"
};

const loadMission = async () => {
  const text = await readFile(missionPath, "utf8");

  return parseMissionDefinition(JSON.parse(text) as unknown);
};

const compileFixtureProfile = async () => {
  const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
  const adapter = createFixtureSplunkAccessAdapter(fixture);
  const contract = await compileEnvironmentContract(adapter, compileOptions);
  const mission = await loadMission();

  return compileReadinessProfile(contract, [mission], profileOptions);
};

describe("readiness profile compiler", () => {
  it("compiles a deployment-derived readiness profile from the Splunk contract", async () => {
    const profile = await compileFixtureProfile();

    expect(profile).toMatchObject({
      id: "readiness-profile-contract-acme-soc-dev-profile-2026-06-01",
      compiler: "Agent Readiness Compiler",
      contractRef: {
        id: "contract-acme-soc-dev",
        name: "acme-soc-dev",
        version: "2026.06.01",
        mode: "fixture"
      },
      deploymentSignals: {
        mode: "fixture",
        indexCount: 6,
        restrictedIndexCount: 1,
        sourcetypeCount: 4,
        savedSearchCount: 8,
        appContextCount: 2,
        dataModelCount: 1,
        queryBudgets: { maxToolCalls: 6, maxResultRows: 50, timeoutSeconds: 30 }
      },
      llmUsage: { passFailAuthority: "deterministic-rule-engine" }
    });
    expect(profile.sourceRefs).toEqual(
      expect.arrayContaining([
        "splunk_get_info",
        "splunk_get_indexes",
        "splunk_get_metadata",
        "splunk_get_knowledge_objects",
        "mission:mission-security-lateral-movement-readiness"
      ])
    );
  });

  it("binds rule catalog IDs to Splunk contract evidence instead of static demo prose", async () => {
    const profile = await compileFixtureProfile();

    expect(profile.ruleBindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "SPL-005",
          severity: "High",
          source: "splunk_contract",
          contractRefs: ["contract-acme-soc-dev.restrictedIndexes"],
          evidence: expect.arrayContaining([
            { ref: "contract-acme-soc-dev.restrictedIndexes", value: ["finance_pii"] }
          ])
        }),
        expect.objectContaining({
          ruleId: "KO-001",
          source: "splunk_contract",
          contractRefs: expect.arrayContaining(["contract-acme-soc-dev.savedSearches"]),
          evidence: expect.arrayContaining([
            expect.objectContaining({
              ref: "contract-acme-soc-dev.savedSearches",
              value: expect.arrayContaining([
                { app: "SplunkEnterpriseSecuritySuite", name: "ES - Lateral Movement Auth Chain" }
              ])
            })
          ])
        }),
        expect.objectContaining({
          ruleId: "SAF-003",
          source: "splunk_contract",
          contractRefs: expect.arrayContaining(["contract-acme-soc-dev.mcpTools"]),
          evidence: expect.arrayContaining([
            expect.objectContaining({
              ref: "contract-acme-soc-dev.mcpTools",
              value: expect.arrayContaining(["splunk_run_query", "splunk_run_saved_search"])
            })
          ])
        })
      ])
    );
  });

  it("keeps LLM usage advisory and never authoritative for pass/fail", async () => {
    const profile = await compileFixtureProfile();

    expect(profile.llmUsage.allowedRoles).toEqual(
      expect.arrayContaining(["explain deterministic violations", "draft policy patch text after rule failures"])
    );
    expect(profile.llmUsage.prohibitedRoles).toEqual(
      expect.arrayContaining(["decide pass/fail readiness", "replace forbidden query pattern checks"])
    );
  });
});
