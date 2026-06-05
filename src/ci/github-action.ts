import { spawn } from "node:child_process";
import { appendFile, readFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type GitHubActionMode = "judge-proof" | "mcp-transcript" | "external-trace";

export interface GitHubActionInputs {
  mode: GitHubActionMode;
  outDir: string;
  transcript?: string;
  trace?: string;
  agentName: string;
  agentVersion: string;
  requirePass: boolean;
  strictImport: boolean;
}

export interface GitHubActionCommand {
  name: string;
  command: string;
  args: string[];
  cwd: string;
}

export interface GitHubActionPlan {
  mode: GitHubActionMode;
  actionPath: string;
  workspace: string;
  outDir: string;
  commands: GitHubActionCommand[];
  outputs: {
    outDir: string;
    receiptPath: string;
    summaryPath: string;
    diagnosticsPath: string;
  };
}

const allowedModes = new Set<GitHubActionMode>(["judge-proof", "mcp-transcript", "external-trace"]);

const readInput = (env: NodeJS.ProcessEnv, name: string): string | undefined => {
  const value = env[`INPUT_${name.replaceAll("-", "_").toUpperCase()}`];
  return value && value.trim().length > 0 ? value.trim() : undefined;
};

const parseBooleanInput = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`Expected boolean input value "true" or "false", got "${value}".`);
};

const normalizeMode = (value: string | undefined): GitHubActionMode => {
  const mode = value ?? "judge-proof";

  if (allowedModes.has(mode as GitHubActionMode)) {
    return mode as GitHubActionMode;
  }

  throw new Error(`Unsupported SplunkReady action mode "${mode}". Expected judge-proof, mcp-transcript, or external-trace.`);
};

const resolveWorkspacePath = (workspace: string, pathValue: string): string =>
  isAbsolute(pathValue) ? pathValue : resolve(workspace, pathValue);

export const readGitHubActionInputs = (env: NodeJS.ProcessEnv = process.env): GitHubActionInputs => ({
  mode: normalizeMode(readInput(env, "mode")),
  outDir: readInput(env, "out-dir") ?? "artifacts/splunkready-gate",
  transcript: readInput(env, "transcript"),
  trace: readInput(env, "trace"),
  agentName: readInput(env, "agent-name") ?? "External MCP Agent",
  agentVersion: readInput(env, "agent-version") ?? (env.GITHUB_SHA ? `github-${env.GITHUB_SHA.slice(0, 12)}` : "github-action"),
  requirePass: parseBooleanInput(readInput(env, "require-pass"), true),
  strictImport: parseBooleanInput(readInput(env, "strict-import"), true)
});

export const buildGitHubActionPlan = (
  inputs: GitHubActionInputs,
  env: NodeJS.ProcessEnv = process.env
): GitHubActionPlan => {
  const actionPath = resolve(env.SPLUNKREADY_ACTION_PATH ?? env.GITHUB_ACTION_PATH ?? process.cwd());
  const workspace = resolve(env.GITHUB_WORKSPACE ?? actionPath);
  const outDir = resolveWorkspacePath(workspace, inputs.outDir);
  const cliPath = join(actionPath, "dist", "src", "cli.js");
  const command = "node";
  const commands: GitHubActionCommand[] = [];

  if (inputs.mode === "judge-proof") {
    commands.push({
      name: "Run credential-free judge proof",
      command,
      args: [cliPath, "judge-proof", "--out", outDir, "--json"],
      cwd: actionPath
    });
  }

  if (inputs.mode === "mcp-transcript") {
    if (!inputs.transcript) {
      throw new Error("mode=mcp-transcript requires the transcript input.");
    }

    commands.push({
      name: "Certify MCP JSON-RPC transcript",
      command,
      args: [
        cliPath,
        "certify-mcp-transcript",
        "--transcript",
        resolveWorkspacePath(workspace, inputs.transcript),
        "--out",
        outDir,
        "--strict-import",
        String(inputs.strictImport),
        "--require-pass",
        String(inputs.requirePass),
        "--agent-name",
        inputs.agentName,
        "--agent-version",
        inputs.agentVersion,
        "--json"
      ],
      cwd: actionPath
    });
  }

  if (inputs.mode === "external-trace") {
    if (!inputs.trace) {
      throw new Error("mode=external-trace requires the trace input.");
    }

    const tracePath = resolveWorkspacePath(workspace, inputs.trace);
    commands.push(
      {
        name: "Compile fixture contract",
        command,
        args: [cliPath, "compile", "--mode", "fixture", "--out", outDir, "--json"],
        cwd: actionPath
      },
      {
        name: "Grade external trace",
        command,
        args: [
          cliPath,
          "grade-trace",
          "--trace",
          tracePath,
          "--out",
          outDir,
          "--agent-name",
          inputs.agentName,
          "--agent-version",
          inputs.agentVersion,
          "--json"
        ],
        cwd: actionPath
      },
      {
        name: "Audit external trace proof",
        command,
        args: [
          cliPath,
          "proof-audit",
          "--out",
          outDir,
          ...(inputs.requirePass ? ["--require-pass", "true"] : []),
          "--json"
        ],
        cwd: actionPath
      }
    );
  }

  return {
    mode: inputs.mode,
    actionPath,
    workspace,
    outDir,
    commands,
    outputs: {
      outDir,
      receiptPath:
        inputs.mode === "judge-proof"
          ? join(outDir, "suite-proof", "receipt-after-001.json")
          : join(outDir, "receipt-external-001.json"),
      summaryPath:
        inputs.mode === "judge-proof"
          ? join(outDir, "judge-proof-summary.json")
          : inputs.mode === "mcp-transcript"
            ? join(outDir, "mcp-transcript-certification.json")
            : join(outDir, "proof-audit.json"),
      diagnosticsPath:
        inputs.mode === "judge-proof"
          ? join(outDir, "suite-proof", "compiler-diagnostics.json")
          : join(outDir, "readiness-profile.json")
    }
  };
};

const runCommand = (step: GitHubActionCommand): Promise<void> =>
  new Promise((resolveCommand, rejectCommand) => {
    console.log(`\n[SplunkReady] ${step.name}`);
    console.log(`$ ${[step.command, ...step.args].join(" ")}`);

    const child = spawn(step.command, step.args, {
      cwd: step.cwd,
      stdio: "inherit"
    });

    child.on("error", rejectCommand);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolveCommand();
        return;
      }

      rejectCommand(new Error(`${step.name} failed with ${signal ? `signal ${signal}` : `exit code ${code ?? "unknown"}`}.`));
    });
  });

const writeOutputs = async (outputs: GitHubActionPlan["outputs"], outputPath: string | undefined): Promise<void> => {
  if (!outputPath) {
    return;
  }

  await appendFile(
    outputPath,
    `out-dir=${outputs.outDir}\nreceipt-path=${outputs.receiptPath}\nsummary-path=${outputs.summaryPath}\ndiagnostics-path=${outputs.diagnosticsPath}\n`,
    "utf8"
  );
};

const markdownValue = (value: string): string => value.replaceAll("\n", " ").replaceAll("|", "\\|");

const statusFromSummary = async (summaryPath: string): Promise<string | undefined> => {
  try {
    const parsed = JSON.parse(await readFile(summaryPath, "utf8")) as unknown;

    if (parsed && typeof parsed === "object" && "status" in parsed && typeof parsed.status === "string") {
      return parsed.status;
    }
  } catch {
    return undefined;
  }

  return undefined;
};

export const renderGitHubStepSummary = (plan: GitHubActionPlan, status: string | undefined): string => `## SplunkReady Gate

| Field | Value |
|---|---|
| Mode | ${markdownValue(plan.mode)} |
| Status | ${markdownValue(status ?? "not recorded")} |
| Proof directory | \`${markdownValue(plan.outputs.outDir)}\` |
| Receipt | \`${markdownValue(plan.outputs.receiptPath)}\` |
| Summary | \`${markdownValue(plan.outputs.summaryPath)}\` |
| Diagnostics | \`${markdownValue(plan.outputs.diagnosticsPath)}\` |

Deterministic SplunkReady checks decide pass/fail. LLM or hosted-model output is advisory only.
`;

const writeStepSummary = async (plan: GitHubActionPlan, summaryPath: string | undefined): Promise<void> => {
  if (!summaryPath) {
    return;
  }

  const status = await statusFromSummary(plan.outputs.summaryPath);
  await appendFile(summaryPath, renderGitHubStepSummary(plan, status), "utf8");
};

export const runGitHubAction = async (env: NodeJS.ProcessEnv = process.env): Promise<GitHubActionPlan> => {
  const plan = buildGitHubActionPlan(readGitHubActionInputs(env), env);

  for (const commandStep of plan.commands) {
    await runCommand(commandStep);
  }

  await writeOutputs(plan.outputs, env.GITHUB_OUTPUT);
  await writeStepSummary(plan, env.GITHUB_STEP_SUMMARY);
  console.log(`\n[SplunkReady] ${plan.mode} gate complete.`);
  console.log(`[SplunkReady] Proof directory: ${plan.outputs.outDir}`);
  console.log(`[SplunkReady] Summary: ${plan.outputs.summaryPath}`);

  return plan;
};

const isDirectRun = process.argv[1] ? fileURLToPath(import.meta.url) === resolve(process.argv[1]) : false;

if (isDirectRun) {
  runGitHubAction().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
