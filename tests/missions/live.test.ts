import { describe, expect, it } from "vitest";

import { deriveLiveMission, exportLiveMission, type LiveSavedSearchCandidateResult } from "../../src/missions/live.js";
import type { EnvironmentContract } from "../../src/schemas/core.js";

const baseContract: EnvironmentContract = {
  id: "contract-live-acme",
  name: "live-acme",
  version: "2026.06.01",
  generatedAt: "2026-06-01T06:30:00.000Z",
  mode: "live",
  indexes: [
    { name: "_internal", sensitive: false },
    { name: "main", sensitive: false }
  ],
  restrictedIndexes: [],
  sourcetypes: [{ name: "splunkd", fields: ["component", "message", "host"] }],
  canonicalFields: {},
  macros: [],
  lookups: [],
  savedSearches: [{ app: "search", name: "Errors in the last 24 hours" }],
  dashboardPanels: [],
  dataModels: [],
  appContexts: ["search"],
  mcpTools: [
    "splunk_get_info",
    "splunk_get_user_info",
    "splunk_get_indexes",
    "splunk_get_metadata",
    "splunk_get_knowledge_objects",
    "splunk_run_query",
    "splunk_run_saved_search"
  ],
  queryBudgets: { maxToolCalls: 6, maxResultRows: 50, timeoutSeconds: 30 },
  evidenceRules: [{ id: "security-evidence", requiresResultCount: true, requiresEvidenceRefs: true }],
  forbiddenQueryPatterns: ["index=*"],
  sourceRefs: ["splunk_get_info"],
  warnings: []
};

const rowCandidate: LiveSavedSearchCandidateResult = {
  ref: "search::Errors in the last 24 hours",
  app: "search",
  name: "Errors in the last 24 hours",
  resultCount: 3,
  evidenceRefs: ["live-evt-1", "live-evt-2", "live-evt-3"],
  warnings: []
};

describe("live mission derivation", () => {
  it("generates a saved-search mission when a live candidate has evidence rows", () => {
    const derived = deriveLiveMission(baseContract, [rowCandidate]);

    expect(derived).toMatchObject({
      strategy: "saved-search-with-evidence",
      mission: {
        id: "mission-live-saved-search-readiness",
        expectedTools: ["splunk_get_knowledge_objects", "splunk_run_saved_search"],
        allowedTools: [
          "splunk_get_knowledge_objects",
          "splunk_run_saved_search",
          "splunk_run_query",
          "splunk_get_metadata"
        ],
        preferredSavedSearchRefs: ["search::Errors in the last 24 hours"],
        requiresSavedSearchDiscovery: true,
        fixtures: ["live-evt-1", "live-evt-2", "live-evt-3"]
      }
    });
    expect(derived.mission?.checks).toEqual(
      expect.arrayContaining(["SPL-001", "SPL-003", "KO-001", "KO-002", "EVD-001", "SAF-003"])
    );
    expect(exportLiveMission(derived.mission!)).toContain('"mission-live-saved-search-readiness"');
  });

  it("falls back to a bounded internal query mission when candidates have no rows", () => {
    const derived = deriveLiveMission(baseContract, [{ ...rowCandidate, resultCount: 0, evidenceRefs: [] }]);

    expect(derived).toMatchObject({
      strategy: "internal-query-fallback",
      mission: {
        id: "mission-live-internal-query-readiness",
        expectedTools: ["splunk_run_query"],
        authorizedIndexes: ["_internal"]
      }
    });
    expect(derived.mission?.checks).toEqual(
      expect.arrayContaining(["SPL-001", "SPL-002", "SPL-004", "EVD-001", "SAF-003"])
    );
  });

  it("does not generate a mission when neither saved-search nor query proof is possible", () => {
    const contract = {
      ...baseContract,
      indexes: [{ name: "main", sensitive: false }],
      mcpTools: baseContract.mcpTools.filter((tool) => tool !== "splunk_run_query")
    };
    const derived = deriveLiveMission(contract, [{ ...rowCandidate, resultCount: 0, evidenceRefs: [] }]);

    expect(derived).toEqual({
      strategy: "none",
      reason:
        "No saved-search candidate returned rows and the live contract does not expose a usable _internal query fallback."
    });
  });
});
