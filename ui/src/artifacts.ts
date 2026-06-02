import {
  environmentContractSchema,
  policyPatchSchema,
  readinessProfileSchema,
  readinessReceiptSchema,
  traceEventSchema,
  violationSchema,
  type EnvironmentContract,
  type PolicyPatch,
  type ReadinessProfile,
  type ReadinessReceipt,
  type TraceEvent,
  type Violation
} from "../../src/schemas/core.js";
import { parseMissionDefinition, type MissionDefinition } from "../../src/missions/dsl.js";
import { z } from "zod";

export type ArtifactFetch = (input: string) => Promise<Response>;

const liveProofSummarySchema = z
  .object({
    status: z.string().min(1),
    mode: z.literal("live"),
    mutation: z.boolean(),
    derivedMission: z
      .object({
        strategy: z.enum(["saved-search-with-evidence", "internal-query-fallback", "none"]),
        reason: z.string().min(1),
        missionId: z.string().min(1).optional(),
        artifacts: z.array(z.string().min(1)).optional()
      })
      .strict(),
    before: z
      .object({
        verdict: z.string().min(1),
        score: z.number().min(0).max(100),
        violations: z.number().int().nonnegative()
      })
      .strict(),
    after: z
      .object({
        verdict: z.string().min(1),
        score: z.number().min(0).max(100),
        violations: z.number().int().nonnegative()
      })
      .strict(),
    failToPass: z.boolean(),
    readyWithoutPatch: z.boolean(),
    notes: z.string().min(1)
  })
  .strict();

export type LiveProofSummary = z.infer<typeof liveProofSummarySchema>;

export interface UiArtifactBundle {
  artifactBase: string;
  contract?: EnvironmentContract;
  liveSmokeContract?: EnvironmentContract;
  missions: MissionDefinition[];
  readinessProfile?: ReadinessProfile;
  beforeReceipt?: ReadinessReceipt;
  afterReceipt?: ReadinessReceipt;
  receipt?: ReadinessReceipt;
  policyPatch?: PolicyPatch;
  liveProofSummary?: LiveProofSummary;
  beforeTrace: TraceEvent[];
  afterTrace: TraceEvent[];
  beforeViolations: Violation[];
  afterViolations: Violation[];
  missing: string[];
}

const optionalFiles = [
  "environment-contract.json",
  "live-smoke-contract.json",
  "missions.json",
  "readiness-profile.json",
  "receipt-before-001.json",
  "receipt-after-001.json",
  "policy-patch.json",
  "live-proof-summary.json",
  "trace-before.json",
  "trace-after.json",
  "violations-before.json",
  "violations-after.json"
] as const;

export const normalizeArtifactBase = (value: string | null | undefined): string => {
  const fallback = "/__splunkready_artifacts/";
  const raw = value && value.trim().length > 0 ? value.trim() : fallback;
  return raw.endsWith("/") ? raw : `${raw}/`;
};

export const artifactBaseFromLocation = (location: Pick<Location, "search">): string => {
  const params = new URLSearchParams(location.search);
  return normalizeArtifactBase(params.get("artifacts") ?? params.get("artifactBase"));
};

export const artifactUrl = (artifactBase: string, fileName: string): string =>
  `${normalizeArtifactBase(artifactBase)}${encodeURIComponent(fileName)}`;

const loadOptionalJson = async (
  artifactBase: string,
  fileName: (typeof optionalFiles)[number],
  fetcher: ArtifactFetch
): Promise<unknown | undefined> => {
  const response = await fetcher(artifactUrl(artifactBase, fileName));

  if (response.status === 204 || response.status === 404) {
    return undefined;
  }

  if (!response.ok) {
    throw new Error(`Unable to load ${fileName}: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<unknown>;
};

export const loadUiArtifactBundle = async (
  artifactBase: string,
  fetcher: ArtifactFetch = fetch
): Promise<UiArtifactBundle> => {
  const normalizedBase = normalizeArtifactBase(artifactBase);
  const loaded = new Map<string, unknown>();
  const missing: string[] = [];

  await Promise.all(
    optionalFiles.map(async (fileName) => {
      const value = await loadOptionalJson(normalizedBase, fileName, fetcher);

      if (value === undefined) {
        missing.push(fileName);
        return;
      }

      loaded.set(fileName, value);
    })
  );

  const contract = environmentContractSchema
    .optional()
    .parse(loaded.get("environment-contract.json"));
  const liveSmokeContract = environmentContractSchema
    .optional()
    .parse(loaded.get("live-smoke-contract.json"));
  const missionsInput = loaded.get("missions.json");
  const missions = Array.isArray(missionsInput) ? missionsInput.map((mission) => parseMissionDefinition(mission)) : [];
  const readinessProfile = readinessProfileSchema
    .optional()
    .parse(loaded.get("readiness-profile.json"));
  const beforeReceipt = readinessReceiptSchema
    .optional()
    .parse(loaded.get("receipt-before-001.json"));
  const afterReceipt = readinessReceiptSchema
    .optional()
    .parse(loaded.get("receipt-after-001.json"));

  return {
    artifactBase: normalizedBase,
    contract,
    liveSmokeContract,
    missions,
    readinessProfile,
    beforeReceipt,
    afterReceipt,
    receipt: afterReceipt ?? beforeReceipt,
    policyPatch: policyPatchSchema.optional().parse(loaded.get("policy-patch.json")),
    liveProofSummary: liveProofSummarySchema.optional().parse(loaded.get("live-proof-summary.json")),
    beforeTrace: traceEventSchema.array().optional().parse(loaded.get("trace-before.json")) ?? [],
    afterTrace: traceEventSchema.array().optional().parse(loaded.get("trace-after.json")) ?? [],
    beforeViolations: violationSchema.array().optional().parse(loaded.get("violations-before.json")) ?? [],
    afterViolations: violationSchema.array().optional().parse(loaded.get("violations-after.json")) ?? [],
    missing: missing.sort()
  };
};

export const summarizeBundle = (bundle: UiArtifactBundle): {
  verdict: string;
  score: string;
  mode: string;
  contract: string;
  beforeViolations: number;
  afterViolations: number;
  traceEvents: number;
  saiaItems: number;
  proofStory: string;
} => {
  const receipt = bundle.receipt;
  const contract = bundle.liveSmokeContract ?? bundle.contract;

  return {
    verdict: receipt?.verdict ?? "NO RECEIPT",
    score: receipt ? `${receipt.score}/100` : "--",
    mode: contract?.mode ?? receipt?.mode ?? "unknown",
    contract: contract?.id ?? receipt?.environment.id ?? "not loaded",
    beforeViolations: bundle.beforeViolations.length,
    afterViolations: bundle.afterViolations.length,
    traceEvents: bundle.beforeTrace.length + bundle.afterTrace.length,
    saiaItems: bundle.policyPatch?.splAssistance?.length ?? 0,
    proofStory: bundle.liveProofSummary?.failToPass
      ? "fail-to-pass"
      : bundle.liveProofSummary?.readyWithoutPatch
        ? "ready-without-patch"
        : "not loaded"
  };
};
