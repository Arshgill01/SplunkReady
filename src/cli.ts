#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { stat } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  parseArgs,
  usage,
  type CliOptions,
  type CliOutput
} from "./cli/options.js";
import {
  certifyMcpTranscriptCommand,
  demoCommand,
  gradeTraceCommand,
  importMcpTranscriptCommand,
  llmAgentCommand
} from "./cli/external-commands.js";
import {
  certificationIndexCommand,
  hostedModelDiagnosticCommand,
  hostedModelProofCommand,
  judgeProofCommand,
  llmProofCommand,
  mcpProofCommand,
  proofAuditCommand,
  suiteProofCommand,
  verifyManifestCommand
} from "./cli/proof-commands.js";
import {
  compileCommand,
  evaluateCommand,
  firewallCheckCommand,
  receiptCommand,
  rerunCommand
} from "./workflows/certification-actions.js";
import { runFixtureCertificationWorkflow } from "./workflows/fixture-certification.js";
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
import {
  runHostedModelDiagnosticWorkflow,
  runHostedModelProofWorkflow,
  type HostedModelWorkflowInput,
  type HostedModelWorkflowResult
} from "./workflows/hosted-model-actions.js";
import {
  runFirewallCheckWorkflow,
  runPolicyBackedRerunWorkflow
} from "./workflows/policy-actions.js";
export {
  runCertificationIndexFromCli,
  runVerifyManifestFromCli
} from "./cli/proof-commands.js";

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
