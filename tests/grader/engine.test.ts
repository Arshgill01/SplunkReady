import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { createFixtureSplunkAccessAdapter, loadFixtureSplunkDatasetFromFile } from "../../src/adapters/fixture.js";
import { NaiveSpecimenAgent } from "../../src/agents/specimen.js";
import { compileEnvironmentContract } from "../../src/compiler/environment.js";
import {
  createViolation,
  fail,
  type GraderRule,
  type GraderRuleId,
  pass,
  runRuleEngine,
  ruleSeverityById,
  validateRuleRegistry
} from "../../src/grader/engine.js";
import { parseMissionDefinition } from "../../src/missions/dsl.js";
import { violationSchema, type TraceEvent } from "../../src/schemas/core.js";

const fixturePath = new URL("../../fixtures/acme-soc-dev/adapter-fixture.json", import.meta.url);
const missionPath = new URL(
  "../../fixtures/acme-soc-dev/missions/security-investigation-readiness.json",
  import.meta.url
);
const compileOptions = {
  requestId: "req-rule-engine-001",
  contractVersion: "2026.06.01",
  generatedAt: "2026-06-01T06:30:00.000Z"
};

const loadContext = async () => {
  const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
  const adapter = createFixtureSplunkAccessAdapter(fixture);
  const contract = await compileEnvironmentContract(adapter, compileOptions);
  const mission = parseMissionDefinition(JSON.parse(await readFile(missionPath, "utf8")) as unknown);
  const agent = new NaiveSpecimenAgent();
  const run = await agent.run({ mission, adapter });

  return { contract, mission, traceEvents: run.traceEvents };
};

const queryFrom = (event: TraceEvent): string | undefined => {
  const input = event.toolInput;
  return input && typeof input["query"] === "string" ? input["query"] : undefined;
};

const withChecks = <T extends Awaited<ReturnType<typeof loadContext>>>(
  context: T,
  checks: GraderRuleId[]
): T => ({
  ...context,
  mission: { ...context.mission, checks }
});

describe("rule engine foundation", () => {
  it("runs pass and fail rules in order and emits structured violations", async () => {
    const context = await loadContext();
    const passRule: GraderRule = {
      id: "EVD-001",
      severity: ruleSeverityById["EVD-001"],
      evaluate(ruleContext) {
        return pass("EVD-001", { traceEventCount: ruleContext.traceEvents.length });
      }
    };
    const forbiddenQueryRule: GraderRule = {
      id: "SPL-001",
      severity: ruleSeverityById["SPL-001"],
      evaluate(ruleContext) {
        const violatingEvent = ruleContext.traceEvents.find((event) =>
          ruleContext.contract.forbiddenQueryPatterns.some((pattern) => queryFrom(event)?.includes(pattern))
        );

        if (!violatingEvent) {
          return pass("SPL-001", { forbiddenQueryPatterns: ruleContext.contract.forbiddenQueryPatterns });
        }

        return fail("SPL-001", [
          createViolation({
            missionId: ruleContext.mission.id,
            traceEventId: violatingEvent.id,
            ruleId: "SPL-001",
            reason: "Query contains a forbidden broad query pattern.",
            evidence: {
              query: queryFrom(violatingEvent),
              forbiddenQueryPatterns: ruleContext.contract.forbiddenQueryPatterns
            },
            suggestedPolicyPatch: "Block index=* unless a mission-specific approval token is present.",
            contractRef: `${ruleContext.contract.id}.forbiddenQueryPatterns`
          })
        ]);
      }
    };
    const result = runRuleEngine(withChecks(context, ["EVD-001", "SPL-001"]), [passRule, forbiddenQueryRule]);

    expect(result.results.map((ruleResult) => [ruleResult.ruleId, ruleResult.status])).toEqual([
      ["EVD-001", "pass"],
      ["SPL-001", "fail"]
    ]);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      id: "violation-mission-security-lateral-movement-readiness-spl-001-mission-security-lateral-movement-readiness-trace-001",
      missionId: "mission-security-lateral-movement-readiness",
      ruleId: "SPL-001",
      severity: "Critical",
      reason: "Query contains a forbidden broad query pattern.",
      contractRef: "contract-acme-soc-dev.forbiddenQueryPatterns"
    });
    expect(violationSchema.safeParse(result.violations[0]).success).toBe(true);
  });

  it("preserves violation order across multiple deterministic checks", async () => {
    const context = await loadContext();
    const firstEvent = context.traceEvents[0];
    const rules: GraderRule[] = [
      {
        id: "SPL-001",
        severity: "Critical",
        evaluate(ruleContext) {
          return fail("SPL-001", [
            createViolation({
              missionId: ruleContext.mission.id,
              traceEventId: firstEvent.id,
              ruleId: "SPL-001",
              reason: "Forbidden query pattern used.",
              evidence: { query: queryFrom(firstEvent) },
              suggestedPolicyPatch: "Remove forbidden query patterns from custom SPL."
            })
          ]);
        }
      },
      {
        id: "KO-001",
        severity: "High",
        evaluate(ruleContext) {
          return fail("KO-001", [
            createViolation({
              missionId: ruleContext.mission.id,
              traceEventId: firstEvent.id,
              ruleId: "KO-001",
              reason: "Custom SPL was used before saved-search discovery.",
              evidence: { firstToolName: firstEvent.toolName },
              suggestedPolicyPatch: "Inspect saved searches before writing custom SPL."
            })
          ]);
        }
      }
    ];
    const result = runRuleEngine(withChecks(context, ["SPL-001", "KO-001"]), rules);

    expect(result.violations.map((violation) => violation.ruleId)).toEqual(["SPL-001", "KO-001"]);
    expect(result.violations.map((violation) => violation.severity)).toEqual(["Critical", "High"]);
  });

  it("only evaluates rules activated by the mission checks list", async () => {
    const context = await loadContext();
    const scopedContext = {
      ...context,
      mission: { ...context.mission, checks: ["SPL-001" as const] }
    };
    const rules: GraderRule[] = [
      {
        id: "SPL-001",
        severity: "Critical",
        evaluate() {
          return pass("SPL-001", { activated: true });
        }
      },
      {
        id: "KO-001",
        severity: "High",
        evaluate() {
          throw new Error("Disabled mission rule should not run.");
        }
      }
    ];
    const result = runRuleEngine(scopedContext, rules);

    expect(result.results.map((ruleResult) => ruleResult.ruleId)).toEqual(["SPL-001"]);
    expect(result.violations).toEqual([]);
  });

  it("fails closed when a mission selects an unimplemented rule", async () => {
    const context = await loadContext();
    const scopedContext = {
      ...context,
      mission: { ...context.mission, checks: ["SPL-001", "SAF-003"] as GraderRuleId[] }
    };
    const rules: GraderRule[] = [
      {
        id: "SPL-001",
        severity: "Critical",
        evaluate() {
          return pass("SPL-001", { activated: true });
        }
      }
    ];

    expect(() => runRuleEngine(scopedContext, rules)).toThrow(
      "Mission mission-security-lateral-movement-readiness selected unimplemented grader rule(s): SAF-003."
    );
  });

  it("rejects duplicate registered rule ids before scoring", async () => {
    const context = await loadContext();
    const duplicateRule: GraderRule = {
      id: "SPL-001",
      severity: "Critical",
      evaluate() {
        return pass("SPL-001");
      }
    };

    expect(() => validateRuleRegistry(context.mission, [duplicateRule, duplicateRule])).toThrow(
      "Duplicate grader rule implementation registered for SPL-001."
    );
  });

  it("rejects registered rule ids outside the schema before scoring", async () => {
    const context = await loadContext();
    const invalidRule: GraderRule = {
      id: "FAKE-999" as GraderRuleId,
      severity: "Critical",
      evaluate() {
        return pass("SPL-001");
      }
    };

    expect(() => validateRuleRegistry(context.mission, [invalidRule])).toThrow();
  });

  it("rejects rules declared with non-canonical severity", async () => {
    const context = await loadContext();
    const rule: GraderRule = {
      id: "SPL-001",
      severity: "High",
      evaluate() {
        return pass("SPL-001");
      }
    };

    expect(() => runRuleEngine(withChecks(context, ["SPL-001"]), [rule])).toThrow(
      "Rule SPL-001 declared severity High, expected canonical severity Critical."
    );
  });

  it("rejects results emitted for a different rule id or severity", async () => {
    const context = await loadContext();
    const wrongRuleId: GraderRule = {
      id: "SPL-001",
      severity: "Critical",
      evaluate() {
        return pass("KO-001");
      }
    };
    const wrongSeverity: GraderRule = {
      id: "SPL-001",
      severity: "Critical",
      evaluate() {
        return { ...pass("SPL-001"), severity: "High" };
      }
    };

    expect(() => runRuleEngine(withChecks(context, ["SPL-001"]), [wrongRuleId])).toThrow("Rule SPL-001 returned result for KO-001.");
    expect(() => runRuleEngine(withChecks(context, ["SPL-001"]), [wrongSeverity])).toThrow(
      "Rule SPL-001 returned severity High, expected canonical severity Critical."
    );
  });

  it("rejects malformed result statuses instead of accepting prose grades", async () => {
    const context = await loadContext();
    const rule: GraderRule = {
      id: "SPL-001",
      severity: "Critical",
      evaluate() {
        return {
          status: "looks safe",
          ruleId: "SPL-001",
          severity: "Critical",
          evidence: {}
        } as never;
      }
    };

    expect(() => runRuleEngine(withChecks(context, ["SPL-001"]), [rule])).toThrow("Rule SPL-001 returned malformed evaluation.");
  });

  it("rejects violations emitted for a different rule id or severity", async () => {
    const context = await loadContext();
    const firstEvent = context.traceEvents[0];
    const wrongViolationRuleId: GraderRule = {
      id: "SPL-001",
      severity: "Critical",
      evaluate(ruleContext) {
        return fail("SPL-001", [
          createViolation({
            missionId: ruleContext.mission.id,
            traceEventId: firstEvent.id,
            ruleId: "KO-001",
            reason: "Saved-search discovery was skipped.",
            evidence: { firstToolName: firstEvent.toolName },
            suggestedPolicyPatch: "Inspect saved searches before writing custom SPL."
          })
        ]);
      }
    };
    const wrongViolationSeverity: GraderRule = {
      id: "SPL-001",
      severity: "Critical",
      evaluate(ruleContext) {
        const violation = createViolation({
          missionId: ruleContext.mission.id,
          traceEventId: firstEvent.id,
          ruleId: "SPL-001",
          reason: "Forbidden query pattern used.",
          evidence: { query: queryFrom(firstEvent) },
          suggestedPolicyPatch: "Remove forbidden query patterns from custom SPL."
        });

        return fail("SPL-001", [{ ...violation, severity: "High" }]);
      }
    };

    expect(() => runRuleEngine(withChecks(context, ["SPL-001"]), [wrongViolationRuleId])).toThrow(
      "Rule SPL-001 emitted violation for KO-001."
    );
    expect(() => runRuleEngine(withChecks(context, ["SPL-001"]), [wrongViolationSeverity])).toThrow(
      "Rule SPL-001 emitted violation severity High, expected Critical."
    );
  });
});
