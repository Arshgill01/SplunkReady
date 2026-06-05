import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { firewallBlockedCode } from "../gateway/firewall.js";
import {
  environmentContractSchema,
  readinessReceiptSchema,
  traceEventSchema,
  violationSchema,
  type EnvironmentContract
} from "../schemas/core.js";
import { writeProofManifest } from "./proof-manifest.js";

export type ProofAuditStatus = "PASS" | "WARN" | "FAIL";

export interface ProofAuditCheck {
  id: string;
  status: ProofAuditStatus;
  detail: string;
  evidence?: unknown;
}

export type ProofLoop = "fail-to-pass" | "ready-without-patch" | "not-ready-after-rerun" | "mixed-verdict";

export interface ProofAuditReport {
  status: ProofAuditStatus;
  proofType: "live-security" | "live" | "receipt" | "firewall-block" | "suite" | "external-trace" | "unknown";
  proofDir: string;
  mode?: EnvironmentContract["mode"];
  mutation?: boolean;
  failToPass?: boolean;
  readyAfterPatch?: boolean;
  readyWithoutPatch?: boolean;
  proofLoop?: ProofLoop;
  hostedModelStatus?: string;
  checks: ProofAuditCheck[];
}

export interface ProofAuditWorkflowInput {
  outDir: string;
  requirePass?: boolean;
  generatedAt?: string;
}

export interface ProofAuditWorkflowResult {
  status: ProofAuditStatus;
  report: ProofAuditReport;
  artifacts: string[];
}

const defaultGeneratedAt = "2026-06-01T06:45:00.000Z";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringFromRecord = (value: unknown, key: string): string | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const field = value[key];
  return typeof field === "string" ? field : undefined;
};

const booleanFromRecord = (value: unknown, key: string): boolean | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const field = value[key];
  return typeof field === "boolean" ? field : undefined;
};

const numberFromRecord = (value: unknown, key: string): number | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const field = value[key];
  return typeof field === "number" ? field : undefined;
};

const auditStatusFromChecks = (checks: ProofAuditCheck[]): ProofAuditStatus =>
  checks.some((check) => check.status === "FAIL")
    ? "FAIL"
    : checks.some((check) => check.status === "WARN")
      ? "WARN"
      : "PASS";

const readOptionalJson = async <T>(filePath: string): Promise<T | undefined> => {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return undefined;
  }
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const writeProofAuditArtifacts = async (
  outDir: string,
  generatedAt: string,
  report: ProofAuditReport
): Promise<string[]> => {
  const auditPath = join(outDir, "proof-audit.json");

  await writeJson(auditPath, report);
  const manifestPath = await writeProofManifest(outDir, generatedAt);

  return [auditPath, manifestPath];
};

export const classifyProofLoop = (
  beforeReceipt: { verdict: string },
  afterReceipt: { verdict: string }
): ProofLoop => {
  if (beforeReceipt.verdict === "NOT READY" && afterReceipt.verdict === "READY") {
    return "fail-to-pass";
  }

  if (beforeReceipt.verdict === "READY" && afterReceipt.verdict === "READY") {
    return "ready-without-patch";
  }

  if (afterReceipt.verdict !== "READY") {
    return "not-ready-after-rerun";
  }

  return "mixed-verdict";
};

const finishProofAudit = async (
  input: Required<ProofAuditWorkflowInput>,
  report: ProofAuditReport
): Promise<ProofAuditWorkflowResult> => {
  const auditPath = join(input.outDir, "proof-audit.json");
  const artifacts = await writeProofAuditArtifacts(input.outDir, input.generatedAt, report);

  if (input.requirePass && report.status !== "PASS") {
    throw new Error(`proof-audit strict gate failed with ${report.status}. Inspect ${auditPath}.`);
  }

  return { status: report.status, report, artifacts };
};

export const runProofAuditWorkflow = async (
  workflowInput: ProofAuditWorkflowInput
): Promise<ProofAuditWorkflowResult> => {
  const input: Required<ProofAuditWorkflowInput> = {
    outDir: workflowInput.outDir,
    requirePass: workflowInput.requirePass ?? false,
    generatedAt: workflowInput.generatedAt ?? defaultGeneratedAt
  };
  const checks: ProofAuditCheck[] = [];
  const addCheck = (check: ProofAuditCheck): void => {
    checks.push(check);
  };
  const contractInput = await readOptionalJson<unknown>(join(input.outDir, "environment-contract.json"));
  const beforeReceiptInput = await readOptionalJson<unknown>(join(input.outDir, "receipt-before-001.json"));
  const afterReceiptInput = await readOptionalJson<unknown>(join(input.outDir, "receipt-after-001.json"));
  const externalReceiptInput = await readOptionalJson<unknown>(join(input.outDir, "receipt-external-001.json"));
  const externalTraceInput = await readOptionalJson<unknown>(join(input.outDir, "trace-external.json"));
  const externalViolationsInput = await readOptionalJson<unknown>(join(input.outDir, "violations-external.json"));
  const mcpTranscriptImport = await readOptionalJson<unknown>(join(input.outDir, "mcp-transcript-import.json"));
  const liveProofSummary = await readOptionalJson<unknown>(join(input.outDir, "live-proof-summary.json"));
  const liveSecurityProofSummary = await readOptionalJson<unknown>(
    join(input.outDir, "live-security-proof-summary.json")
  );
  const suiteProofSummary = await readOptionalJson<unknown>(join(input.outDir, "suite-proof-summary.json"));
  const hostedModelProof = await readOptionalJson<unknown>(join(input.outDir, "hosted-model-proof.json"));
  const firewallBlockBefore = await readOptionalJson<unknown>(join(input.outDir, "firewall-block-before.json"));
  const firewallBlockAfter = await readOptionalJson<unknown>(join(input.outDir, "firewall-block-after.json"));
  const firewallBlock = firewallBlockBefore ?? firewallBlockAfter;
  const contractResult = contractInput ? environmentContractSchema.safeParse(contractInput) : undefined;
  const beforeReceiptResult = beforeReceiptInput ? readinessReceiptSchema.safeParse(beforeReceiptInput) : undefined;
  const afterReceiptResult = afterReceiptInput ? readinessReceiptSchema.safeParse(afterReceiptInput) : undefined;
  const externalReceiptResult = externalReceiptInput ? readinessReceiptSchema.safeParse(externalReceiptInput) : undefined;
  const externalTraceResult = externalTraceInput ? traceEventSchema.array().safeParse(externalTraceInput) : undefined;
  const externalViolationsResult = externalViolationsInput
    ? violationSchema.array().safeParse(externalViolationsInput)
    : undefined;
  const contract = contractResult?.success ? contractResult.data : undefined;
  const beforeReceipt = beforeReceiptResult?.success ? beforeReceiptResult.data : undefined;
  const afterReceipt = afterReceiptResult?.success ? afterReceiptResult.data : undefined;
  const externalReceipt = externalReceiptResult?.success ? externalReceiptResult.data : undefined;
  const externalTrace = externalTraceResult?.success ? externalTraceResult.data : undefined;
  const externalViolations = externalViolationsResult?.success ? externalViolationsResult.data : undefined;
  const proofType: ProofAuditReport["proofType"] = suiteProofSummary
    ? "suite"
    : firewallBlock
      ? "firewall-block"
      : liveSecurityProofSummary
        ? "live-security"
        : liveProofSummary
          ? "live"
          : beforeReceipt || afterReceipt
            ? "receipt"
            : externalReceiptInput
              ? "external-trace"
              : "unknown";

  if (proofType === "suite") {
    const summary = isRecord(suiteProofSummary) ? suiteProofSummary : undefined;
    const totals = summary && isRecord(summary.totals) ? summary.totals : undefined;
    const missions = summary && Array.isArray(summary.missions) ? summary.missions : [];
    const suiteStatus = stringFromRecord(summary, "status");
    const mode = stringFromRecord(summary, "mode");
    const suiteMutation = booleanFromRecord(summary, "mutation");
    const missionCount = numberFromRecord(summary, "missionCount");
    const failToPassCount = numberFromRecord(totals, "failToPass");
    const readyAfterPatchCount = numberFromRecord(totals, "readyAfterPatch");
    const evidenceRefCount = numberFromRecord(totals, "evidenceRefs");
    const missionLoops = missions.map((mission) => stringFromRecord(mission, "proofLoop"));
    const missionIds = missions.map((mission) => stringFromRecord(mission, "missionId")).filter(Boolean);
    const suiteId = stringFromRecord(summary, "suiteId");

    addCheck({
      id: "suite-summary-loaded",
      status: summary && suiteId && missionCount !== undefined ? "PASS" : "FAIL",
      detail: "Suite proof summary must be present with suite identity and mission count.",
      evidence: { suiteId: suiteId ?? null, missionCount: missionCount ?? null, missionIds }
    });
    addCheck({
      id: "suite-status-pass",
      status: suiteStatus === "PASS" ? "PASS" : "FAIL",
      detail: "Suite proof summary must report PASS.",
      evidence: { status: suiteStatus ?? null }
    });
    addCheck({
      id: "suite-mutation-false",
      status: suiteMutation === false ? "PASS" : suiteMutation === true ? "FAIL" : "WARN",
      detail: "Suite proof must declare mutation=false.",
      evidence: { mutation: suiteMutation ?? null }
    });
    addCheck({
      id: "suite-fail-to-pass",
      status:
        missionCount !== undefined &&
        missionCount > 0 &&
        failToPassCount === missionCount &&
        missionLoops.every((loop) => loop === "fail-to-pass")
          ? "PASS"
          : "FAIL",
      detail: "Every mission in the suite must demonstrate NOT READY -> READY.",
      evidence: { missionCount: missionCount ?? null, failToPass: failToPassCount ?? null, missionLoops }
    });
    addCheck({
      id: "suite-ready-after-patch",
      status: missionCount !== undefined && readyAfterPatchCount === missionCount ? "PASS" : "FAIL",
      detail: "Every mission in the suite must end READY after patch.",
      evidence: { missionCount: missionCount ?? null, readyAfterPatch: readyAfterPatchCount ?? null }
    });
    addCheck({
      id: "suite-evidence-refs-present",
      status: evidenceRefCount !== undefined && evidenceRefCount > 0 ? "PASS" : "FAIL",
      detail: "Suite proof must carry evidence references from final receipts.",
      evidence: { evidenceRefs: evidenceRefCount ?? null }
    });

    const status = auditStatusFromChecks(checks);
    return finishProofAudit(input, {
      status,
      proofType,
      proofDir: input.outDir,
      mode: mode === "fixture" || mode === "live" ? mode : undefined,
      mutation: suiteMutation,
      failToPass: missionCount !== undefined && failToPassCount === missionCount,
      readyAfterPatch: missionCount !== undefined && readyAfterPatchCount === missionCount,
      proofLoop: missionLoops.every((loop) => loop === "fail-to-pass") ? "fail-to-pass" : undefined,
      checks
    });
  }

  const failToPass =
    booleanFromRecord(liveSecurityProofSummary, "failToPass") ??
    booleanFromRecord(liveProofSummary, "failToPass") ??
    (beforeReceipt && afterReceipt ? beforeReceipt.verdict === "NOT READY" && afterReceipt.verdict === "READY" : undefined);
  const readyWithoutPatch =
    booleanFromRecord(liveProofSummary, "readyWithoutPatch") ??
    (beforeReceipt && afterReceipt ? beforeReceipt.verdict === "READY" && afterReceipt.verdict === "READY" : undefined);
  const readyAfterPatch =
    booleanFromRecord(liveSecurityProofSummary, "readyAfterPatch") ??
    (afterReceipt ? afterReceipt.verdict === "READY" : undefined);
  const proofLoop =
    stringFromRecord(liveSecurityProofSummary, "proofLoop") ??
    stringFromRecord(liveProofSummary, "proofLoop") ??
    (beforeReceipt && afterReceipt ? classifyProofLoop(beforeReceipt, afterReceipt) : undefined);
  const mutationValues = [liveSecurityProofSummary, liveProofSummary, hostedModelProof, firewallBlock]
    .map((artifact) => booleanFromRecord(artifact, "mutation"))
    .filter((value): value is boolean => typeof value === "boolean");
  const mutation = mutationValues.length > 0 ? mutationValues.some((value) => value) : undefined;
  const hostedModelProofStatus = stringFromRecord(hostedModelProof, "status");
  const hostedModelStatus =
    (hostedModelProofStatus === "PASS" ? "invoked" : hostedModelProofStatus) ??
    stringFromRecord(isRecord(liveSecurityProofSummary) ? liveSecurityProofSummary.hostedModels : undefined, "status") ??
    stringFromRecord(isRecord(liveProofSummary) ? liveProofSummary.hostedModels : undefined, "status");

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

  if (proofType === "firewall-block") {
    const code = stringFromRecord(firewallBlock, "code");
    const phase = stringFromRecord(firewallBlock, "phase");
    const toolName = stringFromRecord(firewallBlock, "toolName");
    const query = stringFromRecord(firewallBlock, "query");
    const blockedBeforeSplunk = booleanFromRecord(firewallBlock, "blockedBeforeSplunk");
    const firewallMutation = booleanFromRecord(firewallBlock, "mutation");
    const violations = isRecord(firewallBlock) && Array.isArray(firewallBlock.violations) ? firewallBlock.violations : [];

    addCheck({
      id: "firewall-block-loaded",
      status:
        code === firewallBlockedCode &&
        (phase === "before" || phase === "after") &&
        toolName === "splunk_run_query"
          ? "PASS"
          : "FAIL",
      detail: "Firewall block report must identify the blocked Splunk tool and phase.",
      evidence: { code, phase, toolName }
    });
    addCheck({
      id: "firewall-block-before-splunk",
      status: blockedBeforeSplunk === true && firewallMutation === false ? "PASS" : "FAIL",
      detail: "Firewall block reports must prove the query was rejected before Splunk execution and without mutation.",
      evidence: { blockedBeforeSplunk, mutation: firewallMutation }
    });
    addCheck({
      id: "firewall-block-query",
      status: query && violations.length > 0 ? "PASS" : "FAIL",
      detail: "Firewall block report must include the blocked query and deterministic rule evidence.",
      evidence: { query, violationCount: violations.length }
    });

    return finishProofAudit(input, {
      status: auditStatusFromChecks(checks),
      proofType,
      proofDir: input.outDir,
      mode: contract?.mode,
      mutation,
      checks
    });
  }

  if (proofType === "external-trace") {
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
        !importSummary ||
        (importSource === "mcp-jsonrpc-transcript" && skippedRecords === 0 && unmatchedToolCalls === 0)
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

    return finishProofAudit(input, {
      status: auditStatusFromChecks(checks),
      proofType,
      proofDir: input.outDir,
      mode: contract?.mode ?? externalReceipt?.mode,
      mutation: importMutation ?? false,
      checks
    });
  }

  addCheck(
    beforeReceipt
      ? {
          id: "receipt-before-loaded",
          status: "PASS",
          detail: "Before receipt is present and schema-valid.",
          evidence: { id: beforeReceipt.id, verdict: beforeReceipt.verdict, score: beforeReceipt.score }
        }
      : {
          id: "receipt-before-loaded",
          status: "FAIL",
          detail: beforeReceiptInput
            ? "receipt-before-001.json is present but does not match the receipt schema."
            : "receipt-before-001.json is missing.",
          evidence: beforeReceiptResult && !beforeReceiptResult.success ? beforeReceiptResult.error.issues : undefined
        }
  );
  addCheck(
    afterReceipt
      ? {
          id: "receipt-after-loaded",
          status: "PASS",
          detail: "After receipt is present and schema-valid.",
          evidence: { id: afterReceipt.id, verdict: afterReceipt.verdict, score: afterReceipt.score }
        }
      : {
          id: "receipt-after-loaded",
          status: "FAIL",
          detail: afterReceiptInput
            ? "receipt-after-001.json is present but does not match the receipt schema."
            : "receipt-after-001.json is missing.",
          evidence: afterReceiptResult && !afterReceiptResult.success ? afterReceiptResult.error.issues : undefined
        }
  );
  addCheck(
    beforeReceipt
      ? {
          id: "before-not-ready",
          status: beforeReceipt.verdict === "NOT READY" ? "PASS" : "WARN",
          detail:
            beforeReceipt.verdict === "NOT READY"
              ? "The proof begins from a NOT READY receipt."
              : "The before receipt is already READY; this is valid evidence but not a fail-to-pass patch loop.",
          evidence: { verdict: beforeReceipt.verdict, score: beforeReceipt.score, violations: beforeReceipt.violations.length }
        }
      : {
          id: "before-not-ready",
          status: "FAIL",
          detail: "Cannot verify the starting verdict without receipt-before-001.json."
        }
  );
  addCheck(
    afterReceipt
      ? {
          id: "after-ready",
          status: afterReceipt.verdict === "READY" ? "PASS" : "FAIL",
          detail:
            afterReceipt.verdict === "READY"
              ? "The proof ends with a READY receipt."
              : "The after receipt is not READY.",
          evidence: { verdict: afterReceipt.verdict, score: afterReceipt.score, violations: afterReceipt.violations.length }
        }
      : {
          id: "after-ready",
          status: "FAIL",
          detail: "Cannot verify the final verdict without receipt-after-001.json."
        }
  );
  addCheck({
    id: "fail-to-pass",
    status: failToPass ? "PASS" : readyWithoutPatch ? "WARN" : "FAIL",
    detail: failToPass
      ? "The proof demonstrates NOT READY -> READY."
      : readyWithoutPatch
        ? "The proof was READY before and after; useful live evidence, but not the flagship patch loop."
        : "The proof does not demonstrate NOT READY -> READY.",
    evidence: {
      before: beforeReceipt ? { verdict: beforeReceipt.verdict, score: beforeReceipt.score } : null,
      after: afterReceipt ? { verdict: afterReceipt.verdict, score: afterReceipt.score } : null
    }
  });
  addCheck({
    id: "mutation-false",
    status: mutation === false ? "PASS" : mutation === true ? "FAIL" : "WARN",
    detail:
      mutation === false
        ? "All available proof summaries declare mutation=false."
        : mutation === true
          ? "At least one proof artifact declares mutation=true."
          : "No mutation field was found in the available proof summaries.",
    evidence: { observed: mutationValues }
  });
  addCheck(
    afterReceipt
      ? {
          id: "evidence-refs-present",
          status: afterReceipt.evidenceRefs.length > 0 ? "PASS" : "FAIL",
          detail:
            afterReceipt.evidenceRefs.length > 0
              ? "The final receipt contains evidence references."
              : "The final receipt has no evidence references.",
          evidence: { evidenceRefs: afterReceipt.evidenceRefs }
        }
      : {
          id: "evidence-refs-present",
          status: "FAIL",
          detail: "Cannot verify evidence refs without receipt-after-001.json."
        }
  );
  addCheck(
    proofType === "live-security"
      ? {
          id: "live-security-summary",
          status:
            stringFromRecord(liveSecurityProofSummary, "status") === "PASS" &&
            stringFromRecord(liveSecurityProofSummary, "readinessStatus") === "READY_FOR_FLAGSHIP_LIVE_SECURITY_PROOF" &&
            readyAfterPatch === true
              ? "PASS"
              : "FAIL",
          detail:
            "The flagship live security summary must be PASS, readiness-green, and ready after patch.",
          evidence: {
            status: stringFromRecord(liveSecurityProofSummary, "status"),
            readinessStatus: stringFromRecord(liveSecurityProofSummary, "readinessStatus"),
            readyAfterPatch
          }
        }
      : {
          id: "live-security-summary",
          status: "WARN",
          detail: "No live-security-proof-summary.json was found; this is not the flagship live security proof."
        }
  );
  addCheck({
    id: "hosted-model-status",
    status:
      hostedModelStatus === "PASS" ||
      hostedModelStatus === "invoked" ||
      hostedModelStatus === "available_not_applicable"
        ? "PASS"
        : hostedModelStatus === "BLOCKED" || !hostedModelStatus
          ? "WARN"
          : "WARN",
    detail:
      hostedModelStatus === "PASS" || hostedModelStatus === "invoked"
        ? "Hosted-model assistance is present in the proof artifacts."
        : hostedModelStatus === "available_not_applicable"
          ? "Hosted-model tools are available, but this proof did not produce SPL violations requiring assistance."
          : hostedModelStatus === "BLOCKED"
            ? "Hosted-model proof is blocked by the current MCP credentials or entitlement."
            : "Hosted-model status was not present in this proof bundle.",
    evidence: { status: hostedModelStatus ?? null }
  });

  return finishProofAudit(input, {
    status: auditStatusFromChecks(checks),
    proofType,
    proofDir: input.outDir,
    mode: contract?.mode,
    mutation,
    failToPass,
    readyAfterPatch,
    readyWithoutPatch,
    proofLoop: proofLoop as ProofLoop | undefined,
    hostedModelStatus,
    checks
  });
};
