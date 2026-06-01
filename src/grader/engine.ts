import { z } from "zod";

import {
  graderRuleIdSchema,
  severitySchema,
  violationSchema,
  type EnvironmentContract,
  type Mission,
  type TraceEvent,
  type Violation
} from "../schemas/core.js";

export type GraderRuleId = z.infer<typeof graderRuleIdSchema>;
export type RuleSeverity = z.infer<typeof severitySchema>;

export interface RuleContext {
  contract: EnvironmentContract;
  mission: Mission;
  traceEvents: TraceEvent[];
}

export interface RulePassResult {
  status: "pass";
  ruleId: GraderRuleId;
  severity: RuleSeverity;
  evidence: Record<string, unknown>;
}

export interface RuleFailResult {
  status: "fail";
  ruleId: GraderRuleId;
  severity: RuleSeverity;
  violations: Violation[];
}

export type RuleEvaluation = RulePassResult | RuleFailResult;

export interface GraderRule {
  id: GraderRuleId;
  severity: RuleSeverity;
  evaluate(context: RuleContext): RuleEvaluation;
}

export interface RuleEngineResult {
  results: RuleEvaluation[];
  violations: Violation[];
}

const rulePassResultSchema = z
  .object({
    status: z.literal("pass"),
    ruleId: graderRuleIdSchema,
    severity: severitySchema,
    evidence: z.record(z.unknown())
  })
  .strict();

const ruleFailResultSchema = z
  .object({
    status: z.literal("fail"),
    ruleId: graderRuleIdSchema,
    severity: severitySchema,
    violations: z.array(violationSchema)
  })
  .strict();

const ruleEvaluationSchema = z.discriminatedUnion("status", [rulePassResultSchema, ruleFailResultSchema]);

export const ruleSeverityById: Record<GraderRuleId, RuleSeverity> = {
  "SPL-001": "Critical",
  "SPL-002": "High",
  "SPL-003": "Critical",
  "SPL-004": "Medium",
  "SPL-005": "High",
  "KO-001": "High",
  "KO-002": "High",
  "KO-003": "High",
  "KO-004": "Medium",
  "EVD-001": "Critical",
  "EVD-002": "High",
  "EVD-003": "High",
  "EVD-004": "Medium",
  "ANS-001": "Critical",
  "ANS-002": "Medium",
  "ANS-003": "High",
  "SAF-001": "Critical",
  "SAF-002": "High",
  "SAF-003": "Critical"
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const createViolation = (input: {
  missionId: string;
  traceEventId: string;
  ruleId: GraderRuleId;
  reason: string;
  evidence: Record<string, unknown>;
  suggestedPolicyPatch: string;
  contractRef?: string;
  evidenceRefs?: string[];
}): Violation =>
  violationSchema.parse({
    id: `violation-${slugify(input.missionId)}-${slugify(input.ruleId)}-${slugify(input.traceEventId)}`,
    missionId: input.missionId,
    traceEventId: input.traceEventId,
    ruleId: input.ruleId,
    severity: ruleSeverityById[input.ruleId],
    reason: input.reason,
    evidence: input.evidence,
    suggestedPolicyPatch: input.suggestedPolicyPatch,
    contractRef: input.contractRef,
    evidenceRefs: input.evidenceRefs
  });

export const pass = (
  ruleId: GraderRuleId,
  evidence: Record<string, unknown> = {}
): RulePassResult => ({
  status: "pass",
  ruleId,
  severity: ruleSeverityById[ruleId],
  evidence
});

export const fail = (ruleId: GraderRuleId, violations: Violation[]): RuleFailResult => ({
  status: "fail",
  ruleId,
  severity: ruleSeverityById[ruleId],
  violations: violations.map((violation) => violationSchema.parse(violation))
});

const assertRuleBoundary = (rule: GraderRule, result: RuleEvaluation): RuleEvaluation => {
  const canonicalSeverity = ruleSeverityById[rule.id];
  const parsedResult = ruleEvaluationSchema.safeParse(result);

  if (!parsedResult.success) {
    throw new Error(`Rule ${rule.id} returned malformed evaluation.`);
  }

  if (rule.severity !== canonicalSeverity) {
    throw new Error(
      `Rule ${rule.id} declared severity ${rule.severity}, expected canonical severity ${canonicalSeverity}.`
    );
  }

  if (parsedResult.data.ruleId !== rule.id) {
    throw new Error(`Rule ${rule.id} returned result for ${parsedResult.data.ruleId}.`);
  }

  if (parsedResult.data.severity !== canonicalSeverity) {
    throw new Error(
      `Rule ${rule.id} returned severity ${parsedResult.data.severity}, expected canonical severity ${canonicalSeverity}.`
    );
  }

  if (parsedResult.data.status === "fail") {
    parsedResult.data.violations.forEach((violation) => {
      const parsedViolation = violationSchema.parse(violation);

      if (parsedViolation.ruleId !== rule.id) {
        throw new Error(`Rule ${rule.id} emitted violation for ${parsedViolation.ruleId}.`);
      }

      if (parsedViolation.severity !== canonicalSeverity) {
        throw new Error(
          `Rule ${rule.id} emitted violation severity ${parsedViolation.severity}, expected ${canonicalSeverity}.`
        );
      }
    });
  }

  return parsedResult.data;
};

export const runRuleEngine = (context: RuleContext, rules: GraderRule[]): RuleEngineResult => {
  const results = rules.map((rule) => {
    graderRuleIdSchema.parse(rule.id);
    severitySchema.parse(rule.severity);
    return assertRuleBoundary(rule, rule.evaluate(context));
  });

  return {
    results,
    violations: results.flatMap((result) => (result.status === "fail" ? result.violations : []))
  };
};
