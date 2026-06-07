import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createGeminiConfigFromEnv } from "../agents/gemini-model.js";
import { mergeEnvFile } from "./env-file.js";
import type { CliOptions } from "./options.js";
import {
  compileCommand,
  evaluateCommand,
  firewallCheckCommand,
  receiptCommand,
  rerunCommand
} from "../workflows/certification-actions.js";
import {
  runCertificationIndexWorkflow,
  writeCertificationIndex,
  type CertificationIndexWorkflowInput,
  type CertificationIndexWorkflowResult
} from "../workflows/certification-index.js";
import {
  runHostedModelDiagnosticWorkflow,
  runHostedModelProofWorkflow,
  type HostedModelWorkflowInput,
  type HostedModelWorkflowResult
} from "../workflows/hosted-model-actions.js";
import { runJudgeProofWorkflow } from "../workflows/judge-proof.js";
import { runLlmProofWorkflow } from "../workflows/llm-proof.js";
import {
  runManifestVerificationWorkflow,
  type ManifestVerificationWorkflowInput,
  type ManifestVerificationWorkflowResult
} from "../workflows/manifest-verification.js";
import { runMcpProofWorkflow } from "../workflows/mcp-proof.js";
import { runProofAuditWorkflow } from "../workflows/proof-audit.js";
import { runSuiteProofWorkflow } from "../workflows/suite-proof.js";

const compiledAt = "2026-06-01T06:45:00.000Z";

export const proofAuditCommand = async (options: CliOptions): Promise<string[]> => {
  const result = await runProofAuditWorkflow({
    outDir: options.out,
    requirePass: options.requirePass,
    generatedAt: compiledAt
  });

  return result.artifacts;
};

const proofDirsFromOptions = (options: CliOptions): string[] =>
  options.proofDirs
    .split(",")
    .map((proofDir) => proofDir.trim())
    .filter((proofDir) => proofDir.length > 0);

export const verifyManifestCommand = async (options: CliOptions): Promise<string[]> => {
  const result = await runManifestVerificationWorkflow({ outDir: options.out, generatedAt: compiledAt });
  const [reportPath] = result.artifacts;

  if (result.status !== "PASS") {
    throw new Error(`verify-manifest failed with ${result.status}. Inspect ${reportPath}.`);
  }

  return result.artifacts;
};

export const certificationIndexCommand = async (options: CliOptions): Promise<string[]> => {
  const proofDirs = proofDirsFromOptions(options);
  const { artifacts } = await writeCertificationIndex({
    outDir: options.out,
    proofDirs,
    requirePass: options.requirePass,
    generatedAt: compiledAt,
    verifyInputs: false
  });

  return artifacts;
};

export const suiteProofCommand = async (
  options: CliOptions,
  env: NodeJS.ProcessEnv = process.env
): Promise<string[]> => {
  const result = await runSuiteProofWorkflow(
    {
      mode: options.mode,
      suitePath: options.suite,
      outDir: options.out,
      requireFailToPass: options.requireFailToPass,
      generatedAt: compiledAt
    },
    {
      compile: ({ missionPath, outDir }) => compileCommand({ ...options, mission: missionPath, out: outDir, mode: "fixture" }, env),
      evaluate: ({ missionPath, outDir }) => evaluateCommand({ ...options, mission: missionPath, out: outDir, mode: "fixture" }, env),
      receiptBefore: ({ missionPath, outDir }) => receiptCommand({ ...options, mission: missionPath, out: outDir, mode: "fixture" }, env),
      rerun: ({ missionPath, outDir }) => rerunCommand({ ...options, mission: missionPath, out: outDir, mode: "fixture" }, env),
      receiptAfter: ({ missionPath, outDir }) =>
        receiptCommand({ ...options, mission: missionPath, out: outDir, mode: "fixture", phase: "after" }, env)
    }
  );

  return result.artifacts;
};

export const llmProofCommand = async (
  options: CliOptions,
  env: NodeJS.ProcessEnv = process.env
): Promise<string[]> => {
  const llmEnv = { ...env, SPLUNKREADY_LLM_ENABLED: "true" };
  const geminiConfig = createGeminiConfigFromEnv(llmEnv);

  if (!geminiConfig) {
    throw new Error("llm-proof requires GEMINI_API_KEY. No Gemini request was made and no Splunk calls were made.");
  }

  const beforeOptions: CliOptions = { ...options, phase: "before" };
  const afterOptions: CliOptions = { ...options, phase: "after" };
  const result = await runLlmProofWorkflow(
    {
      outDir: options.out,
      mode: options.mode,
      requirePass: options.requirePass,
      generatedAt: compiledAt
    },
    {
      compile: () => compileCommand(options, llmEnv),
      evaluate: () => evaluateCommand(options, llmEnv),
      receiptBefore: () => receiptCommand(beforeOptions, llmEnv),
      rerunAfter: () => rerunCommand(afterOptions, llmEnv),
      proofAudit: () => proofAuditCommand({ ...options, requirePass: false })
    }
  );

  return result.artifacts;
};

export const hostedModelProofCommand = async (
  options: CliOptions,
  env: NodeJS.ProcessEnv = process.env
): Promise<HostedModelWorkflowResult> => {
  const hostedModelEnv = await mergeEnvFile(env, options.envFile);
  return runHostedModelProofWorkflow(
    {
      outDir: options.out,
      mode: options.mode,
      fixturePath: options.fixture,
      missionPath: options.mission
    },
    hostedModelEnv
  );
};

export const hostedModelDiagnosticCommand = async (
  options: CliOptions,
  env: NodeJS.ProcessEnv = process.env
): Promise<HostedModelWorkflowResult> => {
  const hostedModelEnv = await mergeEnvFile(env, options.envFile);
  return runHostedModelDiagnosticWorkflow(
    {
      outDir: options.out,
      mode: options.mode,
      fixturePath: options.fixture,
      missionPath: options.mission,
      requirePass: options.requirePass
    },
    hostedModelEnv
  );
};

export const judgeProofCommand = async (
  options: CliOptions,
  env: NodeJS.ProcessEnv = process.env
): Promise<string[]> => {
  if (options.mode !== "fixture") {
    throw new Error("judge-proof is fixture-only; use live-security-proof for operator-owned live Splunk evidence.");
  }

  const llmEnv = { ...env, SPLUNKREADY_LLM_ENABLED: "true" };
  const fixtureEnv = { ...env, SPLUNKREADY_LLM_ENABLED: "false" };
  const llmProofRequested = options.includeLlmProof;
  const llmProofEnabledByEnv = env.SPLUNKREADY_LLM_ENABLED === "true";
  const llmProofConfigured = createGeminiConfigFromEnv(llmEnv) !== null;
  const result = await runJudgeProofWorkflow(
    {
      outDir: options.out,
      generatedAt: compiledAt,
      includeLlmProof: llmProofRequested || llmProofEnabledByEnv,
      llmProofRequested,
      llmProofEnabledByEnv,
      llmProofConfigured
    },
    {
      suiteProof: (outDir) => suiteProofCommand({ ...options, out: outDir, mode: "fixture", requireFailToPass: true }, fixtureEnv),
      suiteAudit: (outDir) => proofAuditCommand({ ...options, out: outDir, requirePass: true }),
      suiteManifest: (outDir) => verifyManifestCommand({ ...options, out: outDir }),
      firewallCheck: (outDir) => firewallCheckCommand({ ...options, out: outDir, mode: "fixture", requirePass: true }, fixtureEnv),
      firewallManifest: (outDir) => verifyManifestCommand({ ...options, out: outDir }),
      certificationIndex: ({ proofDirs }) =>
        certificationIndexCommand({
          ...options,
          proofDirs: proofDirs.join(","),
          requirePass: true
        }),
      llmProof: (outDir) => llmProofCommand({ ...options, out: outDir, mode: "fixture", requirePass: true }, env)
    }
  );

  if (result.summary.status !== "PASS") {
    throw new Error(`judge-proof failed with ${result.summary.status}. Inspect ${join(options.out, "judge-proof-summary.json")}.`);
  }

  return result.artifacts;
};

export const mcpProofCommand = async (options: CliOptions): Promise<string[]> => {
  const cliModuleDir = dirname(fileURLToPath(import.meta.url));
  const result = await runMcpProofWorkflow({
    outDir: options.out,
    serverPath: join(cliModuleDir, "..", "mcp", "server.js"),
    transcriptPath: options.transcript || undefined
  });

  if (options.requirePass && result.status !== "PASS") {
    throw new Error(`mcp-proof strict gate failed with ${result.status}. Inspect ${join(options.out, "mcp-proof-summary.json")}.`);
  }

  return result.artifacts;
};

export const runVerifyManifestFromCli = async (
  input: ManifestVerificationWorkflowInput
): Promise<ManifestVerificationWorkflowResult> => {
  return runManifestVerificationWorkflow({ ...input, generatedAt: input.generatedAt ?? compiledAt });
};

export const runCertificationIndexFromCli = async (
  input: CertificationIndexWorkflowInput
): Promise<CertificationIndexWorkflowResult> => {
  return runCertificationIndexWorkflow({
    ...input,
    requirePass: input.requirePass ?? false,
    generatedAt: input.generatedAt ?? compiledAt,
    verifyInputs: input.verifyInputs ?? true
  });
};

export const runHostedModelDiagnosticFromCli = async (
  input: HostedModelWorkflowInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<HostedModelWorkflowResult> => {
  return runHostedModelDiagnosticWorkflow({ ...input, mode: input.mode ?? "live", requirePass: false }, env);
};

export const runHostedModelProofFromCli = async (
  input: HostedModelWorkflowInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<HostedModelWorkflowResult> => {
  return runHostedModelProofWorkflow({ ...input, mode: input.mode ?? "live" }, env);
};
