import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import {
  createFixtureSplunkAccessAdapter,
  fixtureSplunkDatasetSchema,
  loadFixtureSplunkDatasetFromFile
} from "../../src/adapters/fixture.js";
import type { AdapterTraceEndEvent, AdapterTraceStartEvent } from "../../src/adapters/splunk-access.js";

const fixturePath = new URL("../../fixtures/acme-soc-dev/adapter-fixture.json", import.meta.url);
const requestOptions = { requestId: "req-fixture-001", missionId: "mission-lateral-movement" };

describe("fixture Splunk adapter", () => {
  it("loads and validates fixture data with mode and version metadata", async () => {
    const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);

    expect(fixture).toMatchObject({
      mode: "fixture",
      fixtureVersion: "2026.06.01",
      deploymentName: "acme-soc-dev"
    });
    expect(fixture.readOnlyTools).toContain("splunk_get_knowledge_objects");
  });

  it("rejects invalid fixture data at load time", () => {
    const invalidFixture = {
      mode: "fixture",
      deploymentName: "missing-version"
    };

    expect(() => fixtureSplunkDatasetSchema.parse(invalidFixture)).toThrow(ZodError);
  });

  it("implements the shared adapter interface through deterministic fixture responses", async () => {
    const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
    const adapter = createFixtureSplunkAccessAdapter(fixture);

    await expect(adapter.getInfo(requestOptions)).resolves.toMatchObject({
      mode: "fixture",
      deploymentName: "acme-soc-dev"
    });
    await expect(adapter.getUserInfo(requestOptions)).resolves.toMatchObject({
      username: "fixture-user"
    });
    await expect(adapter.getIndexes(requestOptions)).resolves.toHaveLength(2);
    await expect(
      adapter.getMetadata({ indexes: ["wineventlog"], sourcetypes: ["XmlWinEventLog:Security"] }, requestOptions)
    ).resolves.toMatchObject({ source: "fixture" });
    await expect(
      adapter.getKnowledgeObjects({ types: ["saved_searches"], query: "lateral movement" }, requestOptions)
    ).resolves.toMatchObject({ resultCount: 3 });
    await expect(
      adapter.getKnowledgeObjects(
        {
          types: ["saved_searches"],
          app: "SplunkEnterpriseSecuritySuite",
          query: 'name="ES - Lateral Movement Auth Chain"'
        },
        requestOptions
      )
    ).resolves.toMatchObject({
      resultCount: 1,
      objects: [
        expect.objectContaining({
          app: "SplunkEnterpriseSecuritySuite",
          name: "ES - Lateral Movement Auth Chain"
        })
      ]
    });
    await expect(
      adapter.getKnowledgeObjects(
        {
          types: ["saved_searches"],
          query: "name=ES - Lateral Movement Auth Chain app=SplunkEnterpriseSecuritySuite"
        },
        requestOptions
      )
    ).resolves.toMatchObject({ resultCount: 2 });
    await expect(
      adapter.getKnowledgeObjects({ types: ["saved_searches"], query: '"lateral movement"' }, requestOptions)
    ).resolves.toMatchObject({ resultCount: 3 });
    await expect(
      adapter.runQuery(
        { query: "search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now" },
        requestOptions
      )
    ).resolves.toMatchObject({ queryRef: "query-naive-lateral-movement", resultCount: 0 });
    await expect(
      adapter.runSavedSearch(
        {
          name: "ES - Lateral Movement Auth Chain",
          app: "SplunkEnterpriseSecuritySuite"
        },
        requestOptions
      )
    ).resolves.toMatchObject({ resultCount: 3, evidenceRefs: ["evt-102", "evt-118", "evt-141"] });
  });

  it("records deterministic trace hook events around fixture calls", async () => {
    const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
    const starts: AdapterTraceStartEvent[] = [];
    const ends: AdapterTraceEndEvent[] = [];
    const adapter = createFixtureSplunkAccessAdapter(fixture, {
      onToolStart: (event) => {
        starts.push(event);
      },
      onToolEnd: (event) => {
        ends.push(event);
      }
    });

    await adapter.getUserInfo(requestOptions);
    await adapter.runSavedSearch(
      {
        name: "ES - Lateral Movement Auth Chain",
        app: "SplunkEnterpriseSecuritySuite"
      },
      requestOptions
    );

    expect(starts).toHaveLength(2);
    expect(ends).toHaveLength(2);
    expect(starts[0]?.context).toMatchObject({
      mode: "fixture",
      toolName: "splunk_get_user_info",
      requestId: "req-fixture-001"
    });
    expect(starts[1]?.context).toMatchObject({
      mode: "fixture",
      toolName: "splunk_run_saved_search",
      requestId: "req-fixture-001"
    });
    expect(ends[1]).toMatchObject({
      resultCount: 3,
      evidenceRefs: ["evt-102", "evt-118", "evt-141"]
    });
  });
});
