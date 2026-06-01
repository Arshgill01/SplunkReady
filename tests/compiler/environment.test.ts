import { describe, expect, it } from "vitest";

import { createFixtureSplunkAccessAdapter, loadFixtureSplunkDatasetFromFile } from "../../src/adapters/fixture.js";
import type { SplunkAccessAdapter } from "../../src/adapters/splunk-access.js";
import { compileEnvironmentContract } from "../../src/compiler/environment.js";
import { environmentContractSchema } from "../../src/schemas/core.js";

const fixturePath = new URL("../../fixtures/acme-soc-dev/adapter-fixture.json", import.meta.url);
const compileOptions = {
  requestId: "req-compiler-001",
  contractVersion: "2026.06.01",
  generatedAt: "2026-06-01T06:30:00.000Z"
};

describe("environment contract compiler", () => {
  it("compiles fixture adapter inventory into a schema-valid environment contract", async () => {
    const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
    const adapter = createFixtureSplunkAccessAdapter(fixture);
    const contract = await compileEnvironmentContract(adapter, compileOptions);

    expect(environmentContractSchema.safeParse(contract).success).toBe(true);
    expect(contract).toMatchObject({
      id: "contract-acme-soc-dev",
      name: "acme-soc-dev",
      version: "2026.06.01",
      generatedAt: "2026-06-01T06:30:00.000Z",
      mode: "fixture",
      restrictedIndexes: ["finance_pii"],
      canonicalFields: {
        auth_source: "src",
        auth_destination: "dest",
        auth_user: "user"
      },
      queryBudgets: { maxToolCalls: 6, maxResultRows: 50, timeoutSeconds: 30 },
      forbiddenQueryPatterns: ["index=*"]
    });
    expect(contract.sourcetypes).toContainEqual({
      name: "XmlWinEventLog:Security",
      fields: ["src", "dest", "user", "signature", "EventCode"]
    });
    expect(contract.savedSearches).toEqual(
      expect.arrayContaining([{ name: "ES - Lateral Movement Auth Chain", app: "SplunkEnterpriseSecuritySuite" }])
    );
    expect(contract.dashboardPanels.map((panel) => panel["id"])).toEqual(
      expect.arrayContaining(["dashboard-executive-lateral-movement", "panel-executive-lateral-movement-silence"])
    );
    expect(contract.dataModels.map((dataModel) => dataModel["id"])).toContain("data-model-authentication");
    expect(contract.appContexts).toEqual(["SplunkEnterpriseSecuritySuite", "search"]);
    expect(contract.sourceRefs).toEqual(
      expect.arrayContaining(["splunk_get_metadata", "splunk_get_knowledge_objects"])
    );
  });

  it("degrades gracefully when optional helper tools are unavailable", async () => {
    const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
    const fixtureAdapter = createFixtureSplunkAccessAdapter(fixture);
    const adapter: SplunkAccessAdapter = {
      ...fixtureAdapter,
      async getInfo(options) {
        const info = await fixtureAdapter.getInfo(options);
        return {
          ...info,
          readOnlyTools: info.readOnlyTools.filter((toolName) => !toolName.startsWith("saia_"))
        };
      }
    };
    const contract = await compileEnvironmentContract(adapter, compileOptions);

    expect(environmentContractSchema.safeParse(contract).success).toBe(true);
    expect(contract.warnings).toEqual(
      expect.arrayContaining([
        "Optional helper tool saia_explain_spl is unavailable; compiler continuing without it.",
        "Optional helper tool saia_optimize_spl is unavailable; compiler continuing without it."
      ])
    );
  });

  it("does not invent canonical fields that are absent from adapter metadata", async () => {
    const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
    const fixtureAdapter = createFixtureSplunkAccessAdapter(fixture);
    const adapter: SplunkAccessAdapter = {
      ...fixtureAdapter,
      async getMetadata(input, options) {
        const metadata = await fixtureAdapter.getMetadata(input, options);
        return {
          ...metadata,
          sourcetypes: [{ name: "custom:source", indexes: ["wineventlog"], fields: ["hostname"] }]
        };
      }
    };
    const contract = await compileEnvironmentContract(adapter, compileOptions);

    expect(contract.canonicalFields).toEqual({});
    expect(contract.warnings).toContain("Canonical field map inferred only from discovered fields: none.");
  });
});
