import { describe, expect, it } from "vitest";

import { loadFixtureSplunkDatasetFromFile } from "../../src/adapters/fixture.js";

const fixturePath = new URL("../../fixtures/acme-soc-dev/adapter-fixture.json", import.meta.url);

const findKnowledgeObject = async (id: string) => {
  const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
  const object = fixture.knowledgeObjects.find((candidate) => candidate.id === id);

  expect(object).toBeDefined();
  return object;
};

describe("fixture knowledge-object traps", () => {
  it("seeds a deterministic wrong-field trap for src_ip versus src", async () => {
    const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
    const securitySourcetype = fixture.sourcetypes.find((sourcetype) => sourcetype.name === "XmlWinEventLog:Security");
    const staleFieldSearch = await findKnowledgeObject("saved-search-dashboard-lateral-movement-stale-field");
    const fieldAlias = await findKnowledgeObject("field-alias-auth-source");

    expect(securitySourcetype?.fields).toContain("src");
    expect(securitySourcetype?.fields).not.toContain("src_ip");
    expect(staleFieldSearch?.metadata).toMatchObject({
      fieldTrap: {
        staleField: "src_ip",
        canonicalField: "src",
        sourcetype: "XmlWinEventLog:Security"
      },
      trapRulesSupported: ["SPL-003", "KO-004"]
    });
    expect(fieldAlias?.metadata).toMatchObject({
      canonicalField: "src",
      absentField: "src_ip",
      trapRulesSupported: ["SPL-003"]
    });
  });

  it("seeds saved-search and app-context traps with stable ids and app names", async () => {
    const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
    const savedSearches = fixture.knowledgeObjects.filter((object) => object.type === "saved_searches");
    const duplicateNames = savedSearches.filter((object) => object.name === "ES - Lateral Movement Auth Chain");

    expect(savedSearches.map((object) => object.id)).toEqual(
      expect.arrayContaining([
        "saved-search-lateral-movement",
        "saved-search-lateral-movement-wrong-app",
        "saved-search-dashboard-lateral-movement-stale-field"
      ])
    );
    expect(duplicateNames.map((object) => object.app).sort()).toEqual(["SplunkEnterpriseSecuritySuite", "search"]);
    expect(duplicateNames.every((object) => object.id.length > 0 && object.app.length > 0)).toBe(true);
  });

  it("seeds dashboard, panel, macro, lookup, field alias, and data model hints", async () => {
    const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
    const types = new Set(fixture.knowledgeObjects.map((object) => object.type));
    const dashboard = await findKnowledgeObject("dashboard-executive-lateral-movement");
    const panel = await findKnowledgeObject("panel-executive-lateral-movement-silence");

    expect(types).toEqual(
      new Set(["saved_searches", "dashboards", "panels", "macros", "lookups", "field_aliases", "data_models"])
    );
    expect(dashboard?.dependsOn).toContain("panel-executive-lateral-movement-silence");
    expect(panel?.dependsOn).toContain("saved-search-dashboard-lateral-movement-stale-field");
    expect(
      fixture.knowledgeObjects.every((object) => object.id.length > 0 && object.app.length > 0)
    ).toBe(true);
  });
});
