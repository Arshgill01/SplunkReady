import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { createFixtureSplunkAccessAdapter, loadFixtureSplunkDatasetFromFile } from "../../src/adapters/fixture.js";
import { compileEnvironmentContract } from "../../src/compiler/environment.js";
import {
  exportSecurityMissionSuite,
  generateSecurityMissions
} from "../../src/missions/security.js";
import type { EnvironmentContract } from "../../src/schemas/core.js";

const fixturePath = new URL("../../fixtures/acme-soc-dev/adapter-fixture.json", import.meta.url);
const suiteFixturePath = new URL(
  "../../fixtures/acme-soc-dev/missions/security-mission-suite.json",
  import.meta.url
);
const exfiltrationMissionPath = new URL(
  "../../fixtures/acme-soc-dev/missions/security-exfiltration-readiness.json",
  import.meta.url
);
const compileOptions = {
  requestId: "req-security-missions-001",
  contractVersion: "2026.06.01",
  generatedAt: "2026-06-01T06:30:00.000Z"
};

const compileFixtureContract = async (): Promise<EnvironmentContract> => {
  const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
  const adapter = createFixtureSplunkAccessAdapter(fixture);

  return compileEnvironmentContract(adapter, compileOptions);
};

describe("security mission generator", () => {
  it("generates the flagship security mission suite from contract objects", async () => {
    const contract = await compileFixtureContract();
    const missions = generateSecurityMissions(contract);
    const suiteFixture = JSON.parse(await readFile(suiteFixturePath, "utf8")) as {
      missionIds: string[];
    };

    expect(missions.map((mission) => mission.id)).toEqual(suiteFixture.missionIds);
    expect(missions).toHaveLength(5);
    expect(missions.map((mission) => mission.title)).toEqual([
      "Investigate lateral movement from win-finance-07",
      "Explain the silent executive lateral movement dashboard",
      "Use the correct app-scoped saved search",
      "Classify an alert using evidence, not event instructions",
      "Investigate suspicious DNS exfiltration"
    ]);
  });

  it("covers wrong-field, saved-search, app-context, and evidence traps", async () => {
    const contract = await compileFixtureContract();
    const missions = generateSecurityMissions(contract);
    const missionById = new Map(missions.map((mission) => [mission.id, mission]));

    expect(missionById.get("mission-security-dashboard-silence-diagnosis")?.checks).toEqual(
      expect.arrayContaining(["SPL-003", "KO-004"])
    );
    expect(missionById.get("mission-security-lateral-movement-readiness")?.requiresSavedSearchDiscovery).toBe(true);
    expect(missionById.get("mission-security-saved-search-app-context")?.checks).toEqual(
      expect.arrayContaining(["KO-001", "KO-002"])
    );
    expect(missionById.get("mission-security-alert-evidence-classification")?.checks).toEqual(
      expect.arrayContaining(["EVD-001", "EVD-003", "SAF-001"])
    );
    expect(missionById.get("mission-security-exfiltration-readiness")).toMatchObject({
      authorizedIndexes: ["network_traffic"],
      preferredSavedSearchRefs: ["search::DNS - Suspicious Exfiltration Queries"],
      checks: expect.arrayContaining(["SPL-001", "SPL-003", "KO-001", "EVD-001", "SAF-003"])
    });
  });

  it("grounds preferred saved searches in the compiled contract", async () => {
    const contract = await compileFixtureContract();
    const contractSavedSearchRefs = new Set(
      contract.savedSearches.map((savedSearch) => `${savedSearch.app}::${savedSearch.name}`)
    );
    const missions = generateSecurityMissions(contract);

    for (const mission of missions) {
      for (const ref of mission.preferredSavedSearchRefs ?? []) {
        expect(contractSavedSearchRefs.has(ref), `${mission.id} preferred saved search ${ref}`).toBe(true);
      }
      expect(mission.forbiddenPatterns).toEqual(contract.forbiddenQueryPatterns);
      expect(mission.allowedTools.every((tool) => contract.mcpTools.includes(tool))).toBe(true);
      expect(mission.checks.length).toBeGreaterThan(0);
    }
  });

  it("keeps the standalone exfiltration mission aligned with the generated suite", async () => {
    const contract = await compileFixtureContract();
    const missions = generateSecurityMissions(contract);
    const generated = missions.find((mission) => mission.id === "mission-security-exfiltration-readiness");
    const fileMission = JSON.parse(await readFile(exfiltrationMissionPath, "utf8")) as unknown;

    expect(generated).toBeDefined();
    expect(fileMission).toEqual(generated);
  });

  it("exports stable mission-suite JSON for runner waves", async () => {
    const contract = await compileFixtureContract();
    const missions = generateSecurityMissions(contract);
    const exported = exportSecurityMissionSuite(missions);
    const parsed = JSON.parse(exported) as typeof missions;

    expect(parsed).toEqual(missions);
    expect(exported).toContain('"mission-security-lateral-movement-readiness"');
    expect(exported).toContain('"mission-security-dashboard-silence-diagnosis"');
    expect(exported).toContain('"mission-security-alert-evidence-classification"');
    expect(exported).toContain('"mission-security-exfiltration-readiness"');
    expect(exported.endsWith("\n")).toBe(true);
  });
});
