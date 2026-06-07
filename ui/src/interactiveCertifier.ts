import { createAnswerRules } from "../../src/grader/answer.js";
import { createAppContextRules } from "../../src/grader/app-context.js";
import { createBudgetRules } from "../../src/grader/budget.js";
import { createContractLookupRules } from "../../src/grader/contract.js";
import { createEvidenceRules } from "../../src/grader/evidence.js";
import { runRuleEngine, type GraderRule } from "../../src/grader/engine.js";
import { createInjectionRules } from "../../src/grader/injection.js";
import { createSafetyRules } from "../../src/grader/safety.js";
import { createSavedSearchRules } from "../../src/grader/saved-search.js";
import { scoreMissionSuite } from "../../src/grader/scoring.js";
import { createSplStructuralRules } from "../../src/grader/spl.js";
import {
  readinessReceiptSchema,
  traceEventSchema,
  type EnvironmentContract,
  type Mission,
  type ReadinessReceipt,
  type TraceEvent,
  type Violation
} from "../../src/schemas/core.js";

export interface InteractiveCertificationInput {
  contract: EnvironmentContract;
  mission: Mission;
  traceJson: string;
  agentName?: string;
  agentVersion?: string;
}

export interface InteractiveCertificationResult {
  status: "PASS" | "FAIL";
  mutation: false;
  receipt: ReadinessReceipt;
  traceEvents: TraceEvent[];
  violations: Violation[];
  patchHints: string[];
}

const allRules = (): GraderRule[] => [
  ...createSplStructuralRules(),
  ...createContractLookupRules(),
  ...createSavedSearchRules(),
  ...createEvidenceRules(),
  ...createAnswerRules(),
  ...createBudgetRules(),
  ...createSafetyRules(),
  ...createAppContextRules(),
  ...createInjectionRules()
];

const unique = (values: string[]): string[] => [...new Set(values.filter((value) => value.length > 0))];

const canonicalJson = (input: unknown): string => {
  if (Array.isArray(input)) {
    return `[${input.map(canonicalJson).join(",")}]`;
  }

  if (input && typeof input === "object") {
    return `{${Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${JSON.stringify(key)}:${canonicalJson(value)}`)
      .join(",")}}`;
  }

  return JSON.stringify(input);
};

const sha256Hex = async (input: string): Promise<string | undefined> => {
  const cryptoApi = globalThis.crypto;

  if (!cryptoApi?.subtle) {
    return undefined;
  }

  const bytes = new TextEncoder().encode(input);
  const digest = await cryptoApi.subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const traceRefsFrom = (traceEvents: TraceEvent[], violations: Violation[]): string[] =>
  unique([...traceEvents.map((event) => event.id), ...violations.map((violation) => violation.traceEventId)]);

const evidenceRefsFrom = (traceEvents: TraceEvent[], violations: Violation[]): string[] =>
  unique([
    ...traceEvents.flatMap((event) => event.evidenceRefs),
    ...violations.flatMap((violation) => violation.evidenceRefs ?? [])
  ]);

const assertTraceMatchesMission = (mission: Mission, traceEvents: TraceEvent[]): void => {
  const mismatches = [...new Set(traceEvents.map((event) => event.missionId).filter((id) => id !== mission.id))];

  if (mismatches.length > 0) {
    throw new Error(`Trace missionId mismatch. Expected ${mission.id}; found ${mismatches.join(", ")}.`);
  }
};

export const certifyInteractiveTrace = async (
  input: InteractiveCertificationInput
): Promise<InteractiveCertificationResult> => {
  const traceEvents = traceEventSchema.array().min(1).parse(JSON.parse(input.traceJson) as unknown);

  assertTraceMatchesMission(input.mission, traceEvents);

  const violations = runRuleEngine({ contract: input.contract, mission: input.mission, traceEvents }, allRules()).violations;
  const suiteScore = scoreMissionSuite([input.mission], violations);
  const patchHints = unique(violations.map((violation) => violation.suggestedPolicyPatch));
  const baseReceipt = readinessReceiptSchema.parse({
    id: "receipt-interactive-001",
    agent: {
      name: input.agentName?.trim() || "Interactive Uploaded Trace Agent",
      version: input.agentVersion?.trim() || "hosted-demo"
    },
    environment: { id: input.contract.id, name: input.contract.name },
    mode: input.contract.mode,
    contractVersion: input.contract.version,
    missionSuiteVersion: "interactive-hosted-certification-1",
    verdict: suiteScore.verdict,
    score: suiteScore.score,
    passedMissions: suiteScore.passedMissions,
    failedMissions: suiteScore.failedMissions,
    criticalViolations: suiteScore.criticalViolationIds,
    violations: violations.map((violation) => violation.id),
    traceRefs: traceRefsFrom(traceEvents, violations),
    evidenceRefs: evidenceRefsFrom(traceEvents, violations),
    policyPatchSummary:
      violations.length > 0 ? [{ id: "patch-interactive-certification", status: "draft" }] : [],
    rerunComparison: {
      source: "hosted-interactive-certification",
      mutation: false,
      traceEvents: traceEvents.length,
      violations: violations.length
    },
    generatedBy: "Agent Readiness Compiler",
    notes:
      "Hosted interactive certification grades a user-supplied trace in the browser. Deterministic rules decide pass/fail."
  });
  const receiptHash = await sha256Hex(canonicalJson(baseReceipt));
  const receipt = readinessReceiptSchema.parse(receiptHash ? { ...baseReceipt, receiptHash } : baseReceipt);

  return {
    status: receipt.verdict === "READY" ? "PASS" : "FAIL",
    mutation: false,
    receipt,
    traceEvents,
    violations,
    patchHints
  };
};
