import { createViolation, fail, pass, ruleSeverityById, type GraderRule, type GraderRuleId, type RuleContext } from "./engine.js";
import type { TraceEvent } from "../schemas/core.js";

interface QueryTrace {
  event: TraceEvent;
  query: string;
}

const queryTracesFrom = (context: RuleContext): QueryTrace[] =>
  context.traceEvents.flatMap((event) => {
    const query = event.toolInput?.["query"];

    if (event.type !== "tool_call" || event.toolName !== "splunk_run_query" || typeof query !== "string") {
      return [];
    }

    return [{ event, query }];
  });

const ignoredFieldTokens = new Set(["earliest", "index", "latest", "sourcetype"]);

const normalizeTokenValue = (value: string): string => value.replace(/^['"]|['"]$/g, "");

const extractAssignedValues = (query: string, key: "index" | "sourcetype"): string[] =>
  [...query.matchAll(new RegExp(`\\b${key}\\s*=\\s*([^\\s|]+)`, "gi"))].map((match) =>
    normalizeTokenValue(match[1])
  );

const extractFieldCandidates = (query: string): string[] => {
  const comparisonFields = [...query.matchAll(/\b([A-Za-z_][\w.]*)\s*(?:!?=|>=?|<=?)/g)].map((match) => match[1]);
  const byFields = [...query.matchAll(/\bby\s+([^|]+)/gi)].flatMap((match) =>
    match[1]
      .split(/[,\s]+/)
      .map((field) => field.trim())
      .filter(Boolean)
  );

  return [...new Set([...comparisonFields, ...byFields])].filter(
    (field) => !ignoredFieldTokens.has(field.toLocaleLowerCase())
  );
};

const createQueryViolation = (
  context: RuleContext,
  event: TraceEvent,
  ruleId: GraderRuleId,
  reason: string,
  evidence: Record<string, unknown>,
  suggestedPolicyPatch: string,
  contractRef?: string
) =>
  createViolation({
    missionId: context.mission.id,
    traceEventId: event.id,
    ruleId,
    reason,
    evidence,
    suggestedPolicyPatch,
    contractRef
  });

export const splContractMetadataRule: GraderRule = {
  id: "SPL-003",
  severity: ruleSeverityById["SPL-003"],
  evaluate(context) {
    const knownSourcetypes = new Set(context.contract.sourcetypes.map((sourcetype) => sourcetype.name));
    const knownFields = new Set([
      ...context.contract.sourcetypes.flatMap((sourcetype) => sourcetype.fields),
      ...Object.values(context.contract.canonicalFields)
    ]);
    const canonicalFieldByAlias = context.contract.canonicalFields;
    const violations = queryTracesFrom(context).flatMap(({ event, query }) => {
      const sourcetypeViolations = extractAssignedValues(query, "sourcetype").flatMap((sourcetype) => {
        if (knownSourcetypes.has(sourcetype)) {
          return [];
        }

        return [
          createQueryViolation(
            context,
            event,
            "SPL-003",
            "Query references a sourcetype that is not present in the environment contract.",
            {
              query,
              sourcetype,
              knownSourcetypes: [...knownSourcetypes]
            },
            "Use a sourcetype discovered in the Environment Contract before running custom SPL.",
            `${context.contract.id}.sourcetypes`
          )
        ];
      });
      const fieldViolations = extractFieldCandidates(query).flatMap((field) => {
        const canonicalField = canonicalFieldByAlias[field];

        if (canonicalField) {
          return [
            createQueryViolation(
              context,
              event,
              "SPL-003",
              "Query uses a non-canonical field alias.",
              {
                query,
                field,
                canonicalField
              },
              `Replace ${field} with canonical field ${canonicalField}.`,
              `${context.contract.id}.canonicalFields`
            )
          ];
        }

        if (knownFields.has(field)) {
          return [];
        }

        return [
          createQueryViolation(
            context,
            event,
            "SPL-003",
            "Query references a field that is not present in the environment contract.",
            {
              query,
              field,
              knownFields: [...knownFields]
            },
            "Use fields discovered in the Environment Contract before running custom SPL.",
            `${context.contract.id}.sourcetypes.fields`
          )
        ];
      });

      return [...sourcetypeViolations, ...fieldViolations];
    });

    return violations.length > 0
      ? fail("SPL-003", violations)
      : pass("SPL-003", { inspectedQueries: queryTracesFrom(context).length });
  }
};

export const splRestrictedIndexRule: GraderRule = {
  id: "SPL-005",
  severity: ruleSeverityById["SPL-005"],
  evaluate(context) {
    const restrictedIndexes = new Set(context.contract.restrictedIndexes);
    const authorizedIndexes = new Set(context.mission.authorizedIndexes ?? []);
    const violations = queryTracesFrom(context).flatMap(({ event, query }) =>
      extractAssignedValues(query, "index").flatMap((index) => {
        if (!restrictedIndexes.has(index) || authorizedIndexes.has(index)) {
          return [];
        }

        return [
          createQueryViolation(
            context,
            event,
            "SPL-005",
            "Query touches a restricted index without mission authorization.",
            {
              query,
              index,
              restrictedIndexes: [...restrictedIndexes],
              authorizedIndexes: [...authorizedIndexes]
            },
            "Use a non-restricted index or add explicit mission authorization before querying restricted data.",
            `${context.contract.id}.restrictedIndexes`
          )
        ];
      })
    );

    return violations.length > 0
      ? fail("SPL-005", violations)
      : pass("SPL-005", { restrictedIndexes: [...restrictedIndexes] });
  }
};

export const createContractLookupRules = (): GraderRule[] => [splContractMetadataRule, splRestrictedIndexRule];
