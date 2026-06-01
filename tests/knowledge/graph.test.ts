import { describe, expect, it } from "vitest";

import { loadFixtureSplunkDatasetFromFile } from "../../src/adapters/fixture.js";
import type { KnowledgeObjectSummary } from "../../src/adapters/splunk-access.js";
import {
  buildKnowledgeGraphFromRawObjects,
  explainDependencyPath
} from "../../src/knowledge/graph.js";

const fixturePath = new URL("../../fixtures/acme-soc-dev/adapter-fixture.json", import.meta.url);

describe("knowledge graph", () => {
  it("builds deterministic fixture edges with provenance", async () => {
    const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
    const graph = buildKnowledgeGraphFromRawObjects(fixture.knowledgeObjects);

    expect(graph.warnings).toEqual([]);
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "dashboard-executive-lateral-movement",
          to: "panel-executive-lateral-movement-silence",
          type: "dashboard_panel",
          provenance: {
            sourceObjectId: "dashboard-executive-lateral-movement",
            source: "dependsOn",
            detail: "panel-executive-lateral-movement-silence"
          }
        }),
        expect.objectContaining({
          from: "panel-executive-lateral-movement-silence",
          to: "saved-search-dashboard-lateral-movement-stale-field",
          type: "panel_saved_search",
          provenance: {
            sourceObjectId: "panel-executive-lateral-movement-silence",
            source: "dependsOn",
            detail: "saved-search-dashboard-lateral-movement-stale-field"
          }
        }),
        expect.objectContaining({
          from: "saved-search-lateral-movement",
          to: "macro-security-content-ctime",
          type: "saved_search_macro",
          provenance: {
            sourceObjectId: "saved-search-lateral-movement",
            source: "dependsOn",
            detail: "macro-security-content-ctime"
          }
        }),
        expect.objectContaining({
          from: "saved-search-lateral-movement",
          to: "lookup-asset-lookup",
          type: "search_lookup",
          provenance: {
            sourceObjectId: "saved-search-lateral-movement",
            source: "dependsOn",
            detail: "lookup-asset-lookup"
          }
        })
      ])
    );
    expect(graph.edges.map((edge) => edge.id)).toEqual([...graph.edges.map((edge) => edge.id)].sort());
  });

  it("extracts search field and sourcetype nodes without LLM parsing", async () => {
    const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
    const graph = buildKnowledgeGraphFromRawObjects(fixture.knowledgeObjects);

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "field:src_ip", kind: "field", label: "src_ip" }),
        expect.objectContaining({
          id: "sourcetype:XmlWinEventLog:Security",
          kind: "sourcetype",
          label: "XmlWinEventLog:Security"
        })
      ])
    );
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "saved-search-dashboard-lateral-movement-stale-field",
          to: "field:src_ip",
          type: "search_field",
          provenance: expect.objectContaining({
            sourceObjectId: "saved-search-dashboard-lateral-movement-stale-field"
          })
        }),
        expect.objectContaining({
          from: "saved-search-dashboard-lateral-movement-stale-field",
          to: "sourcetype:XmlWinEventLog:Security",
          type: "search_sourcetype"
        })
      ])
    );
  });

  it("explains why a panel depends on a stale field through a saved search", async () => {
    const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
    const graph = buildKnowledgeGraphFromRawObjects(fixture.knowledgeObjects);
    const path = explainDependencyPath(
      graph,
      "panel-executive-lateral-movement-silence",
      "field:src_ip"
    );

    expect(path.map((edge) => [edge.from, edge.to, edge.type])).toEqual([
      [
        "panel-executive-lateral-movement-silence",
        "saved-search-dashboard-lateral-movement-stale-field",
        "panel_saved_search"
      ],
      ["saved-search-dashboard-lateral-movement-stale-field", "field:src_ip", "search_field"]
    ]);
  });

  it("keeps missing dependencies as warnings", () => {
    const objects: KnowledgeObjectSummary[] = [
      {
        id: "saved-search-orphan",
        type: "saved_searches",
        name: "Orphan Search",
        app: "search",
        dependsOn: ["macro-missing"]
      }
    ];
    const graph = buildKnowledgeGraphFromRawObjects(objects);

    expect(graph.edges.find((edge) => edge.to === "macro-missing")).toBeUndefined();
    expect(graph.warnings).toEqual([
      {
        code: "MISSING_DEPENDENCY",
        objectId: "saved-search-orphan",
        dependencyId: "macro-missing",
        message: "saved-search-orphan references missing knowledge object macro-missing."
      }
    ]);
  });
});
