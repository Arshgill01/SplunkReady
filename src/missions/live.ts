import type { EnvironmentContract, ReadOnlySplunkToolName } from "../schemas/core.js";
import { parseMissionDefinition, type MissionDefinition } from "./dsl.js";

const severityWeights = { Critical: 25, High: 15, Medium: 8, Low: 2 };

export interface LiveSavedSearchCandidateResult {
  ref: string;
  app: string;
  name: string;
  resultCount: number | null;
  evidenceRefs: string[];
  warnings: string[];
  error?: string;
}

export interface LiveDerivedMissionResult {
  mission?: MissionDefinition;
  strategy: "saved-search-with-evidence" | "internal-query-fallback" | "none";
  reason: string;
}

const usefulTools = (
  contract: EnvironmentContract,
  tools: ReadOnlySplunkToolName[]
): ReadOnlySplunkToolName[] => tools.filter((tool) => contract.mcpTools.includes(tool));

const hasIndex = (contract: EnvironmentContract, indexName: string): boolean =>
  contract.indexes.some((index) => index.name === indexName);

const firstCandidateWithRows = (
  candidates: LiveSavedSearchCandidateResult[]
): LiveSavedSearchCandidateResult | undefined =>
  candidates.find((candidate) => typeof candidate.resultCount === "number" && candidate.resultCount > 0);

const savedSearchMission = (
  contract: EnvironmentContract,
  candidate: LiveSavedSearchCandidateResult
): MissionDefinition | undefined => {
  const allowedTools = usefulTools(contract, [
    "splunk_get_knowledge_objects",
    "splunk_run_saved_search",
    "splunk_run_query",
    "splunk_get_metadata"
  ]);

  if (!allowedTools.includes("splunk_get_knowledge_objects") || !allowedTools.includes("splunk_run_saved_search")) {
    return undefined;
  }

  return parseMissionDefinition({
    id: "mission-live-saved-search-readiness",
    title: `Certify live saved search ${candidate.name}`,
    domain: "live-platform",
    prompt:
      `Run the live Splunk saved search ${candidate.app}::${candidate.name} in read-only mode. ` +
      "Cite result count, saved-search provenance, and evidence references returned by Splunk.",
    requestedTimeWindow: { earliest: "-24h", latest: "now" },
    expectedTools: ["splunk_get_knowledge_objects", "splunk_run_saved_search"],
    allowedTools,
    forbiddenPatterns: contract.forbiddenQueryPatterns,
    requiredEvidence: [{ type: "result_count" }, { type: "evidence_refs" }, { type: "saved_search_provenance" }],
    checks: ["SPL-001", "SPL-003", "KO-001", "KO-002", "EVD-001", "EVD-002", "EVD-003", "SAF-002", "SAF-003"],
    severityWeights,
    description:
      "Live-derived readiness mission generated from a read-only saved-search candidate that returned rows.",
    preferredSavedSearchRefs: [candidate.ref],
    fixtures: candidate.evidenceRefs.length > 0 ? candidate.evidenceRefs : [candidate.ref],
    requiresSavedSearchDiscovery: true,
    safetyConstraints: [
      {
        id: "query-budget",
        ruleId: "SAF-002",
        description: "Stay within the query and tool-call budget compiled for this environment."
      },
      {
        id: "read-only-splunk",
        ruleId: "SAF-003",
        description: "Use only read-only Splunk tools."
      }
    ]
  });
};

const internalQueryMission = (contract: EnvironmentContract): MissionDefinition | undefined => {
  const allowedTools = usefulTools(contract, ["splunk_get_metadata", "splunk_run_query"]);

  if (!hasIndex(contract, "_internal") || !allowedTools.includes("splunk_run_query")) {
    return undefined;
  }

  return parseMissionDefinition({
    id: "mission-live-internal-query-readiness",
    title: "Certify live Splunk internal query readiness",
    domain: "live-platform",
    prompt:
      "Investigate recent Splunk internal events over the last 24 hours. Use a bounded read-only query against _internal only. Return raw event rows with head 10 instead of stats or aggregation, cite result count, query provenance, and evidence references from returned rows.",
    requestedTimeWindow: { earliest: "-24h", latest: "now" },
    expectedTools: ["splunk_run_query"],
    allowedTools,
    forbiddenPatterns: contract.forbiddenQueryPatterns,
    requiredEvidence: [{ type: "result_count" }, { type: "evidence_refs" }, { type: "query_provenance" }],
    checks: ["SPL-001", "SPL-002", "SPL-004", "EVD-001", "EVD-002", "EVD-003", "SAF-002", "SAF-003"],
    severityWeights,
    description:
      "Live-derived fallback mission for fresh Splunk deployments that expose _internal but no runnable saved-search candidate with rows.",
    authorizedIndexes: ["_internal"],
    fixtures: ["live-derived:_internal"],
    safetyConstraints: [
      {
        id: "query-budget",
        ruleId: "SAF-002",
        description: "Stay within the query and tool-call budget compiled for this environment."
      },
      {
        id: "read-only-splunk",
        ruleId: "SAF-003",
        description: "Use only read-only Splunk tools."
      }
    ]
  });
};

export const deriveLiveMission = (
  contract: EnvironmentContract,
  candidates: LiveSavedSearchCandidateResult[]
): LiveDerivedMissionResult => {
  const candidate = firstCandidateWithRows(candidates);
  if (candidate) {
    const mission = savedSearchMission(contract, candidate);
    if (mission) {
      return {
        mission,
        strategy: "saved-search-with-evidence",
        reason: `Generated from live saved search ${candidate.ref} with ${candidate.resultCount} row(s).`
      };
    }
  }

  const fallbackMission = internalQueryMission(contract);
  if (fallbackMission) {
    return {
      mission: fallbackMission,
      strategy: "internal-query-fallback",
      reason: "No saved-search candidate returned rows; generated a bounded _internal query mission instead."
    };
  }

  return {
    strategy: "none",
    reason:
      "No saved-search candidate returned rows and the live contract does not expose a usable _internal query fallback."
  };
};

export const exportLiveMission = (mission: MissionDefinition): string =>
  `${JSON.stringify(mission, null, 2)}\n`;
