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

const hostedModelSummarySchema = z
  .object({
    status: z.enum(["invoked", "available_not_applicable", "unavailable"]),
    availableTools: z.array(z.enum(["saia_explain_spl", "saia_optimize_spl"])),
    missingTools: z.array(z.enum(["saia_explain_spl", "saia_optimize_spl"])),
    assistanceItems: z.number().int().nonnegative(),
    notes: z.string().min(1)
  })
  .strict();

export type HostedModelSummary = z.infer<typeof hostedModelSummarySchema>;

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
    hostedModels: hostedModelSummarySchema.optional(),
    notes: z.string().min(1)
  })
  .strict();

export type LiveProofSummary = z.infer<typeof liveProofSummarySchema>;

const liveSecurityProofSummarySchema = z
  .object({
    status: z.string().min(1),
    mode: z.literal("live"),
    mutation: z.boolean(),
    mission: z.string().min(1),
    readinessStatus: z.string().min(1),
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
        violations: z.number().int().nonnegative(),
        evidenceRefs: z.array(z.string().min(1))
      })
      .strict(),
    failToPass: z.boolean(),
    readyAfterPatch: z.boolean(),
    hostedModels: hostedModelSummarySchema.optional(),
    notes: z.string().min(1)
  })
  .strict();

export type LiveSecurityProofSummary = z.infer<typeof liveSecurityProofSummarySchema>;

const liveSecurityReadinessSchema = z
  .object({
    status: z.enum(["READY_FOR_FLAGSHIP_LIVE_SECURITY_PROOF", "BLOCKED"]),
    mode: z.literal("live"),
    mutation: z.boolean(),
    mission: z
      .object({
        id: z.string().min(1),
        story: z.string().min(1)
      })
      .strict(),
    contract: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
        indexes: z.number().int().nonnegative(),
        savedSearches: z.number().int().nonnegative(),
        tools: z.number().int().nonnegative()
      })
      .strict(),
    requiredTools: z
      .object({
        expected: z.array(z.string().min(1)),
        missing: z.array(z.string().min(1))
      })
      .strict(),
    preferredIndex: z
      .object({
        name: z.string().min(1),
        present: z.boolean(),
        sensitive: z.boolean().nullable()
      })
      .strict(),
    requiredSavedSearch: z
      .object({
        app: z.string().min(1),
        name: z.string().min(1),
        ref: z.string().min(1),
        present: z.boolean(),
        nearbySavedSearches: z.array(z.string().min(1)),
        run: z.union([
          z
            .object({
              attempted: z.literal(false),
              reason: z.string().min(1)
            })
            .strict(),
          z
            .object({
              attempted: z.literal(true),
              resultCount: z.number().int().nonnegative().nullable(),
              evidenceRefs: z.array(z.string().min(1)),
              warnings: z.array(z.string()),
              error: z.string().min(1).optional()
            })
            .strict()
        ])
      })
      .strict(),
    blockers: z.array(z.string().min(1)),
    nextActions: z.array(z.string().min(1))
  })
  .strict();

export type LiveSecurityReadiness = z.infer<typeof liveSecurityReadinessSchema>;

const liveSecurityKitSchema = z
  .object({
    status: z.string().min(1),
    mutation: z.boolean(),
    operatorActionRequired: z.boolean(),
    mission: z.string().min(1),
    savedSearch: z
      .object({
        app: z.string().min(1),
        name: z.string().min(1),
        ref: z.string().min(1)
      })
      .strict(),
    preferredIndex: z.string().min(1),
    sourcetype: z.string().min(1),
    sampleEvents: z.number().int().nonnegative(),
    generatedAt: z.string().min(1),
    artifacts: z.array(z.string().min(1))
  })
  .strict();

export type LiveSecurityKit = z.infer<typeof liveSecurityKitSchema>;

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
  liveSecurityProofSummary?: LiveSecurityProofSummary;
  liveSecurityReadiness?: LiveSecurityReadiness;
  liveSecurityKit?: LiveSecurityKit;
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
  "live-security-proof-summary.json",
  "live-security-readiness.json",
  "live-security-kit.json",
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
    liveSecurityProofSummary: liveSecurityProofSummarySchema.optional().parse(
      loaded.get("live-security-proof-summary.json")
    ),
    liveSecurityReadiness: liveSecurityReadinessSchema.optional().parse(loaded.get("live-security-readiness.json")),
    liveSecurityKit: liveSecurityKitSchema.optional().parse(loaded.get("live-security-kit.json")),
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
  securityStory: string;
  kitStory: string;
  hostedModelStory: string;
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
        : "not loaded",
    securityStory: bundle.liveSecurityProofSummary
      ? bundle.liveSecurityProofSummary.failToPass
        ? "security fail-to-pass"
        : bundle.liveSecurityProofSummary.readyAfterPatch
          ? "security proof ready"
          : "security proof loaded"
      : bundle.liveSecurityReadiness
      ? bundle.liveSecurityReadiness.status === "BLOCKED"
        ? "security blocked"
        : "security ready"
      : "security not loaded",
    kitStory: bundle.liveSecurityKit
      ? bundle.liveSecurityKit.operatorActionRequired
        ? "operator kit available"
        : "kit loaded"
      : "kit not loaded",
    hostedModelStory:
      bundle.liveSecurityProofSummary?.hostedModels?.status ??
      bundle.liveProofSummary?.hostedModels?.status ??
      (bundle.policyPatch?.splAssistance?.length ? "invoked" : "not loaded")
  };
};
