import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { LlmOutputQualityReport } from "../agents/llm-output-quality.js";
import { readinessReceiptSchema, type EnvironmentContract } from "../schemas/core.js";

export type LlmProofStatus = "PASS" | "WARN" | "FAIL";

interface ProofAuditReport {
  status: LlmProofStatus;
  proofType: "live-security" | "live" | "receipt" | "firewall-block" | "suite" | "external-trace" | "unknown";
}

export interface LlmProofSummary {
  source: "splunkready-llm-proof";
  status: LlmProofStatus;
  mode: EnvironmentContract["mode"];
  mutation: false;
  generatedAt: string;
  agent: {
    name: string;
    version: string;
  };
  llmRole: "trace-producer";
  passFailAuthority: "deterministic-rule-engine";
  before: {
    verdict: string;
    score: number;
    violations: number;
  };
  after: {
    verdict: string;
    score: number;
    violations: number;
  };
  audit: {
    status: LlmProofStatus;
    proofType: ProofAuditReport["proofType"];
  };
  llmOutputQuality?: {
    before?: LlmOutputQualityReport;
    after?: LlmOutputQualityReport;
  };
  artifacts: string[];
}

export interface LlmProofWorkflowInput {
  outDir: string;
  mode: EnvironmentContract["mode"];
  requirePass: boolean;
  generatedAt: string;
}

export interface LlmProofWorkflowSteps {
  compile(): Promise<string[]>;
  evaluate(): Promise<string[]>;
  receiptBefore(): Promise<string[]>;
  rerunAfter(): Promise<string[]>;
  proofAudit(): Promise<string[]>;
}

const readJson = async <T>(filePath: string, label: string): Promise<T> => {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(`Unable to read ${label} at ${filePath}: ${message}`);
  }
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const readOptionalJson = async <T>(filePath: string): Promise<T | undefined> => {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return undefined;
  }
};

const llmOutputQualitySummary = async (
  outDir: string
): Promise<LlmProofSummary["llmOutputQuality"] | undefined> => {
  const before = await readOptionalJson<{ outputQuality: LlmOutputQualityReport }>(
    join(outDir, "llm-deliberation-before.json")
  );
  const after = await readOptionalJson<{ outputQuality: LlmOutputQualityReport }>(
    join(outDir, "llm-deliberation-after.json")
  );

  if (!before && !after) {
    return undefined;
  }

  return {
    ...(before ? { before: before.outputQuality } : {}),
    ...(after ? { after: after.outputQuality } : {})
  };
};

export const runLlmProofWorkflow = async (
  input: LlmProofWorkflowInput,
  steps: LlmProofWorkflowSteps
): Promise<{ artifacts: string[]; summary: LlmProofSummary }> => {
  const compileArtifacts = await steps.compile();
  const evaluateArtifacts = await steps.evaluate();
  const receiptArtifacts = await steps.receiptBefore();
  const rerunArtifacts = await steps.rerunAfter();
  const auditArtifacts = await steps.proofAudit();
  const beforeReceipt = readinessReceiptSchema.parse(
    await readJson(join(input.outDir, "receipt-before-001.json"), "before receipt")
  );
  const afterReceipt = readinessReceiptSchema.parse(await readJson(join(input.outDir, "receipt-after-001.json"), "after receipt"));
  const audit = await readJson<ProofAuditReport>(join(input.outDir, "proof-audit.json"), "proof audit");
  const llmOutputQuality = await llmOutputQualitySummary(input.outDir);
  const status: LlmProofStatus =
    audit.status !== "FAIL" &&
    beforeReceipt.verdict === "NOT READY" &&
    afterReceipt.verdict === "READY" &&
    afterReceipt.agent.name === "Gemini Splunk MCP Agent"
      ? "PASS"
      : "FAIL";
  const summaryPath = join(input.outDir, "llm-proof-summary.json");
  const artifacts = [
    ...new Set([...compileArtifacts, ...evaluateArtifacts, ...receiptArtifacts, ...rerunArtifacts, ...auditArtifacts, summaryPath])
  ];
  const summary: LlmProofSummary = {
    source: "splunkready-llm-proof",
    status,
    mode: input.mode,
    mutation: false,
    generatedAt: input.generatedAt,
    agent: afterReceipt.agent,
    llmRole: "trace-producer",
    passFailAuthority: "deterministic-rule-engine",
    before: {
      verdict: beforeReceipt.verdict,
      score: beforeReceipt.score,
      violations: beforeReceipt.violations.length
    },
    after: {
      verdict: afterReceipt.verdict,
      score: afterReceipt.score,
      violations: afterReceipt.violations.length
    },
    audit: {
      status: audit.status,
      proofType: audit.proofType
    },
    ...(llmOutputQuality ? { llmOutputQuality } : {}),
    artifacts
  };

  await writeJson(summaryPath, summary);

  if (input.requirePass && status !== "PASS") {
    throw new Error(`llm-proof strict gate failed with ${status}. Inspect ${summaryPath}.`);
  }

  return { artifacts, summary };
};
