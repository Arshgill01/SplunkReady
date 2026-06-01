import { describe, expect, it } from "vitest";

import {
  createSplunkAdapterError,
  type AdapterRequestContext,
  type SplunkAccessAdapter
} from "../../src/adapters/splunk-access.js";

const requestOptions = { requestId: "req-001", missionId: "mission-lateral-movement" };

const fixtureAdapter: SplunkAccessAdapter = {
  mode: "fixture",
  async getInfo() {
    return {
      mode: "fixture",
      deploymentName: "acme-soc-dev",
      readOnlyTools: ["splunk_get_knowledge_objects", "splunk_run_saved_search", "splunk_run_query"]
    };
  },
  async getUserInfo() {
    return {
      username: "fixture-user",
      roles: ["admin"],
      defaultApp: "SplunkEnterpriseSecuritySuite",
      capabilities: ["search"]
    };
  },
  async getIndexes() {
    return [{ name: "wineventlog", sensitive: false }];
  },
  async getMetadata() {
    return {
      indexes: [{ name: "wineventlog", sensitive: false }],
      sourcetypes: [{ name: "XmlWinEventLog:Security", indexes: ["wineventlog"], fields: ["src", "dest", "user"] }],
      source: "fixture",
      warnings: []
    };
  },
  async getKnowledgeObjects() {
    return {
      objects: [
        {
          id: "saved-search-lateral-movement",
          type: "saved_searches",
          name: "ES - Lateral Movement Auth Chain",
          app: "SplunkEnterpriseSecuritySuite"
        }
      ],
      resultCount: 1,
      warnings: []
    };
  },
  async runQuery() {
    return {
      queryRef: "query-001",
      rows: [],
      resultCount: 0,
      evidenceRefs: [],
      warnings: []
    };
  },
  async runSavedSearch() {
    return {
      savedSearchRef: "saved-search-lateral-movement",
      rows: [{ src: "win-finance-07", dest: "admin-login-02", user: "svc-finance" }],
      resultCount: 1,
      evidenceRefs: ["evt-102"],
      warnings: []
    };
  },
  async explainSpl() {
    return { explanation: "Read-only SPL explanation.", warnings: [] };
  }
};

describe("SplunkAccessAdapter contract", () => {
  it("normalizes fixture adapter outputs behind the shared interface", async () => {
    await expect(fixtureAdapter.getUserInfo(requestOptions)).resolves.toMatchObject({
      username: "fixture-user",
      capabilities: ["search"]
    });
    await expect(
      fixtureAdapter.getKnowledgeObjects({ types: ["saved_searches"], query: "lateral movement" }, requestOptions)
    ).resolves.toMatchObject({ resultCount: 1 });
    await expect(
      fixtureAdapter.runSavedSearch(
        {
          name: "ES - Lateral Movement Auth Chain",
          app: "SplunkEnterpriseSecuritySuite"
        },
        requestOptions
      )
    ).resolves.toMatchObject({ resultCount: 1, evidenceRefs: ["evt-102"] });
  });

  it("preserves tool name and request context in adapter errors", () => {
    const context: AdapterRequestContext = {
      ...requestOptions,
      mode: "fixture",
      toolName: "splunk_run_query"
    };

    const error = createSplunkAdapterError({
      code: "QUERY_TIMEOUT",
      message: "Fixture query timed out",
      retryable: true,
      context
    });

    expect(error).toMatchObject({
      name: "SplunkAdapterError",
      code: "QUERY_TIMEOUT",
      retryable: true,
      context: {
        requestId: "req-001",
        missionId: "mission-lateral-movement",
        mode: "fixture",
        toolName: "splunk_run_query"
      }
    });
  });
});
