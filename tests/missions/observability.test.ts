import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { createFixtureSplunkAccessAdapter, loadFixtureSplunkDatasetFromFile } from "../../src/adapters/fixture.js";
import { parseMissionDefinition } from "../../src/missions/dsl.js";

const fixturePath = new URL("../../fixtures/acme-soc-dev/adapter-fixture.json", import.meta.url);
const missionPath = new URL("../../fixtures/acme-soc-dev/missions/observability-latency-readiness.json", import.meta.url);
const latencyQuery =
  "search index=_internal component=HttpPubSubConnection earliest=-15m latest=now | stats p95(latency_ms) as p95_latency_ms by service";

const readMission = async () => parseMissionDefinition(JSON.parse(await readFile(missionPath, "utf8")) as unknown);

describe("observability transfer mission", () => {
  it("validates a small non-security mission using the same mission DSL", async () => {
    const mission = await readMission();

    expect(mission).toMatchObject({
      id: "mission-observability-latency-readiness",
      domain: "observability",
      requestedTimeWindow: { earliest: "-15m", latest: "now" },
      expectedTools: ["splunk_run_query"],
      authorizedIndexes: ["_internal"]
    });
    expect(mission.checks).toEqual(
      expect.arrayContaining(["SPL-001", "SPL-002", "SPL-004", "EVD-001", "EVD-003", "SAF-002", "SAF-003"])
    );
    expect(mission.requiredEvidence).toEqual(
      expect.arrayContaining([{ type: "result_count" }, { type: "evidence_refs" }, { type: "service_or_source" }])
    );
  });

  it("reuses the fixture adapter query path and evidence refs", async () => {
    const mission = await readMission();
    const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
    const adapter = createFixtureSplunkAccessAdapter(fixture);
    const result = await adapter.runQuery(
      { query: latencyQuery, timeWindow: mission.requestedTimeWindow, maxRows: 10, app: "search" },
      { requestId: "req-observability-mission-001", missionId: mission.id }
    );

    expect(result).toMatchObject({
      queryRef: "query-observability-latency",
      resultCount: 4,
      evidenceRefs: ["obs-201", "obs-202", "obs-203", "obs-204"],
      warnings: []
    });
    expect(result.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ service: "splunk-mcp-gateway", p95_latency_ms: 184 }),
        expect.objectContaining({ service: "agent-readiness-compiler", p95_latency_ms: 92 }),
        expect.objectContaining({ service: "splunk-mcp-http-transport", p95_latency_ms: 141 }),
        expect.objectContaining({ service: "readiness-receipt-writer", p95_latency_ms: 76 })
      ])
    );
  });
});
