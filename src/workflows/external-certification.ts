import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { z } from "zod";

import { createFixtureSplunkAccessAdapter, loadFixtureSplunkDatasetFromFile } from "../adapters/fixture.js";
import { compileEnvironmentContract } from "../compiler/environment.js";
import { compileReadinessProfile } from "../compiler/readiness-profile.js";
import { createAnswerRules } from "../grader/answer.js";
import { createAppContextRules } from "../grader/app-context.js";
import { createBudgetRules } from "../grader/budget.js";
import { createContractLookupRules } from "../grader/contract.js";
import { createEvidenceRules } from "../grader/evidence.js";
import { createInjectionRules } from "../grader/injection.js";
import { runRuleEngine, type GraderRule } from "../grader/engine.js";
import { createSafetyRules } from "../grader/safety.js";
import { createSavedSearchRules } from "../grader/saved-search.js";
import { scoreMissionReadiness } from "../grader/scoring.js";
import { createSplStructuralRules } from "../grader/spl.js";
import { parseMissionDefinition, type MissionDefinition } from "../missions/dsl.js";
import { compileAgentPolicy } from "../policy/compiler.js";
import { generateReadinessReceipt } from "../receipts/generator.js";
import {
  environmentContractSchema,
  readinessReceiptSchema,
  traceEventSchema,
  violationSchema,
  type EnvironmentContract,
  type ReadinessReceipt,
  type TraceEvent,
  type Violation
} from "../schemas/core.js";
import { importMcpTranscript, parseMcpTranscriptRecords } from "../traces/mcp-transcript.js";
import { writeProofManifest } from "./proof-manifest.js";

export interface ExternalTraceCertificationPayload {
  trace: z.infer<typeof traceEventSchema>[];
  requirePass: boolean;
  agentName?: string;
  agentVersion?: string;
}

export interface McpTranscriptCertificationPayload {
  transcript: string;
  finalAnswer: string;
  strictImport: boolean;
  requirePass: boolean;
  agentName?: string;
  agentVersion?: string;
}

export type ExternalCertificationPayload =
  | { kind: "external-trace"; value: ExternalTraceCertificationPayload }
  | { kind: "mcp-transcript"; value: McpTranscriptCertificationPayload };

export interface ExternalTraceCertificationWorkflowInput {
  outDir: string;
  tracePath: string;
  fixturePath?: string;
  missionPath?: string;
  requirePass?: boolean;
  agentName?: string;
  agentVersion?: string;
}

export interface McpTranscriptCertificationWorkflowInput {
  outDir: string;
  transcriptPath: string;
  fixturePath?: string;
  missionPath?: string;
  strictImport?: boolean;
  requirePass?: boolean;
  agentName?: string;
  agentVersion?: string;
}

export interface ExternalCertificationWorkflowResult {
  status: "PASS" | "FAIL";
  outDir: string;
  artifacts: string[];
  mutation: false;
  messages: string[];
}

type ProofAuditStatus = "PASS" | "WARN" | "FAIL";

interface ProofAuditCheck {
  id: string;
  status: ProofAuditStatus;
  detail: string;
  evidence?: unknown;
}

interface ProofAuditReport {
  status: ProofAuditStatus;
  proofType: "external-trace";
  proofDir: string;
  mode?: EnvironmentContract["mode"];
  mutation: boolean;
  checks: ProofAuditCheck[];
}

const optionalName = z.string().trim().min(1).max(120).optional();
const defaultFixturePath = "fixtures/acme-soc-dev/adapter-fixture.json";
const defaultMissionPath = "fixtures/acme-soc-dev/missions/security-investigation-readiness.json";
const generatedAt = "2026-06-01T06:30:00.000Z";
const compiledAt = "2026-06-01T06:45:00.000Z";

const externalTraceCertificationPayloadSchema = z
  .object({
    trace: traceEventSchema.array().min(1),
    requirePass: z.boolean().optional().default(false),
    agentName: optionalName,
    agentVersion: optionalName
  })
  .strict();

const mcpTranscriptCertificationPayloadSchema = z
  .object({
    transcript: z.string().trim().min(1, "MCP transcript is empty."),
    finalAnswer: z.string().trim().min(1, "MCP transcript certification requires a producer-provided final answer."),
    strictImport: z.boolean().optional().default(true),
    requirePass: z.boolean().optional().default(false),
    agentName: optionalName,
    agentVersion: optionalName
  })
  .strict();

const zodMessage = (result: z.SafeParseReturnType<unknown, unknown>, label: string): string => {
  if (result.success) {
    return label;
  }

  const first = result.error.issues[0];
  const path = first?.path.length ? first.path.join(".") : label;

  return `${path}: ${first?.message ?? "Invalid payload."}`;
};

export const parseExternalTraceCertificationPayload = (input: unknown): ExternalTraceCertificationPayload => {
  const result = externalTraceCertificationPayloadSchema.safeParse(input);

  if (!result.success) {
    throw new Error(`Invalid external trace upload: ${zodMessage(result, "trace")}`);
  }

  return result.data;
};

export const parseMcpTranscriptCertificationPayload = (input: unknown): McpTranscriptCertificationPayload => {
  const result = mcpTranscriptCertificationPayloadSchema.safeParse(input);

  if (!result.success) {
    throw new Error(`Invalid MCP transcript upload: ${zodMessage(result, "transcript")}`);
  }

  return result.data;
};

export const externalCertificationInputSummary = (payload: ExternalCertificationPayload): string => {
  if (payload.kind === "external-trace") {
    return `${payload.value.trace.length} trace event(s); requirePass=${payload.value.requirePass ? "true" : "false"}`;
  }

  return `MCP JSONL transcript; strictImport=${payload.value.strictImport ? "true" : "false"}; requirePass=${
    payload.value.requirePass ? "true" : "false"
  }`;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const stringFromRecord = (value: unknown, key: string): string | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const field = value[key];
  return typeof field === "string" ? field : undefined;
};

const numberFromRecord = (value: unknown, key: string): number | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const field = value[key];
  return typeof field === "number" ? field : undefined;
};

const booleanFromRecord = (value: unknown, key: string): boolean | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const field = value[key];
  return typeof field === "boolean" ? field : undefined;
};

const readJson = async <T>(filePath: string, label: string): Promise<T> => {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    throw new Error(`Unable to read ${label} at ${filePath}. Run the prerequisite CLI command first.`);
  }
};

const readOptionalJson = async <T>(filePath: string): Promise<T | undefined> =>
  readFile(filePath, "utf8")
    .then((input) => JSON.parse(input) as T)
    .catch(() => undefined);

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const writeText = async (filePath: string, value: string): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, value, "utf8");
};

const loadMission = async (missionPath: string): Promise<MissionDefinition> =>
  parseMissionDefinition(JSON.parse(await readFile(missionPath, "utf8")) as unknown);

const loadContract = async (outDir: string): Promise<EnvironmentContract> =>
  environmentContractSchema.parse(await readJson(join(outDir, "environment-contract.json"), "environment contract"));

const loadTraceFile = async (tracePath: string): Promise<TraceEvent[]> => {
  if (!tracePath) {
    throw new Error("grade-trace requires --trace <path>.");
  }

  return traceEventSchema.array().parse(JSON.parse(await readFile(tracePath, "utf8")) as unknown);
};

const assertTraceMatchesMission = (mission: MissionDefinition, traceEvents: TraceEvent[]): void => {
  const mismatchedMissionIds = [...new Set(traceEvents.map((event) => event.missionId).filter((id) => id !== mission.id))];

  if (mismatchedMissionIds.length > 0) {
    throw new Error(`Trace missionId mismatch. Expected ${mission.id}; found ${mismatchedMissionIds.join(", ")}.`);
  }
};

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

const gradeTrace = (contract: EnvironmentContract, mission: MissionDefinition, traceEvents: TraceEvent[]): Violation[] =>
  runRuleEngine({ contract, mission, traceEvents }, allRules()).violations;

const auditStatusFromChecks = (checks: ProofAuditCheck[]): ProofAuditStatus =>
  checks.some((check) => check.status === "FAIL")
    ? "FAIL"
    : checks.some((check) => check.status === "WARN")
      ? "WARN"
      : "PASS";

const writeProofAuditArtifacts = async (outDir: string, report: ProofAuditReport): Promise<string[]> => {
  const auditPath = join(outDir, "proof-audit.json");

  await writeJson(auditPath, report);
  const manifestPath = await writeProofManifest(outDir, compiledAt);

  return [auditPath, manifestPath];
};

const compileFixtureArtifacts = async (
  input: Pick<ExternalTraceCertificationWorkflowInput, "outDir" | "fixturePath" | "missionPath">
): Promise<string[]> => {
  const fixture = await loadFixtureSplunkDatasetFromFile(input.fixturePath ?? defaultFixturePath);
  const adapter = createFixtureSplunkAccessAdapter(fixture);
  const contract = await compileEnvironmentContract(adapter, {
    requestId: "req-cli-fixture-compile-001",
    contractVersion: "2026.06.01",
    generatedAt
  });
  const mission = await loadMission(input.missionPath ?? defaultMissionPath);
  const policy = compileAgentPolicy(contract, { policyVersion: "policy-2026.06.01", compiledAt });
  const readinessProfile = compileReadinessProfile(contract, [mission], {
    profileVersion: "profile-2026.06.01",
    generatedAt: compiledAt
  });

  await writeJson(join(input.outDir, "environment-contract.json"), contract);
  await writeJson(join(input.outDir, "missions.json"), [mission]);
  await writeJson(join(input.outDir, "agent-policy.json"), policy);
  await writeJson(join(input.outDir, "readiness-profile.json"), readinessProfile);

  return [
    join(input.outDir, "environment-contract.json"),
    join(input.outDir, "missions.json"),
    join(input.outDir, "agent-policy.json"),
    join(input.outDir, "readiness-profile.json")
  ];
};

interface TranscriptEvidence {
  refs: Set<string>;
  counts: number[];
  timeWindow: { earliest: string; latest: string } | null;
}

const collectTranscriptEvidence = (input: unknown, evidence: TranscriptEvidence): void => {
  if (Array.isArray(input)) {
    for (const value of input) {
      collectTranscriptEvidence(value, evidence);
    }
    return;
  }

  if (!isRecord(input)) {
    return;
  }

  if (isRecord(input.timeWindow)) {
    const earliest = input.timeWindow.earliest;
    const latest = input.timeWindow.latest;

    if (typeof earliest === "string" && typeof latest === "string" && earliest.trim() && latest.trim()) {
      evidence.timeWindow = { earliest, latest };
    }
  }

  for (const [key, value] of Object.entries(input)) {
    if ((key === "eventRef" || key === "_cd") && typeof value === "string" && value.trim()) {
      evidence.refs.add(value);
    }

    if ((key === "resultCount" || key === "count") && typeof value === "number" && Number.isFinite(value)) {
      evidence.counts.push(value);
    }

    collectTranscriptEvidence(value, evidence);
  }
};

const evidenceFromTranscript = (
  transcript: string
): { evidenceRefs: string[]; resultCount: number | null; timeWindow: { earliest: string; latest: string } | null } => {
  const evidence: TranscriptEvidence = { refs: new Set<string>(), counts: [], timeWindow: null };

  for (const record of parseMcpTranscriptRecords(transcript)) {
    collectTranscriptEvidence(record, evidence);
  }

  return {
    evidenceRefs: [...evidence.refs],
    resultCount: evidence.counts.length > 0 ? evidence.counts.at(-1) ?? null : null,
    timeWindow: evidence.timeWindow
  };
};

const finalAnswerRecord = (finalAnswer: string, transcript: string): string => {
  const evidence = evidenceFromTranscript(transcript);

  return JSON.stringify({
    type: "final_answer",
    finalAnswer,
    resultCount: evidence.resultCount,
    evidenceRefs: evidence.evidenceRefs,
    timeWindow: evidence.timeWindow,
    timestamp: "2026-06-01T06:30:00.000Z"
  });
};

export const runGradeExternalTraceWorkflow = async (
  input: Pick<
    ExternalTraceCertificationWorkflowInput,
    "outDir" | "tracePath" | "missionPath" | "agentName" | "agentVersion"
  >
): Promise<{ artifacts: string[] }> => {
  const contract = await loadContract(input.outDir);
  const mission = await loadMission(input.missionPath ?? defaultMissionPath);
  const traceEvents = await loadTraceFile(input.tracePath);
  assertTraceMatchesMission(mission, traceEvents);
  const violations = gradeTrace(contract, mission, traceEvents);
  const score = scoreMissionReadiness(mission, violations);
  const generated = generateReadinessReceipt({
    id: "receipt-external-001",
    agent: {
      name: input.agentName ?? "External Splunk MCP Agent",
      version: input.agentVersion ?? "uploaded-trace"
    },
    environment: contract,
    missionSuiteVersion: "external-trace-1",
    missions: [mission],
    traceEvents,
    violations,
    notes:
      "This receipt grades an externally supplied trace. The deterministic rule engine decides pass/fail; the trace producer is outside SplunkReady."
  });

  await writeJson(join(input.outDir, "trace-external.json"), traceEvents);
  await writeJson(join(input.outDir, "violations-external.json"), violations);
  await writeJson(join(input.outDir, "score-external.json"), score);
  await writeText(join(input.outDir, "receipt-external-001.json"), generated.json);
  await writeText(join(input.outDir, "receipt-external-001.md"), generated.markdown);

  return {
    artifacts: [
      join(input.outDir, "trace-external.json"),
      join(input.outDir, "violations-external.json"),
      join(input.outDir, "score-external.json"),
      join(input.outDir, "receipt-external-001.json"),
      join(input.outDir, "receipt-external-001.md")
    ]
  };
};

export const runImportMcpTranscriptWorkflow = async (
  input: Pick<
    McpTranscriptCertificationWorkflowInput,
    "outDir" | "transcriptPath" | "missionPath" | "strictImport" | "agentName" | "agentVersion"
  >
): Promise<{ artifacts: string[] }> => {
  if (!input.transcriptPath) {
    throw new Error("import-mcp-transcript requires --transcript <path>.");
  }

  const mission = await loadMission(input.missionPath ?? defaultMissionPath);
  const records = parseMcpTranscriptRecords(await readFile(input.transcriptPath, "utf8"));
  const imported = importMcpTranscript(records, mission.id);
  const importFailures = [
    imported.summary.skippedRecords > 0 ? `${imported.summary.skippedRecords} skipped transcript record(s)` : null,
    imported.summary.unmatchedToolCalls > 0 ? `${imported.summary.unmatchedToolCalls} unmatched tool call(s)` : null
  ].filter((failure): failure is string => Boolean(failure));
  const strictImport = input.strictImport ?? true;
  const agentName = input.agentName ?? "External MCP Transcript Agent";
  const agentVersion = input.agentVersion ?? "uploaded-jsonrpc-transcript";

  if (strictImport && importFailures.length > 0) {
    throw new Error(`Strict MCP transcript import failed: ${importFailures.join("; ")}.`);
  }

  const tracePath = join(input.outDir, "trace-imported.json");
  const summaryPath = join(input.outDir, "mcp-transcript-import.json");

  await writeJson(tracePath, imported.traceEvents);
  await writeJson(summaryPath, {
    ...imported.summary,
    strictImport,
    transcriptPath: input.transcriptPath,
    outputTracePath: tracePath,
    nextCommand: `npm run splunkready -- grade-trace --trace ${tracePath} --out ${input.outDir} --agent-name "${agentName}" --agent-version "${agentVersion}"`
  });

  return { artifacts: [tracePath, summaryPath] };
};

const runExternalTraceAuditWorkflow = async (
  input: Pick<ExternalTraceCertificationWorkflowInput, "outDir" | "requirePass">
): Promise<{ artifacts: string[]; report: ProofAuditReport }> => {
  const checks: ProofAuditCheck[] = [];
  const addCheck = (check: ProofAuditCheck): void => {
    checks.push(check);
  };
  const contractInput = await readOptionalJson<unknown>(join(input.outDir, "environment-contract.json"));
  const contractResult = contractInput ? environmentContractSchema.safeParse(contractInput) : undefined;
  const contract = contractResult?.success ? contractResult.data : undefined;
  const externalReceiptInput = await readOptionalJson<unknown>(join(input.outDir, "receipt-external-001.json"));
  const externalReceiptResult = externalReceiptInput ? readinessReceiptSchema.safeParse(externalReceiptInput) : undefined;
  const externalReceipt = externalReceiptResult?.success ? externalReceiptResult.data : undefined;
  const externalTraceInput = await readOptionalJson<unknown>(join(input.outDir, "trace-external.json"));
  const externalTraceResult = externalTraceInput ? traceEventSchema.array().safeParse(externalTraceInput) : undefined;
  const externalTrace = externalTraceResult?.success ? externalTraceResult.data : undefined;
  const externalViolationsInput = await readOptionalJson<unknown>(join(input.outDir, "violations-external.json"));
  const externalViolationsResult = externalViolationsInput ? violationSchema.array().safeParse(externalViolationsInput) : undefined;
  const externalViolations = externalViolationsResult?.success ? externalViolationsResult.data : undefined;
  const mcpTranscriptImport = await readOptionalJson<unknown>(join(input.outDir, "mcp-transcript-import.json"));
  const traceIds = new Set((externalTrace ?? []).map((event) => event.id));
  const missingTraceRefs = externalReceipt?.traceRefs.filter((traceRef) => !traceIds.has(traceRef)) ?? [];
  const importSummary = isRecord(mcpTranscriptImport) ? mcpTranscriptImport : undefined;
  const importSource = stringFromRecord(importSummary, "source");
  const importMutation = booleanFromRecord(importSummary, "mutation");
  const skippedRecords = numberFromRecord(importSummary, "skippedRecords");
  const unmatchedToolCalls = numberFromRecord(importSummary, "unmatchedToolCalls");
  const strictImport = booleanFromRecord(importSummary, "strictImport");

  addCheck(
    contract
      ? {
          id: "contract-loaded",
          status: "PASS",
          detail: "Environment contract is present and schema-valid.",
          evidence: { id: contract.id, mode: contract.mode }
        }
      : {
          id: "contract-loaded",
          status: "FAIL",
          detail: contractInput
            ? "environment-contract.json is present but does not match the contract schema."
            : "environment-contract.json is missing.",
          evidence: contractResult && !contractResult.success ? contractResult.error.issues : undefined
        }
  );
  addCheck(
    externalReceipt
      ? {
          id: "external-receipt-loaded",
          status: "PASS",
          detail: "External trace receipt is present and schema-valid.",
          evidence: {
            id: externalReceipt.id,
            verdict: externalReceipt.verdict,
            score: externalReceipt.score,
            violations: externalReceipt.violations.length
          }
        }
      : {
          id: "external-receipt-loaded",
          status: "FAIL",
          detail: externalReceiptInput
            ? "receipt-external-001.json is present but does not match the receipt schema."
            : "receipt-external-001.json is missing.",
          evidence: externalReceiptResult && !externalReceiptResult.success ? externalReceiptResult.error.issues : undefined
        }
  );
  addCheck(
    externalTrace
      ? {
          id: "external-trace-loaded",
          status: externalTrace.length > 0 ? "PASS" : "FAIL",
          detail: "External trace artifact is present, schema-valid, and non-empty.",
          evidence: { traceEvents: externalTrace.length }
        }
      : {
          id: "external-trace-loaded",
          status: "FAIL",
          detail: externalTraceInput
            ? "trace-external.json is present but does not match the trace schema."
            : "trace-external.json is missing.",
          evidence: externalTraceResult && !externalTraceResult.success ? externalTraceResult.error.issues : undefined
        }
  );
  addCheck(
    externalViolations
      ? {
          id: "external-violations-loaded",
          status: "PASS",
          detail: "External deterministic violations artifact is present and schema-valid.",
          evidence: { violations: externalViolations.length }
        }
      : {
          id: "external-violations-loaded",
          status: "FAIL",
          detail: externalViolationsInput
            ? "violations-external.json is present but does not match the violation schema."
            : "violations-external.json is missing.",
          evidence:
            externalViolationsResult && !externalViolationsResult.success ? externalViolationsResult.error.issues : undefined
        }
  );
  addCheck({
    id: "external-receipt-trace-refs",
    status: externalReceipt && externalTrace && missingTraceRefs.length === 0 ? "PASS" : "FAIL",
    detail: "Every traceRef in the external receipt must exist in trace-external.json.",
    evidence: { missingTraceRefs }
  });
  addCheck({
    id: "external-verdict-ready",
    status: externalReceipt?.verdict === "READY" ? "PASS" : "FAIL",
    detail: "External-agent CI proof must end with a READY receipt.",
    evidence: externalReceipt
      ? { verdict: externalReceipt.verdict, score: externalReceipt.score, violations: externalReceipt.violations.length }
      : null
  });
  addCheck({
    id: "external-mutation-false",
    status: importMutation === undefined || importMutation === false ? "PASS" : "FAIL",
    detail: "External trace grading is offline; imported MCP transcripts must declare mutation=false when present.",
    evidence: { importMutation: importMutation ?? null }
  });
  addCheck({
    id: "external-mcp-transcript-integrity",
    status:
      !importSummary || (importSource === "mcp-jsonrpc-transcript" && skippedRecords === 0 && unmatchedToolCalls === 0)
        ? "PASS"
        : "FAIL",
    detail: "Imported MCP transcript summaries must have no skipped records or unmatched tool calls.",
    evidence: importSummary
      ? {
          source: importSource ?? null,
          strictImport: strictImport ?? null,
          skippedRecords: skippedRecords ?? null,
          unmatchedToolCalls: unmatchedToolCalls ?? null
        }
      : { source: "not present" }
  });

  const status = auditStatusFromChecks(checks);
  const report: ProofAuditReport = {
    status,
    proofType: "external-trace",
    proofDir: input.outDir,
    mode: contract?.mode ?? externalReceipt?.mode,
    mutation: importMutation ?? false,
    checks
  };
  const artifacts = await writeProofAuditArtifacts(input.outDir, report);

  if (input.requirePass && status !== "PASS") {
    throw new Error(`proof-audit strict gate failed with ${status}. Inspect ${join(input.outDir, "proof-audit.json")}.`);
  }

  return { artifacts, report };
};

const receiptStatusFromArtifact = async (artifactPath: string): Promise<"PASS" | "FAIL"> => {
  const receipt = readinessReceiptSchema.parse(await readJson(artifactPath, "external certification receipt"));

  return receipt.verdict === "READY" ? "PASS" : "FAIL";
};

export const runExternalTraceCertificationFromPathWorkflow = async (
  input: ExternalTraceCertificationWorkflowInput
): Promise<ExternalCertificationWorkflowResult> => {
  const compileArtifacts = await compileFixtureArtifacts(input);
  const gradeResult = await runGradeExternalTraceWorkflow({
    outDir: input.outDir,
    tracePath: input.tracePath,
    missionPath: input.missionPath,
    agentName: input.agentName,
    agentVersion: input.agentVersion
  });
  const auditResult = await runExternalTraceAuditWorkflow({ outDir: input.outDir, requirePass: false });
  const status = await receiptStatusFromArtifact(join(input.outDir, "receipt-external-001.json"));

  if (input.requirePass && status !== "PASS") {
    throw new Error("external-trace-certification strict gate failed with FAIL. Inspect receipt-external-001.json.");
  }

  return {
    status,
    outDir: input.outDir,
    artifacts: [...new Set([...compileArtifacts, ...gradeResult.artifacts, ...auditResult.artifacts])],
    mutation: false,
    messages: []
  };
};

export const runMcpTranscriptCertificationFromPathWorkflow = async (
  input: McpTranscriptCertificationWorkflowInput
): Promise<ExternalCertificationWorkflowResult> => {
  if (!input.transcriptPath) {
    throw new Error("certify-mcp-transcript requires --transcript <path>.");
  }

  const compileArtifacts = await compileFixtureArtifacts(input);
  const importResult = await runImportMcpTranscriptWorkflow(input);
  const gradeResult = await runGradeExternalTraceWorkflow({
    outDir: input.outDir,
    tracePath: join(input.outDir, "trace-imported.json"),
    missionPath: input.missionPath,
    agentName: input.agentName ?? "External MCP Transcript Agent",
    agentVersion: input.agentVersion ?? "uploaded-jsonrpc-transcript"
  });
  const auditResult = await runExternalTraceAuditWorkflow({ outDir: input.outDir, requirePass: false });
  const receipt = readinessReceiptSchema.parse(
    await readJson(join(input.outDir, "receipt-external-001.json"), "external receipt")
  );
  const summaryPath = join(input.outDir, "mcp-transcript-certification.json");

  await writeJson(summaryPath, {
    status: auditResult.report.status === "PASS" ? "PASS" : "FAIL",
    source: "mcp-jsonrpc-transcript-certification",
    mutation: false,
    transcriptPath: input.transcriptPath,
    missionPath: input.missionPath ?? defaultMissionPath,
    agent: receipt.agent,
    receipt: {
      id: receipt.id,
      verdict: receipt.verdict,
      score: receipt.score,
      violations: receipt.violations.length,
      traceRefs: receipt.traceRefs.length,
      evidenceRefs: receipt.evidenceRefs.length
    },
    audit: {
      status: auditResult.report.status,
      proofType: auditResult.report.proofType,
      checks: auditResult.report.checks.map((check) => ({ id: check.id, status: check.status }))
    },
    artifacts: {
      contract: join(input.outDir, "environment-contract.json"),
      importedTrace: join(input.outDir, "trace-imported.json"),
      externalTrace: join(input.outDir, "trace-external.json"),
      violations: join(input.outDir, "violations-external.json"),
      receipt: join(input.outDir, "receipt-external-001.json"),
      audit: join(input.outDir, "proof-audit.json")
    }
  });

  const finalAuditResult = await runExternalTraceAuditWorkflow({ outDir: input.outDir, requirePass: false });

  if (input.requirePass && finalAuditResult.report.status !== "PASS") {
    throw new Error(`certify-mcp-transcript strict gate failed with ${finalAuditResult.report.status}. Inspect ${summaryPath}.`);
  }

  return {
    status: finalAuditResult.report.status === "PASS" ? "PASS" : "FAIL",
    outDir: input.outDir,
    artifacts: [
      ...new Set([...compileArtifacts, ...importResult.artifacts, ...gradeResult.artifacts, summaryPath, ...finalAuditResult.artifacts])
    ],
    mutation: false,
    messages: []
  };
};

export const runExternalTraceCertificationWorkflow = async (
  input: { outDir: string; payload: ExternalTraceCertificationPayload },
  env: NodeJS.ProcessEnv = process.env
): Promise<{ artifacts: string[] }> => {
  const tracePath = join(input.outDir, "uploaded-external-trace.json");

  await writeFile(tracePath, `${JSON.stringify(input.payload.trace, null, 2)}\n`, "utf8");

  const result = await runExternalTraceCertificationFromPathWorkflow({
    outDir: input.outDir,
    tracePath,
    requirePass: input.payload.requirePass,
    agentName: input.payload.agentName,
    agentVersion: input.payload.agentVersion
  });

  return { artifacts: [tracePath, ...result.artifacts] };
};

export const runMcpTranscriptCertificationWorkflow = async (
  input: { outDir: string; payload: McpTranscriptCertificationPayload },
  env: NodeJS.ProcessEnv = process.env
): Promise<{ artifacts: string[] }> => {
  const transcriptPath = join(input.outDir, "uploaded-mcp-transcript.jsonl");
  const transcript = `${input.payload.transcript.trim()}\n${finalAnswerRecord(
    input.payload.finalAnswer,
    input.payload.transcript
  )}\n`;

  await writeFile(transcriptPath, transcript, "utf8");

  const result = await runMcpTranscriptCertificationFromPathWorkflow({
    outDir: input.outDir,
    transcriptPath,
    strictImport: input.payload.strictImport,
    requirePass: input.payload.requirePass,
    agentName: input.payload.agentName,
    agentVersion: input.payload.agentVersion
  });

  return { artifacts: [transcriptPath, ...result.artifacts] };
};
