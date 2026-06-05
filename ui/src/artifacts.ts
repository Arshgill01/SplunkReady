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

export interface ArtifactOption {
  label: string;
  path: string;
}

const artifactOptionSchema = z
  .object({
    label: z.string().min(1),
    path: z.string().min(1)
  })
  .strict();

const uiArtifactManifestSchema = z
  .object({
    source: z.literal("splunkready-ui-artifacts"),
    generatedAt: z.string().min(1),
    defaultArtifact: z.string().min(1),
    artifacts: z.array(artifactOptionSchema).min(1)
  })
  .strict();

export type UiArtifactManifest = z.infer<typeof uiArtifactManifestSchema>;

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

const hostedModelProofSchema = z
  .object({
    status: z.string().min(1),
    mode: z.enum(["fixture", "live"]),
    mutation: z.boolean(),
    contract: z
      .object({
        id: z.string().min(1),
        mode: z.enum(["fixture", "live"]),
        hostedModelTools: z.array(z.enum(["saia_explain_spl", "saia_optimize_spl"])),
        availableTools: z.array(z.enum(["saia_explain_spl", "saia_optimize_spl"]))
      })
      .strict(),
    query: z.string().min(1),
    deterministicContext: z
      .object({
        ruleIds: z.array(z.string().min(1)),
        passFailAuthority: z.string().min(1),
        purpose: z.string().min(1)
      })
      .strict(),
    assistance: z
      .object({
        explanation: z.string().min(1),
        optimizedQuery: z.string(),
        rationale: z.string(),
        warnings: z.array(z.string())
      })
      .strict()
      .nullable(),
    toolCalls: z.array(z.enum(["saia_explain_spl", "saia_optimize_spl"])),
    error: z.string().min(1).nullable(),
    notes: z.string().min(1)
  })
  .strict();

export type HostedModelProof = z.infer<typeof hostedModelProofSchema>;

const proofLoopSchema = z.enum(["fail-to-pass", "ready-without-patch", "not-ready-after-rerun", "mixed-verdict"]);

const deriveProofLoop = ({
  failToPass,
  beforeVerdict,
  afterVerdict,
  readyWithoutPatch
}: {
  failToPass: boolean;
  beforeVerdict: string;
  afterVerdict: string;
  readyWithoutPatch?: boolean;
}): z.infer<typeof proofLoopSchema> => {
  if (failToPass) {
    return "fail-to-pass";
  }

  if (readyWithoutPatch || (beforeVerdict === "READY" && afterVerdict === "READY")) {
    return "ready-without-patch";
  }

  if (afterVerdict !== "READY") {
    return "not-ready-after-rerun";
  }

  return "mixed-verdict";
};

const hostedModelDiagnosticSchema = z
  .object({
    status: z.enum(["PASS", "BLOCKED"]),
    mode: z.enum(["fixture", "live"]),
    mutation: z.boolean(),
    proofPath: z.string().min(1),
    contract: z
      .object({
        id: z.string().min(1),
        mode: z.enum(["fixture", "live"])
      })
      .strict(),
    requiredTools: z.array(z.enum(["saia_explain_spl", "saia_optimize_spl"])),
    availableTools: z.array(z.enum(["saia_explain_spl", "saia_optimize_spl"])),
    missingTools: z.array(z.enum(["saia_explain_spl", "saia_optimize_spl"])),
    permission: z
      .object({
        status: z.enum(["OK", "BLOCKED"]),
        message: z.string().min(1),
        error: z.string().min(1).optional(),
        requiredActions: z.array(z.string().min(1)).optional()
      })
      .strict(),
    deterministicAuthority: z.string().min(1),
    notes: z.string().min(1)
  })
  .strict();

export type HostedModelDiagnostic = z.infer<typeof hostedModelDiagnosticSchema>;

const proofAuditCheckSchema = z
  .object({
    id: z.string().min(1),
    status: z.enum(["PASS", "WARN", "FAIL"]),
    detail: z.string().min(1),
    evidence: z.unknown().optional()
  })
  .strict();

const proofAuditSchema = z
  .object({
    status: z.enum(["PASS", "WARN", "FAIL"]),
    proofType: z.enum(["live-security", "live", "receipt", "firewall-block", "suite", "external-trace", "unknown"]),
    proofDir: z.string().min(1),
    mode: z.enum(["fixture", "live"]).optional(),
    mutation: z.boolean().optional(),
    failToPass: z.boolean().optional(),
    readyAfterPatch: z.boolean().optional(),
    readyWithoutPatch: z.boolean().optional(),
    proofLoop: proofLoopSchema.optional(),
    hostedModelStatus: z.string().min(1).optional(),
    checks: z.array(proofAuditCheckSchema)
  })
  .strict();

export type ProofAudit = z.infer<typeof proofAuditSchema>;

const proofManifestVerificationSchema = z
  .object({
    source: z.literal("splunkready-proof-manifest-verification"),
    generatedAt: z.string().min(1),
    status: z.enum(["PASS", "FAIL"]),
    proofDir: z.string().min(1),
    manifestPath: z.string().min(1),
    expectedAggregateSha256: z.string().min(1),
    actualAggregateSha256: z.string().min(1),
    expectedFiles: z.number().int().nonnegative(),
    actualFiles: z.number().int().nonnegative(),
    missingFiles: z.array(z.string().min(1)),
    unexpectedFiles: z.array(z.string().min(1)),
    changedFiles: z.array(
      z
        .object({
          path: z.string().min(1),
          expectedSha256: z.string().min(1),
          actualSha256: z.string().min(1),
          expectedSizeBytes: z.number().int().nonnegative(),
          actualSizeBytes: z.number().int().nonnegative()
        })
        .strict()
    )
  })
  .strict();

export type ProofManifestVerification = z.infer<typeof proofManifestVerificationSchema>;

const certificationIndexSchema = z
  .object({
    status: z.enum(["PASS", "WARN", "FAIL"]),
    source: z.literal("splunkready-certification-index"),
    mutation: z.boolean(),
    generatedAt: z.string().min(1),
    proofDirs: z.array(z.string().min(1)),
    totals: z
      .object({
        proofs: z.number().int().nonnegative(),
        ready: z.number().int().nonnegative(),
        notReady: z.number().int().nonnegative(),
        pass: z.number().int().nonnegative(),
        warn: z.number().int().nonnegative(),
        fail: z.number().int().nonnegative()
      })
      .strict(),
    entries: z.array(
      z
        .object({
          label: z.string().min(1),
          proofDir: z.string().min(1),
          proofType: z.enum(["live-security", "live", "receipt", "firewall-block", "suite", "external-trace", "unknown", "missing"]),
          status: z.enum(["PASS", "WARN", "FAIL"]),
          mode: z.enum(["fixture", "live"]).optional(),
          mutation: z.boolean().nullable(),
          agent: z
            .object({
              name: z.string().min(1),
              version: z.string().min(1)
            })
            .strict(),
          receipt: z
            .object({
              id: z.string().min(1),
              verdict: z.string().min(1),
              score: z.number().min(0).max(100),
              violations: z.number().int().nonnegative(),
              evidenceRefs: z.number().int().nonnegative()
            })
            .strict()
            .nullable(),
          proofLoop: proofLoopSchema.optional(),
          hostedModelStatus: z.string().min(1).optional(),
          manifest: z
            .object({
              aggregateSha256: z.string().min(1),
              files: z.number().int().nonnegative()
            })
            .strict()
            .optional(),
          href: z.string().min(1)
        })
        .strict()
    )
  })
  .strict();

export type CertificationIndex = z.infer<typeof certificationIndexSchema>;

const firewallBlockSchema = z
  .object({
    status: z.literal("BLOCKED"),
    code: z.literal("FIREWALL_POLICY_BLOCKED"),
    phase: z.enum(["before", "after"]),
    mode: z.enum(["fixture", "live"]),
    mutation: z.literal(false),
    blockedBeforeSplunk: z.literal(true),
    toolName: z.string().min(1),
    requestId: z.string().min(1),
    missionId: z.string().min(1).optional(),
    message: z.string().min(1),
    query: z.string().min(1).optional(),
    violations: z
      .array(
        z
          .object({
            ruleId: z.string().min(1),
            reason: z.string().min(1)
          })
          .passthrough()
      )
      .optional()
  })
  .strict();

export type FirewallBlock = z.infer<typeof firewallBlockSchema>;

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
    proofLoop: proofLoopSchema.optional(),
    hostedModels: hostedModelSummarySchema.optional(),
    notes: z.string().min(1)
  })
  .strict()
  .transform((summary) => ({
    ...summary,
    proofLoop:
      summary.proofLoop ??
      deriveProofLoop({
        failToPass: summary.failToPass,
        beforeVerdict: summary.before.verdict,
        afterVerdict: summary.after.verdict,
        readyWithoutPatch: summary.readyWithoutPatch
      })
  }));

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
    proofLoop: proofLoopSchema.optional(),
    hostedModels: hostedModelSummarySchema.optional(),
    notes: z.string().min(1)
  })
  .strict()
  .transform((summary) => ({
    ...summary,
    proofLoop:
      summary.proofLoop ??
      deriveProofLoop({
        failToPass: summary.failToPass,
        beforeVerdict: summary.before.verdict,
        afterVerdict: summary.after.verdict
      })
  }));

export type LiveSecurityProofSummary = z.infer<typeof liveSecurityProofSummarySchema>;

const suiteProofSummarySchema = z
  .object({
    status: z.enum(["PASS", "FAIL"]),
    mode: z.literal("fixture"),
    mutation: z.literal(false),
    suiteId: z.string().min(1),
    suiteTitle: z.string().min(1).optional(),
    suitePath: z.string().min(1).optional(),
    missionCount: z.number().int().nonnegative(),
    domains: z.array(z.string().min(1)),
    totals: z
      .object({
        failToPass: z.number().int().nonnegative(),
        readyAfterPatch: z.number().int().nonnegative(),
        evidenceRefs: z.number().int().nonnegative()
      })
      .strict(),
    missions: z.array(
      z
        .object({
          missionId: z.string().min(1),
          title: z.string().min(1),
          domain: z.string().min(1),
          artifactDir: z.string().min(1),
          proofLoop: proofLoopSchema,
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
            .strict()
        })
        .strict()
    )
  })
  .strict();

export type SuiteProofSummary = z.infer<typeof suiteProofSummarySchema>;

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
    validation: z
      .object({
        status: z.enum(["PASS", "FAIL"]),
        expectedFiles: z.array(z.string().min(1)),
        checks: z.array(
          z
            .object({
              id: z.string().min(1),
              status: z.enum(["PASS", "FAIL"]),
              path: z.string().min(1),
              detail: z.string().min(1)
            })
            .strict()
        )
      })
      .strict()
      .optional(),
    operatorWarnings: z.array(z.string().min(1)).optional(),
    cleanupGuidance: z.array(z.string().min(1)).optional(),
    artifacts: z.array(z.string().min(1))
  })
  .strict();

export type LiveSecurityKit = z.infer<typeof liveSecurityKitSchema>;

const mcpTranscriptImportSchema = z
  .object({
    status: z.literal("PASS"),
    source: z.literal("mcp-jsonrpc-transcript"),
    mutation: z.literal(false),
    missionId: z.string().min(1),
    recordCount: z.number().int().nonnegative(),
    importedEvents: z.number().int().nonnegative(),
    toolCalls: z.number().int().nonnegative(),
    toolResults: z.number().int().nonnegative(),
    errors: z.number().int().nonnegative(),
    finalAnswers: z.number().int().nonnegative(),
    skippedRecords: z.number().int().nonnegative(),
    unmatchedToolCalls: z.number().int().nonnegative().optional(),
    toolNames: z.array(z.string().min(1)),
    strictImport: z.boolean().optional(),
    transcriptPath: z.string().min(1).optional(),
    outputTracePath: z.string().min(1).optional(),
    nextCommand: z.string().min(1).optional()
  })
  .strict();

export type McpTranscriptImport = z.infer<typeof mcpTranscriptImportSchema>;

export interface UiArtifactBundle {
  artifactBase: string;
  contract?: EnvironmentContract;
  liveSmokeContract?: EnvironmentContract;
  missions: MissionDefinition[];
  readinessProfile?: ReadinessProfile;
  beforeReceipt?: ReadinessReceipt;
  afterReceipt?: ReadinessReceipt;
  externalReceipt?: ReadinessReceipt;
  receipt?: ReadinessReceipt;
  policyPatch?: PolicyPatch;
  liveProofSummary?: LiveProofSummary;
  liveSecurityProofSummary?: LiveSecurityProofSummary;
  suiteProofSummary?: SuiteProofSummary;
  liveSecurityReadiness?: LiveSecurityReadiness;
  liveSecurityKit?: LiveSecurityKit;
  hostedModelProof?: HostedModelProof;
  hostedModelDiagnostic?: HostedModelDiagnostic;
  proofAudit?: ProofAudit;
  proofManifestVerification?: ProofManifestVerification;
  certificationIndex?: CertificationIndex;
  firewallBlock?: FirewallBlock;
  mcpTranscriptImport?: McpTranscriptImport;
  beforeTrace: TraceEvent[];
  afterTrace: TraceEvent[];
  externalTrace: TraceEvent[];
  importedTrace: TraceEvent[];
  beforeViolations: Violation[];
  afterViolations: Violation[];
  externalViolations: Violation[];
  artifactOptions?: ArtifactOption[];
  missing: string[];
}

const optionalFiles = [
  "environment-contract.json",
  "live-smoke-contract.json",
  "missions.json",
  "readiness-profile.json",
  "receipt-before-001.json",
  "receipt-after-001.json",
  "receipt-external-001.json",
  "policy-patch.json",
  "live-proof-summary.json",
  "live-security-proof-summary.json",
  "suite-proof-summary.json",
  "live-security-readiness.json",
  "live-security-kit.json",
  "hosted-model-proof.json",
  "hosted-model-diagnostic.json",
  "proof-audit.json",
  "proof-manifest-verification.json",
  "certification-index.json",
  "ui-artifacts.json",
  "firewall-block-before.json",
  "firewall-block-after.json",
  "mcp-transcript-import.json",
  "trace-before.json",
  "trace-after.json",
  "trace-external.json",
  "trace-imported.json",
  "violations-before.json",
  "violations-after.json",
  "violations-external.json"
] as const;

export const normalizeArtifactBase = (value: string | null | undefined): string => {
  const fallback = "/__splunkready_artifacts/";
  const raw = value && value.trim().length > 0 ? value.trim() : fallback;
  const localPath = raw.startsWith("artifacts/") ? `/${raw}` : raw;

  return localPath.endsWith("/") ? localPath : `${localPath}/`;
};

export const defaultArtifactOptions: ArtifactOption[] = [
  { label: "Live security proof", path: "artifacts/live-security-ui" },
  { label: "Certification index", path: "artifacts/certification-index" },
  { label: "Suite proof", path: "artifacts/suite-proof" },
  { label: "MCP transcript import", path: "artifacts/mcp-transcript" },
  { label: "LLM fixture proof", path: "artifacts/llm-fixture-proof" },
  { label: "Fixture demo", path: "artifacts/fixture-demo" },
  { label: "Hosted model proof", path: "artifacts/hosted-model-proof" }
];

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
  const externalReceipt = readinessReceiptSchema
    .optional()
    .parse(loaded.get("receipt-external-001.json"));

  return {
    artifactBase: normalizedBase,
    contract,
    liveSmokeContract,
    missions,
    readinessProfile,
    beforeReceipt,
    afterReceipt,
    externalReceipt,
    receipt: afterReceipt ?? beforeReceipt ?? externalReceipt,
    policyPatch: policyPatchSchema.optional().parse(loaded.get("policy-patch.json")),
    liveProofSummary: liveProofSummarySchema.optional().parse(loaded.get("live-proof-summary.json")),
    liveSecurityProofSummary: liveSecurityProofSummarySchema.optional().parse(
      loaded.get("live-security-proof-summary.json")
    ),
    suiteProofSummary: suiteProofSummarySchema.optional().parse(loaded.get("suite-proof-summary.json")),
    liveSecurityReadiness: liveSecurityReadinessSchema.optional().parse(loaded.get("live-security-readiness.json")),
    liveSecurityKit: liveSecurityKitSchema.optional().parse(loaded.get("live-security-kit.json")),
    hostedModelProof: hostedModelProofSchema.optional().parse(loaded.get("hosted-model-proof.json")),
    hostedModelDiagnostic: hostedModelDiagnosticSchema.optional().parse(loaded.get("hosted-model-diagnostic.json")),
    proofAudit: proofAuditSchema.optional().parse(loaded.get("proof-audit.json")),
    proofManifestVerification: proofManifestVerificationSchema
      .optional()
      .parse(loaded.get("proof-manifest-verification.json")),
    certificationIndex: certificationIndexSchema.optional().parse(loaded.get("certification-index.json")),
    artifactOptions: uiArtifactManifestSchema.optional().parse(loaded.get("ui-artifacts.json"))?.artifacts,
    firewallBlock: firewallBlockSchema
      .optional()
      .parse(loaded.get("firewall-block-before.json") ?? loaded.get("firewall-block-after.json")),
    mcpTranscriptImport: mcpTranscriptImportSchema.optional().parse(loaded.get("mcp-transcript-import.json")),
    beforeTrace: traceEventSchema.array().optional().parse(loaded.get("trace-before.json")) ?? [],
    afterTrace: traceEventSchema.array().optional().parse(loaded.get("trace-after.json")) ?? [],
    externalTrace: traceEventSchema.array().optional().parse(loaded.get("trace-external.json")) ?? [],
    importedTrace: traceEventSchema.array().optional().parse(loaded.get("trace-imported.json")) ?? [],
    beforeViolations: violationSchema.array().optional().parse(loaded.get("violations-before.json")) ?? [],
    afterViolations: violationSchema.array().optional().parse(loaded.get("violations-after.json")) ?? [],
    externalViolations: violationSchema.array().optional().parse(loaded.get("violations-external.json")) ?? [],
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
  auditStory: string;
  firewallStory: string;
  suiteStory: string;
  indexStory: string;
  transcriptStory: string;
} => {
  const receipt = bundle.receipt;
  const contract = bundle.liveSmokeContract ?? bundle.contract;
  const firewallBlock = bundle.firewallBlock;

  return {
    verdict: receipt?.verdict ?? (firewallBlock ? "BLOCKED" : "NO RECEIPT"),
    score: receipt ? `${receipt.score}/100` : "--",
    mode: contract?.mode ?? receipt?.mode ?? "unknown",
    contract: contract?.id ?? receipt?.environment.id ?? "not loaded",
    beforeViolations: bundle.beforeViolations.length,
    afterViolations: bundle.afterViolations.length,
    traceEvents:
      bundle.beforeTrace.length +
      bundle.afterTrace.length +
      (bundle.externalTrace.length > 0 ? bundle.externalTrace.length : bundle.importedTrace.length),
    saiaItems: bundle.policyPatch?.splAssistance?.length ?? 0,
    proofStory: firewallBlock
      ? "firewall-block"
      : bundle.liveProofSummary?.failToPass
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
      (bundle.hostedModelDiagnostic ? `hosted diagnostic ${bundle.hostedModelDiagnostic.status.toLowerCase()}` : undefined) ??
      (bundle.hostedModelProof ? `hosted proof ${bundle.hostedModelProof.status.toLowerCase()}` : undefined) ??
      bundle.liveSecurityProofSummary?.hostedModels?.status ??
      bundle.liveProofSummary?.hostedModels?.status ??
      (bundle.policyPatch?.splAssistance?.length ? "invoked" : "not loaded"),
    auditStory: bundle.proofAudit ? `audit ${bundle.proofAudit.status.toLowerCase()}` : "audit not loaded",
    firewallStory: firewallBlock ? `${firewallBlock.phase} ${firewallBlock.toolName}` : "firewall not loaded",
    suiteStory: bundle.suiteProofSummary
      ? `${bundle.suiteProofSummary.status.toLowerCase()} ${bundle.suiteProofSummary.missionCount} mission suite`
      : "suite not loaded",
    indexStory: bundle.certificationIndex
      ? `${bundle.certificationIndex.status.toLowerCase()} ${bundle.certificationIndex.totals.proofs} proof index`
      : "index not loaded",
    transcriptStory: bundle.mcpTranscriptImport
      ? `mcp import ${bundle.mcpTranscriptImport.strictImport ? "strict" : "loaded"}`
      : "mcp import not loaded"
  };
};
