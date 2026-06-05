#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { stat } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createGeminiConfigFromEnv } from "./agents/gemini-model.js";
import {
  parseArgs,
  usage,
  type CliOptions,
  type CliOutput
} from "./cli/options.js";
import { validateLiveSecurityKit } from "./live-security-kit/validator.js";
import {
  compileCommand,
  compileContract,
  createSplunkAccessAdapter,
  evaluateCommand,
  firewallCheckCommand,
  fixtureCertificationSteps,
  gradeTrace,
  llmEnabled,
  loadContract,
  receiptCommand,
  rerunCommand,
  writeCompiledArtifacts
} from "./workflows/certification-actions.js";
import {
  writeCertificationIndex,
  runCertificationIndexWorkflow,
  type CertificationIndexWorkflowInput,
  type CertificationIndexWorkflowResult
} from "./workflows/certification-index.js";
import {
  runExternalTraceCertificationFromPathWorkflow,
  runGradeExternalTraceWorkflow,
  runImportMcpTranscriptWorkflow,
  runMcpTranscriptCertificationFromPathWorkflow
} from "./workflows/external-certification.js";
import {
  runFixtureCertification,
  runFixtureCertificationWorkflow
} from "./workflows/fixture-certification.js";
import type {
  LiveActionWorkflowInput,
  LiveActionWorkflowResult
} from "./workflows/live-actions.js";
import {
  runLiveCandidatesWorkflow,
  runLiveProofWorkflow,
  runLiveSecurityKitWorkflow,
  runLiveSecurityProofArtifacts,
  runLiveSecurityProofWorkflow,
  runLiveSecurityReadinessWorkflow,
  runLiveSecurityUiBundleWorkflow,
  runLiveSmokeWorkflow
} from "./workflows/live-actions.js";
import { runLlmProofWorkflow } from "./workflows/llm-proof.js";
import {
  runHostedModelDiagnosticWorkflow,
  runHostedModelProofWorkflow,
  type HostedModelWorkflowInput,
  type HostedModelWorkflowResult
} from "./workflows/hosted-model-actions.js";
import { runLlmAgentWorkflow } from "./workflows/llm-agent.js";
import { runJudgeProofWorkflow } from "./workflows/judge-proof.js";
import {
  runManifestVerificationWorkflow,
  type ManifestVerificationWorkflowInput,
  type ManifestVerificationWorkflowResult
} from "./workflows/manifest-verification.js";
import { runMcpProofWorkflow } from "./workflows/mcp-proof.js";
import { runProofAuditWorkflow } from "./workflows/proof-audit.js";
import {
  runFirewallCheckWorkflow,
  runPolicyBackedRerunWorkflow
} from "./workflows/policy-actions.js";
import { runSuiteProofWorkflow } from "./workflows/suite-proof.js";

const compiledAt = "2026-06-01T06:45:00.000Z";

const printCliOutput = (output: CliOutput, options: CliOptions): void => {
  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log(`${output.status} ${output.command}`);
  for (const message of output.messages ?? []) {
    console.log(message);
  }
  for (const artifact of output.artifacts) {
    console.log(`artifact ${artifact}`);
  }
};

const exists = async (filePath: string): Promise<boolean> =>
  stat(filePath)
    .then(() => true)
    .catch(() => false);

const resolveBundledInputPath = async (inputPath: string): Promise<string> => {
  if (!inputPath || isAbsolute(inputPath) || (await exists(inputPath))) {
    return inputPath;
  }

  let currentDir = dirname(fileURLToPath(import.meta.url));

  while (true) {
    const candidatePath = join(currentDir, inputPath);

    if (await exists(candidatePath)) {
      return candidatePath;
    }

    const parentDir = dirname(currentDir);

    if (parentDir === currentDir) {
      return inputPath;
    }

    currentDir = parentDir;
  }
};

const resolveCliInputPaths = async (options: CliOptions): Promise<CliOptions> => ({
  ...options,
  fixture: await resolveBundledInputPath(options.fixture),
  mission: await resolveBundledInputPath(options.mission),
  suite: await resolveBundledInputPath(options.suite),
  trace: options.trace ? await resolveBundledInputPath(options.trace) : options.trace,
  transcript: options.transcript ? await resolveBundledInputPath(options.transcript) : options.transcript
});

const gradeTraceCommand = async (options: CliOptions): Promise<string[]> => {
  const { artifacts } = await runGradeExternalTraceWorkflow({
    outDir: options.out,
    tracePath: options.trace,
    missionPath: options.mission,
    agentName: options.agentName,
    agentVersion: options.agentVersion
  });

  return artifacts;
};

const importMcpTranscriptCommand = async (options: CliOptions): Promise<string[]> => {
  const { artifacts } = await runImportMcpTranscriptWorkflow({
    outDir: options.out,
    transcriptPath: options.transcript,
    missionPath: options.mission,
    strictImport: options.strictImport,
    agentName: options.agentName,
    agentVersion: options.agentVersion
  });

  return artifacts;
};

const certifyMcpTranscriptCommand = async (options: CliOptions, env: NodeJS.ProcessEnv = process.env): Promise<string[]> => {
  void env;
  const { artifacts } = await runMcpTranscriptCertificationFromPathWorkflow({
    outDir: options.out,
    transcriptPath: options.transcript,
    fixturePath: options.fixture,
    missionPath: options.mission,
    strictImport: options.strictImport,
    requirePass: options.requirePass,
    agentName: options.agentName,
    agentVersion: options.agentVersion
  });

  return artifacts;
};

const llmAgentCommand = async (
  options: CliOptions,
  env: NodeJS.ProcessEnv = process.env
): Promise<string[]> => {
  const { artifacts } = await runLlmAgentWorkflow(options, env);

  return artifacts;
};

const llmProofCommand = async (
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

const hostedModelProofCommand = async (
  options: CliOptions,
  env: NodeJS.ProcessEnv = process.env
): Promise<string[]> => {
  const result = await runHostedModelProofWorkflow({
    outDir: options.out,
    mode: options.mode,
    fixturePath: options.fixture,
    missionPath: options.mission
  }, env);

  return result.artifacts;
};

const hostedModelDiagnosticCommand = async (
  options: CliOptions,
  env: NodeJS.ProcessEnv = process.env
): Promise<string[]> => {
  const result = await runHostedModelDiagnosticWorkflow({
    outDir: options.out,
    mode: options.mode,
    fixturePath: options.fixture,
    missionPath: options.mission,
    requirePass: options.requirePass
  }, env);

  return result.artifacts;
};

const proofAuditCommand = async (options: CliOptions): Promise<string[]> => {
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

const verifyManifestCommand = async (options: CliOptions): Promise<string[]> => {
  const result = await runManifestVerificationWorkflow({ outDir: options.out, generatedAt: compiledAt });
  const [reportPath] = result.artifacts;

  if (result.status !== "PASS") {
    throw new Error(`verify-manifest failed with ${result.status}. Inspect ${reportPath}.`);
  }

  return result.artifacts;
};

const certificationIndexCommand = async (options: CliOptions): Promise<string[]> => {
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

const suiteProofCommand = async (options: CliOptions, env: NodeJS.ProcessEnv = process.env): Promise<string[]> => {
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

const judgeProofCommand = async (options: CliOptions, env: NodeJS.ProcessEnv = process.env): Promise<string[]> => {
  if (options.mode !== "fixture") {
    throw new Error("judge-proof is fixture-only; use live-security-proof for operator-owned live Splunk evidence.");
  }

  const suiteDir = join(options.out, "suite-proof");
  const firewallDir = join(options.out, "firewall-check");
  const llmEnv = { ...env, SPLUNKREADY_LLM_ENABLED: "true" };
  const result = await runJudgeProofWorkflow(
    {
      outDir: options.out,
      generatedAt: compiledAt,
      includeLlmProof: options.includeLlmProof,
      llmProofConfigured: createGeminiConfigFromEnv(llmEnv) !== null
    },
    {
      suiteProof: (outDir) => suiteProofCommand({ ...options, out: outDir, mode: "fixture", requireFailToPass: true }, env),
      suiteAudit: (outDir) => proofAuditCommand({ ...options, out: outDir, requirePass: true }),
      suiteManifest: (outDir) => verifyManifestCommand({ ...options, out: outDir }),
      firewallCheck: (outDir) => firewallCheckCommand({ ...options, out: outDir, mode: "fixture", requirePass: true }, env),
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

const mcpProofCommand = async (options: CliOptions): Promise<string[]> => {
  const cliDir = dirname(fileURLToPath(import.meta.url));
  const result = await runMcpProofWorkflow({
    outDir: options.out,
    serverPath: join(cliDir, "mcp", "server.js"),
    transcriptPath: options.transcript || undefined
  });

  if (options.requirePass && result.status !== "PASS") {
    throw new Error(`mcp-proof strict gate failed with ${result.status}. Inspect ${join(options.out, "mcp-proof-summary.json")}.`);
  }

  return result.artifacts;
};

const demoCommand = async (options: CliOptions, env: NodeJS.ProcessEnv = process.env): Promise<string[]> => {
  const workflow = await runFixtureCertification(
    { outDir: options.out, includeProofAudit: false },
    fixtureCertificationSteps(options, env)
  );

  return workflow.artifacts;
};

export const runFixtureCertificationFromCli = runFixtureCertificationWorkflow;

export const runPolicyBackedRerunFromCli = runPolicyBackedRerunWorkflow;

export const runFirewallCheckFromCli = runFirewallCheckWorkflow;

export const runLiveSmokeFromCli = async (
  input: LiveActionWorkflowInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<LiveActionWorkflowResult> => {
  return runLiveSmokeWorkflow({ ...input, requireLive: input.requireLive ?? true }, env);
};

export const runLiveCandidatesFromCli = async (
  input: LiveActionWorkflowInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<LiveActionWorkflowResult> => {
  return runLiveCandidatesWorkflow({ ...input, compileFirst: input.compileFirst ?? true }, env);
};

export const runLiveSecurityReadinessFromCli = async (
  input: LiveActionWorkflowInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<LiveActionWorkflowResult> => {
  return runLiveSecurityReadinessWorkflow(input, env);
};

export const runLiveSecurityKitFromCli = async (
  input: LiveActionWorkflowInput
): Promise<LiveActionWorkflowResult> => {
  return runLiveSecurityKitWorkflow(input);
};

export const runLiveSecurityProofFromCli = async (
  input: LiveActionWorkflowInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<LiveActionWorkflowResult> => {
  return runLiveSecurityProofWorkflow({ ...input, requirePass: input.requirePass ?? true }, env);
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

const main = async (): Promise<void> => {
  const { command, options: parsedOptions } = parseArgs(process.argv.slice(2));
  const options = await resolveCliInputPaths(parsedOptions);
  let artifacts: string[];

  if (command === "help" || command === "--help" || command === "-h") {
    console.log(usage);
    return;
  }

  if (command === "live-smoke") {
    const result = await runLiveSmokeWorkflow({
      outDir: options.out,
      fixturePath: options.fixture,
      missionPath: options.mission,
      requireLive: options.requireLive
    });
    printCliOutput({ command, status: result.status, artifacts: result.artifacts, messages: result.messages }, options);
    return;
  }

  if (command === "compile") {
    artifacts = await compileCommand(options);
  } else if (command === "evaluate") {
    artifacts = await evaluateCommand(options);
  } else if (command === "firewall-check") {
    artifacts = await firewallCheckCommand(options);
  } else if (command === "import-mcp-transcript") {
    artifacts = await importMcpTranscriptCommand(options);
  } else if (command === "grade-trace") {
    artifacts = await gradeTraceCommand(options);
  } else if (command === "certify-mcp-transcript") {
    artifacts = await certifyMcpTranscriptCommand(options);
  } else if (command === "llm-agent") {
    artifacts = await llmAgentCommand(options);
  } else if (command === "llm-proof") {
    artifacts = await llmProofCommand(options);
  } else if (command === "hosted-model-proof") {
    artifacts = await hostedModelProofCommand(options);
  } else if (command === "hosted-model-diagnostic") {
    artifacts = await hostedModelDiagnosticCommand(options);
  } else if (command === "proof-audit") {
    artifacts = await proofAuditCommand(options);
  } else if (command === "verify-manifest") {
    artifacts = await verifyManifestCommand(options);
  } else if (command === "certification-index") {
    artifacts = await certificationIndexCommand(options);
  } else if (command === "judge-proof") {
    artifacts = await judgeProofCommand(options);
  } else if (command === "mcp-proof") {
    artifacts = await mcpProofCommand(options);
  } else if (command === "live-candidates") {
    artifacts = (
      await runLiveCandidatesWorkflow({
        outDir: options.out,
        fixturePath: options.fixture,
        missionPath: options.mission,
        candidateLimit: options.candidateLimit,
        compileFirst: false,
        firewall: options.firewall,
        agentModel: options.agentModel
      })
    ).artifacts;
  } else if (command === "live-security-check") {
    artifacts = (
      await runLiveSecurityReadinessWorkflow({
        outDir: options.out,
        fixturePath: options.fixture,
        missionPath: options.mission,
        firewall: options.firewall,
        agentModel: options.agentModel
      })
    ).artifacts;
  } else if (command === "live-security-kit") {
    artifacts = (await runLiveSecurityKitWorkflow({ outDir: options.out })).artifacts;
  } else if (command === "live-security-proof") {
    artifacts = await runLiveSecurityProofArtifacts({
      outDir: options.out,
      fixturePath: options.fixture,
      missionPath: options.mission,
      firewall: options.firewall,
      agentModel: options.agentModel,
      requirePass: options.requirePass
    });
  } else if (command === "live-security-ui-bundle") {
    artifacts = (
      await runLiveSecurityUiBundleWorkflow({
        outDir: options.out,
        proofDir: options.proofDir,
        securityCheckDir: options.securityCheckDir,
        securityKitDir: options.securityKitDir,
        hostedModelProofDir: options.hostedModelProofDir
      })
    ).artifacts;
  } else if (command === "live-proof") {
    artifacts = (
      await runLiveProofWorkflow({
        outDir: options.out,
        fixturePath: options.fixture,
        missionPath: options.mission,
        candidateLimit: options.candidateLimit,
        firewall: options.firewall,
        agentModel: options.agentModel,
        requirePass: options.requirePass
      })
    ).artifacts;
  } else if (command === "suite-proof") {
    artifacts = await suiteProofCommand(options);
  } else if (command === "receipt") {
    artifacts = await receiptCommand(options);
  } else if (command === "rerun") {
    artifacts = await rerunCommand(options);
  } else if (command === "demo") {
    artifacts = await demoCommand(options);
  } else {
    throw new Error(`Unknown command ${command}.\n${usage}`);
  }

  printCliOutput({ command, status: "PASS", artifacts }, options);
};

const formatCliError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const input = error as {
      name?: unknown;
      code?: unknown;
      message?: unknown;
      context?: { toolName?: unknown };
      cause?: unknown;
    };

    if (input.name === "SplunkAdapterError") {
      const code = typeof input.code === "string" ? input.code : "SPLUNK_ADAPTER_ERROR";
      const message = typeof input.message === "string" ? input.message : "Splunk adapter failed.";
      const toolName = typeof input.context?.toolName === "string" ? input.context.toolName : "unknown_tool";
      const causeMessage =
        input.cause instanceof Error
          ? ` Cause: ${input.cause.message}`
          : input.cause && typeof input.cause === "object" && "message" in input.cause
            ? ` Cause: ${String((input.cause as { message: unknown }).message)}`
            : "";

      return `${code} while calling ${toolName}: ${message}${causeMessage}`;
    }
  }

  return String(error);
};

const isCliEntrypoint = (): boolean => {
  if (!process.argv[1]) {
    return false;
  }

  const currentPath = fileURLToPath(import.meta.url);

  try {
    return currentPath === realpathSync(process.argv[1]);
  } catch {
    return import.meta.url === pathToFileURL(process.argv[1]).href;
  }
};

if (isCliEntrypoint()) {
  main().catch((error: unknown) => {
    const formattedError = formatCliError(error);

    if (process.argv.includes("--json")) {
      console.error(
        JSON.stringify(
          {
            command: process.argv[2] ?? "help",
            status: "FAIL",
            artifacts: [],
            error: formattedError
          } satisfies CliOutput,
          null,
          2
        )
      );
      process.exitCode = 1;
      return;
    }

    console.error(formattedError);
    process.exitCode = 1;
  });
}
