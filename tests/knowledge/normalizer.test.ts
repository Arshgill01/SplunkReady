import { describe, expect, it } from "vitest";

import { loadFixtureSplunkDatasetFromFile } from "../../src/adapters/fixture.js";
import type { KnowledgeObjectSummary } from "../../src/adapters/splunk-access.js";
import {
  appContextsFromKnowledgeObjects,
  normalizeKnowledgeObject,
  normalizeKnowledgeObjects
} from "../../src/knowledge/normalizer.js";

const fixturePath = new URL("../../fixtures/acme-soc-dev/adapter-fixture.json", import.meta.url);

describe("knowledge object normalizer", () => {
  it("normalizes fixture objects into stable records without dropping app context", async () => {
    const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
    const normalized = normalizeKnowledgeObjects(fixture.knowledgeObjects);
    const wrongAppSearch = normalized.find((object) => object.id === "saved-search-lateral-movement-wrong-app");

    expect(normalized).toHaveLength(fixture.knowledgeObjects.length);
    expect(normalized.every((object) => object.id && object.type && object.name && object.app)).toBe(true);
    expect(wrongAppSearch).toMatchObject({
      id: "saved-search-lateral-movement-wrong-app",
      type: "saved_searches",
      name: "ES - Lateral Movement Auth Chain",
      app: "search"
    });
    expect(appContextsFromKnowledgeObjects(normalized)).toEqual(["SplunkEnterpriseSecuritySuite", "search"]);
  });

  it("extracts deterministic dependencies from direct and metadata references", async () => {
    const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
    const normalized = normalizeKnowledgeObjects(fixture.knowledgeObjects);
    const dashboard = normalized.find((object) => object.id === "dashboard-executive-lateral-movement");
    const panel = normalized.find((object) => object.id === "panel-executive-lateral-movement-silence");

    expect(dashboard?.dependsOn).toEqual(["panel-executive-lateral-movement-silence"]);
    expect(panel?.dependsOn).toEqual([
      "dashboard-executive-lateral-movement",
      "saved-search-dashboard-lateral-movement-stale-field"
    ]);
  });

  it("preserves raw metadata for debugging and future deterministic graders", async () => {
    const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
    const normalized = normalizeKnowledgeObjects(fixture.knowledgeObjects);
    const staleSearch = normalized.find((object) => object.id === "saved-search-dashboard-lateral-movement-stale-field");

    expect(staleSearch?.metadata).toMatchObject({
      fieldTrap: {
        staleField: "src_ip",
        canonicalField: "src"
      },
      trapRulesSupported: ["SPL-003", "KO-004"]
    });
    expect(staleSearch?.raw).toMatchObject({
      id: "saved-search-dashboard-lateral-movement-stale-field",
      metadata: staleSearch?.metadata
    });
  });

  it("keeps owner and source only when the raw object provides them", () => {
    const rawObject: KnowledgeObjectSummary = {
      id: "saved-search-owned",
      type: "saved_searches",
      name: "Owned Search",
      app: "search",
      metadata: {
        owner: "security-admin",
        source: "splunk://servicesNS/security-admin/search/saved/searches/Owned%20Search",
        savedSearchRef: "saved-search-parent",
        unknownShape: { preserve: true }
      }
    };
    const normalized = normalizeKnowledgeObject(rawObject);

    expect(normalized).toMatchObject({
      owner: "security-admin",
      source: "splunk://servicesNS/security-admin/search/saved/searches/Owned%20Search",
      dependsOn: ["saved-search-parent"],
      metadata: {
        unknownShape: { preserve: true }
      },
      raw: rawObject
    });
  });
});
