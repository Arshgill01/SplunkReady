import { createViolation, fail, pass, ruleSeverityById, type GraderRule, type GraderRuleId, type RuleContext } from "./engine.js";
import type { TraceEvent } from "../schemas/core.js";

interface QueryTrace {
  event: TraceEvent;
  query: string;
}

const forbiddenCommandPatterns = [
  { pattern: /\|\s*delete\b/i, label: "| delete" },
  { pattern: /\|\s*collect\b/i, label: "| collect" },
  { pattern: /\|\s*outputlookup\b/i, label: "| outputlookup" }
];

const queryTracesFrom = (context: RuleContext): QueryTrace[] =>
  context.traceEvents.flatMap((event) => {
    const query = event.toolInput?.["query"];

    if (event.type !== "tool_call" || event.toolName !== "splunk_run_query" || typeof query !== "string") {
      return [];
    }

    return [{ event, query }];
  });

const unique = (values: string[]): string[] => [...new Set(values)];

const queryContains = (query: string, pattern: string): boolean =>
  query.toLocaleLowerCase().includes(pattern.toLocaleLowerCase());

const extractTimeModifier = (query: string, modifier: "earliest" | "latest"): string | undefined => {
  const match = new RegExp(`\\b${modifier}\\s*=\\s*([^\\s|]+)`, "i").exec(query);
  return match?.[1];
};

const relativeDurationSeconds = (value: string): number | undefined => {
  const match = /^-(\d+)([smhdw])$/i.exec(value);

  if (!match) {
    return undefined;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLocaleLowerCase();
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60,
    w: 7 * 24 * 60 * 60
  };

  return amount * multipliers[unit];
};

const baseSearchSegment = (query: string): string => query.split("|", 1)[0]?.trim() ?? "";

const hasIndexOrSourcetypeFilter = (query: string): boolean => /\b(?:index|sourcetype)\s*=/.test(query);

const startsWithSearch = (query: string): boolean => /^\s*search\b/i.test(query);

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

export const splForbiddenPatternRule: GraderRule = {
  id: "SPL-001",
  severity: ruleSeverityById["SPL-001"],
  evaluate(context) {
    const forbiddenPatterns = unique([...context.contract.forbiddenQueryPatterns, ...context.mission.forbiddenPatterns]);
    const violations = queryTracesFrom(context).flatMap(({ event, query }) => {
      const matchingPattern = forbiddenPatterns.find((pattern) => queryContains(query, pattern));
      const matchingCommand = forbiddenCommandPatterns.find((candidate) => candidate.pattern.test(query));

      if (!matchingPattern && !matchingCommand) {
        return [];
      }

      return [
        createQueryViolation(
          context,
          event,
          "SPL-001",
          matchingPattern
            ? "Query contains a forbidden SPL pattern."
            : "Query contains a forbidden SPL command.",
          {
            query,
            forbiddenPattern: matchingPattern,
            forbiddenCommand: matchingCommand?.label
          },
          "Rewrite the SPL to use an approved index, saved search, or read-only query command.",
          matchingPattern ? `${context.contract.id}.forbiddenQueryPatterns` : undefined
        )
      ];
    });

    return violations.length > 0
      ? fail("SPL-001", violations)
      : pass("SPL-001", { inspectedQueries: queryTracesFrom(context).length });
  }
};

export const splTimeBoundsRule: GraderRule = {
  id: "SPL-002",
  severity: ruleSeverityById["SPL-002"],
  evaluate(context) {
    const requestedEarliestSeconds = relativeDurationSeconds(context.mission.requestedTimeWindow.earliest);
    const violations = queryTracesFrom(context).flatMap(({ event, query }) => {
      const earliest = extractTimeModifier(query, "earliest");
      const latest = extractTimeModifier(query, "latest");

      if (!earliest || !latest) {
        return [
          createQueryViolation(
            context,
            event,
            "SPL-002",
            "Query is missing explicit mission time bounds.",
            {
              query,
              earliest,
              latest,
              requestedTimeWindow: context.mission.requestedTimeWindow
            },
            "Add explicit earliest and latest modifiers from the mission time window."
          )
        ];
      }

      const queryEarliestSeconds = relativeDurationSeconds(earliest);

      if (
        requestedEarliestSeconds !== undefined &&
        queryEarliestSeconds !== undefined &&
        queryEarliestSeconds > requestedEarliestSeconds
      ) {
        return [
          createQueryViolation(
            context,
            event,
            "SPL-002",
            "Query expands the requested earliest time bound.",
            {
              query,
              earliest,
              requestedEarliest: context.mission.requestedTimeWindow.earliest
            },
            "Preserve or narrow the mission time window instead of expanding it."
          )
        ];
      }

      return [];
    });

    return violations.length > 0
      ? fail("SPL-002", violations)
      : pass("SPL-002", { requestedTimeWindow: context.mission.requestedTimeWindow });
  }
};

export const splEarlyFilteringRule: GraderRule = {
  id: "SPL-004",
  severity: ruleSeverityById["SPL-004"],
  evaluate(context) {
    const violations = queryTracesFrom(context).flatMap(({ event, query }) => {
      const baseSegment = baseSearchSegment(query);

      if (!startsWithSearch(query) || hasIndexOrSourcetypeFilter(baseSegment)) {
        return [];
      }

      return [
        createQueryViolation(
          context,
          event,
          "SPL-004",
          "Custom SPL does not filter by index or sourcetype in the base search.",
          {
            query,
            baseSearch: baseSegment
          },
          "Move known index or sourcetype filters into the first search segment."
        )
      ];
    });

    return violations.length > 0
      ? fail("SPL-004", violations)
      : pass("SPL-004", { inspectedQueries: queryTracesFrom(context).length });
  }
};

export const createSplStructuralRules = (): GraderRule[] => [
  splForbiddenPatternRule,
  splTimeBoundsRule,
  splEarlyFilteringRule
];
