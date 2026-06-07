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
import { runCliCommand } from "./cli/dispatch.js";
import { runFixtureCertificationWorkflow } from "./workflows/fixture-certification.js";
import {
  runFirewallCheckWorkflow,
  runPolicyBackedRerunWorkflow
} from "./workflows/policy-actions.js";
import { startStdioMcpServer } from "./mcp/server.js";
import { startStdioMockSplunkMcpServer } from "./mock-splunk-mcp/server.js";
export {
  runHostedModelDiagnosticFromCli,
  runHostedModelProofFromCli,
  runCertificationIndexFromCli,
  runVerifyManifestFromCli
} from "./cli/proof-commands.js";
export {
  runLiveCandidatesFromCli,
  runLiveSecurityKitFromCli,
  runLiveSecurityProofFromCli,
  runLiveSecurityReadinessFromCli,
  runLiveSmokeFromCli
} from "./cli/live-commands.js";

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

const main = async (): Promise<void> => {
  const { command, options: parsedOptions } = parseArgs(process.argv.slice(2));
  if (command === "mcp") {
    startStdioMcpServer();
    return;
  }

  const options = await resolveCliInputPaths(parsedOptions);
  if (command === "mock-splunk-mcp") {
    await startStdioMockSplunkMcpServer({ fixturePath: options.fixture });
    return;
  }

  const output = await runCliCommand(command, options);

  if (!output) {
    console.log(usage);
    return;
  }

  printCliOutput(output, options);
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
