import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { createFixtureSplunkAccessAdapter, loadFixtureSplunkDatasetFromFile } from "../adapters/fixture.js";
import {
  createHttpLiveSplunkTransport,
  createLiveSplunkAccessAdapter,
  createLiveSplunkAdapterConfigFromEnv
} from "../adapters/live.js";
import type { SplunkAccessAdapter } from "../adapters/splunk-access.js";
import { compileEnvironmentContract } from "../compiler/environment.js";
import { compileReadinessProfile } from "../compiler/readiness-profile.js";
import { parseMissionDefinition } from "../missions/dsl.js";
import { compileAgentPolicy } from "../policy/compiler.js";
import type { EnvironmentContract, ReadOnlySplunkToolName } from "../schemas/core.js";
import { redactText } from "../workbench/redaction.js";

export type HostedModelWorkflow = "hosted-model-diagnostic" | "hosted-model-proof";

export interface HostedModelWorkflowInput {
  outDir: string;
  mode?: "fixture" | "live";
  fixturePath?: string;
  missionPath?: string;
  requirePass?: boolean;
}

export interface HostedModelWorkflowResult {
  status: "PASS" | "BLOCKED";
  outDir: string;
  artifacts: string[];
  mutation: false;
  messages: string[];
}

export interface HostedModelSetupVariable {
  name: string;
  status: "set" | "missing" | "invalid";
  requiredValue: string;
  purpose: string;
}

export interface HostedModelSetup {
  source: "splunkready-live-hosted-model-preflight";
  configured: boolean;
  requiredEnvironment: HostedModelSetupVariable[];
  optionalEnvironment: HostedModelSetupVariable[];
  operatorCommand: string;
  secretHandling: string;
}

export const hostedModelToolNames: ReadOnlySplunkToolName[] = [
  "saia_generate_spl",
  "saia_explain_spl",
  "saia_optimize_spl",
  "saia_ask_splunk_question"
];

const defaultFixturePath = "fixtures/acme-soc-dev/adapter-fixture.json";
const defaultMissionPath = "fixtures/acme-soc-dev/missions/security-investigation-readiness.json";
const generatedAt = "2026-06-01T06:30:00.000Z";
const compiledAt = "2026-06-01T06:45:00.000Z";
const hostedModelProofQuery = "search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now";
const hostedModelGenerationPrompt =
  "Generate read-only SPL for investigating lateral movement involving host win-finance-07 in the authorized Windows security index.";
const hostedModelQuestion =
  "Why should a Splunk-connected agent prefer authorized indexes and saved-search provenance when investigating lateral movement?";
const hostedModelDiagnosticCommand =
  "splunkready hosted-model-diagnostic --mode live --out artifacts/hosted-model-diagnostic --require-pass true --json";

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const readJson = async <T>(filePath: string, label: string): Promise<T> => {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    throw new Error(`Unable to read ${label} at ${filePath}. Run the prerequisite CLI command first.`);
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringFromRecord = (value: unknown, key: string): string | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const field = value[key];
  return typeof field === "string" ? field : undefined;
};

const envVariableStatus = (
  env: NodeJS.ProcessEnv,
  name: string,
  isValid: (value: string) => boolean = (value) => value.length > 0
): "set" | "missing" | "invalid" => {
  const value = env[name];

  if (!value) {
    return "missing";
  }

  return isValid(value) ? "set" : "invalid";
};

const liveHostedModelSetupFromEnv = (env: NodeJS.ProcessEnv): HostedModelSetup => {
  const requiredEnvironment: HostedModelSetupVariable[] = [
    {
      name: "SPLUNKREADY_LIVE_ENABLED",
      status: envVariableStatus(env, "SPLUNKREADY_LIVE_ENABLED", (value) => value === "true"),
      requiredValue: "true",
      purpose: "Enables the read-only live Splunk adapter."
    },
    {
      name: "SPLUNKREADY_SPLUNK_MCP_URL",
      status: envVariableStatus(env, "SPLUNKREADY_SPLUNK_MCP_URL"),
      requiredValue: "set",
      purpose: "Points SplunkReady at the operator-owned Splunk MCP endpoint."
    },
    {
      name: "SPLUNKREADY_SPLUNK_MCP_TOKEN",
      status: envVariableStatus(env, "SPLUNKREADY_SPLUNK_MCP_TOKEN"),
      requiredValue: "set",
      purpose: "Authenticates the live read-only Splunk MCP tool calls."
    }
  ];

  return {
    source: "splunkready-live-hosted-model-preflight",
    configured: requiredEnvironment.every((variable) => variable.status === "set"),
    requiredEnvironment,
    optionalEnvironment: [
      {
        name: "SPLUNKREADY_SAIA_ENABLED",
        status: envVariableStatus(env, "SPLUNKREADY_SAIA_ENABLED", (value) => value === "true"),
        requiredValue: "true",
        purpose: "Shows SAIA availability in the workbench; the proof still depends on live hosted-model tool calls."
      }
    ],
    operatorCommand: hostedModelDiagnosticCommand,
    secretHandling: "Only variable names and set/missing/invalid status are written. Secret values are never written."
  };
};

const createSplunkAccessAdapter = async (
  input: HostedModelWorkflowInput,
  env: NodeJS.ProcessEnv
): Promise<SplunkAccessAdapter> => {
  if ((input.mode ?? "live") === "live") {
    return createLiveSplunkAccessAdapter({
      ...createLiveSplunkAdapterConfigFromEnv(env),
      transport: createHttpLiveSplunkTransport()
    });
  }

  const fixture = await loadFixtureSplunkDatasetFromFile(input.fixturePath ?? defaultFixturePath);
  return createFixtureSplunkAccessAdapter(fixture);
};

const compileHostedModelArtifacts = async (
  input: HostedModelWorkflowInput,
  env: NodeJS.ProcessEnv
): Promise<string[]> => {
  const adapter = await createSplunkAccessAdapter(input, env);
  const contract = await compileEnvironmentContract(adapter, {
    requestId: `req-cli-${input.mode ?? "live"}-compile-001`,
    contractVersion: "2026.06.01",
    generatedAt
  });
  const mission = parseMissionDefinition(
    JSON.parse(await readFile(input.missionPath ?? defaultMissionPath, "utf8")) as unknown
  );
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

const formatHostedModelProofError = (error: unknown, env: NodeJS.ProcessEnv = process.env): string => {
  const formatted = (() => {
    if (error instanceof Error) {
      return error.message;
    }

    if (error && typeof error === "object") {
      const input = error as { name?: unknown; code?: unknown; message?: unknown; context?: { toolName?: unknown }; cause?: unknown };

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
  })();

  if (formatted.includes("Action forbidden")) {
    return `Hosted-model SAIA action forbidden. The current MCP token or Splunk user can access live read-only Splunk tools, but not ${hostedModelToolNames.join("/")}.`;
  }

  return redactText(formatted.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(), env);
};

const hostedModelBlockedMessage = (error: string, contractAvailable: boolean): string => {
  if (!contractAvailable) {
    return "Live hosted-model diagnostic could not compile a Splunk contract because required live configuration is not available in this process.";
  }

  if (/404|not found/i.test(error)) {
    return "The MCP contract advertises hosted-model tools, but the live MCP endpoint returned not found when invoking SAIA tools.";
  }

  return "The MCP contract advertises hosted-model tools, but the current credentials did not return advisory SAIA output.";
};

const hostedModelBlockedRequiredActions = (error: string, contractAvailable: boolean): string[] => {
  if (!contractAvailable) {
    return [
      "Export SPLUNKREADY_LIVE_ENABLED=true in the shell that runs the proof.",
      "Export SPLUNKREADY_SPLUNK_MCP_URL without committing or printing it.",
      "Export SPLUNKREADY_SPLUNK_MCP_TOKEN without committing or printing it.",
      "Rerun hosted-model-diagnostic with --require-pass true before claiming hosted-model proof."
    ];
  }

  if (/404|not found/i.test(error)) {
    return [
      `Confirm the Splunk MCP endpoint supports invoking ${hostedModelToolNames.join(", ")}, not only advertising them in tool discovery.`,
      "Confirm the MCP server route or app version that backs hosted-model tools is installed and reachable.",
      "Rerun hosted-model-diagnostic with --require-pass true before claiming hosted-model proof."
    ];
  }

  return [
    ...hostedModelToolNames.map((toolName) => `Grant the Splunk/MCP user permission to invoke ${toolName}.`),
    "Rerun hosted-model-diagnostic with --require-pass true before claiming hosted-model proof."
  ];
};

type HostedModelToolResult = {
  toolName: ReadOnlySplunkToolName;
  status: "PASS" | "BLOCKED";
  contractAdvertised: boolean;
  output?: Record<string, unknown>;
  error?: string;
};

type HostedModelAssistance = {
  generatedQuery?: string;
  generationRationale?: string;
  explanation?: string;
  optimizedQuery?: string;
  rationale?: string;
  answer?: string;
  warnings: string[];
};

const hostedModelToolBlockedResult = (
  toolName: ReadOnlySplunkToolName,
  contractAdvertised: boolean,
  error: string
): HostedModelToolResult => ({
  toolName,
  status: "BLOCKED",
  contractAdvertised,
  error
});

const hostedModelToolOutput = (value: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([, outputValue]) => outputValue !== undefined));

const collectHostedModelToolResults = async (
  adapter: SplunkAccessAdapter,
  contract: EnvironmentContract,
  callOptions: { requestId: string; missionId: string },
  env: NodeJS.ProcessEnv
): Promise<{ assistance: HostedModelAssistance; toolResults: HostedModelToolResult[] }> => {
  const assistance: HostedModelAssistance = { warnings: [] };
  const toolResults: HostedModelToolResult[] = [];

  for (const toolName of hostedModelToolNames) {
    const contractAdvertised = contract.mcpTools.includes(toolName);

    if (!contractAdvertised) {
      toolResults.push(hostedModelToolBlockedResult(toolName, false, `${toolName} is not advertised by the environment contract.`));
      continue;
    }

    try {
      if (toolName === "saia_generate_spl") {
        const generation = await adapter.generateSpl?.({ prompt: hostedModelGenerationPrompt }, callOptions);

        if (!generation) {
          toolResults.push(hostedModelToolBlockedResult(toolName, true, "Adapter does not expose generateSpl."));
          continue;
        }

        assistance.generatedQuery = generation.query;
        assistance.generationRationale = generation.rationale;
        assistance.warnings.push(...generation.warnings);
        toolResults.push({
          toolName,
          status: "PASS",
          contractAdvertised,
          output: hostedModelToolOutput({ query: generation.query, rationale: generation.rationale, warnings: generation.warnings })
        });
        continue;
      }

      if (toolName === "saia_explain_spl") {
        const explanation = await adapter.explainSpl?.({ query: hostedModelProofQuery }, callOptions);

        if (!explanation) {
          toolResults.push(hostedModelToolBlockedResult(toolName, true, "Adapter does not expose explainSpl."));
          continue;
        }

        assistance.explanation = explanation.explanation;
        assistance.warnings.push(...explanation.warnings);
        toolResults.push({
          toolName,
          status: "PASS",
          contractAdvertised,
          output: hostedModelToolOutput({ explanation: explanation.explanation, warnings: explanation.warnings })
        });
        continue;
      }

      if (toolName === "saia_optimize_spl") {
        const optimization = await adapter.optimizeSpl?.({ query: hostedModelProofQuery }, callOptions);

        if (!optimization) {
          toolResults.push(hostedModelToolBlockedResult(toolName, true, "Adapter does not expose optimizeSpl."));
          continue;
        }

        assistance.optimizedQuery = optimization.optimizedQuery;
        assistance.rationale = optimization.rationale;
        assistance.warnings.push(...optimization.warnings);
        toolResults.push({
          toolName,
          status: "PASS",
          contractAdvertised,
          output: hostedModelToolOutput({
            optimizedQuery: optimization.optimizedQuery,
            rationale: optimization.rationale,
            warnings: optimization.warnings
          })
        });
        continue;
      }

      const answer = await adapter.askSplunkQuestion?.({ question: hostedModelQuestion }, callOptions);

      if (!answer) {
        toolResults.push(hostedModelToolBlockedResult(toolName, true, "Adapter does not expose askSplunkQuestion."));
        continue;
      }

      assistance.answer = answer.answer;
      assistance.warnings.push(...answer.warnings);
      toolResults.push({
        toolName,
        status: "PASS",
        contractAdvertised,
        output: hostedModelToolOutput({ answer: answer.answer, warnings: answer.warnings })
      });
    } catch (error) {
      toolResults.push(hostedModelToolBlockedResult(toolName, contractAdvertised, formatHostedModelProofError(error, env)));
    }
  }

  return { assistance, toolResults };
};

const hostedModelFailureSummary = (toolResults: HostedModelToolResult[]): string =>
  toolResults
    .filter((result) => result.status === "BLOCKED")
    .map((result) => `${result.toolName}: ${result.error ?? "blocked"}`)
    .join("; ");

export const writeHostedModelProofArtifact = async (
  input: { outDir: string; mode: "fixture" | "live"; setup?: HostedModelSetup },
  adapter: SplunkAccessAdapter,
  contract: EnvironmentContract,
  env: NodeJS.ProcessEnv = process.env
): Promise<string> => {
  if (!adapter.generateSpl || !adapter.explainSpl || !adapter.optimizeSpl || !adapter.askSplunkQuestion) {
    throw new Error(`hosted-model-proof requires adapters that expose ${hostedModelToolNames.join(", ")}.`);
  }

  const callOptions = { requestId: "req-hosted-model-proof-1", missionId: "hosted-model-proof" };
  const proofPath = join(input.outDir, "hosted-model-proof.json");
  const baseProof = {
    mode: input.mode,
    mutation: false,
    contract: {
      id: contract.id,
      mode: contract.mode,
      hostedModelTools: hostedModelToolNames,
      availableTools: hostedModelToolNames.filter((toolName) => contract.mcpTools.includes(toolName))
    },
    ...(input.setup ? { setup: input.setup } : {}),
    query: hostedModelProofQuery,
    generationPrompt: hostedModelGenerationPrompt,
    question: hostedModelQuestion,
    deterministicContext: {
      ruleIds: ["SPL-001", "SPL-003"],
      passFailAuthority: "deterministic-rule-engine",
      purpose: "Demonstrate hosted-model SAIA assistance as advisory remediation for deterministic SPL violations. No generated or optimized SPL is executed."
    },
    toolCalls: hostedModelToolNames
  };

  const { assistance, toolResults } = await collectHostedModelToolResults(adapter, contract, callOptions, env);
  const blocked = toolResults.some((result) => result.status === "BLOCKED");

  if (!blocked) {
    await writeJson(proofPath, {
      status: "PASS",
      ...baseProof,
      toolResults,
      passedTools: hostedModelToolNames,
      blockedTools: [],
      assistance,
      error: null,
      notes:
        "This proof calls hosted-model tools only. It does not run generated, unsafe, or optimized SPL, does not grade with an LLM, and does not mutate Splunk."
    });
    return proofPath;
  }

  await writeJson(proofPath, {
    status: "BLOCKED",
    ...baseProof,
    toolResults,
    passedTools: toolResults.filter((result) => result.status === "PASS").map((result) => result.toolName),
    blockedTools: toolResults.filter((result) => result.status === "BLOCKED").map((result) => result.toolName),
    assistance: null,
    error: hostedModelFailureSummary(toolResults),
    notes:
      "Hosted-model tools were advertised in the live contract but could not all be invoked with the current MCP credentials."
  });

  return proofPath;
};

const writeBlockedHostedModelProofArtifact = async (
  input: { outDir: string; mode: "live"; setup: HostedModelSetup; error: string }
): Promise<string> => {
  const proofPath = join(input.outDir, "hosted-model-proof.json");

  await writeJson(proofPath, {
    status: "BLOCKED",
    mode: input.mode,
    mutation: false,
    contract: {
      id: "live-hosted-model-unconfigured",
      mode: "live",
      hostedModelTools: hostedModelToolNames,
      availableTools: []
    },
    setup: input.setup,
    query: hostedModelProofQuery,
    deterministicContext: {
      ruleIds: ["SPL-001", "SPL-003"],
      passFailAuthority: "deterministic-rule-engine",
      purpose: "Demonstrate hosted-model SAIA assistance as advisory remediation for deterministic SPL violations. No generated or optimized SPL is executed."
    },
    toolCalls: hostedModelToolNames,
    toolResults: hostedModelToolNames.map((toolName) =>
      hostedModelToolBlockedResult(toolName, false, "Live hosted-model proof is missing required configuration.")
    ),
    passedTools: [],
    blockedTools: hostedModelToolNames,
    assistance: null,
    error: input.error,
    notes:
      "Live hosted-model proof is blocked before any MCP call because required live configuration is not available in this process."
  });

  return proofPath;
};

const hostedModelStatusFromArtifact = async (artifactPath: string): Promise<"PASS" | "BLOCKED"> => {
  const artifact = await readJson<unknown>(artifactPath, "hosted-model workflow artifact");
  const status = stringFromRecord(artifact, "status");

  return status === "PASS" ? "PASS" : "BLOCKED";
};

export const runHostedModelProofWorkflow = async (
  input: HostedModelWorkflowInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<HostedModelWorkflowResult> => {
  const mode = input.mode ?? "live";
  const setup = mode === "live" ? liveHostedModelSetupFromEnv(env) : undefined;

  if (mode === "live" && setup && !setup.configured) {
    const missing = setup.requiredEnvironment
      .filter((variable) => variable.status !== "set")
      .map((variable) => `${variable.name}:${variable.status}`)
      .join(", ");
    const proofPath = await writeBlockedHostedModelProofArtifact({
      outDir: input.outDir,
      mode,
      setup,
      error: `Live hosted-model proof is missing required configuration: ${missing}.`
    });

    return {
      status: "BLOCKED",
      outDir: input.outDir,
      artifacts: [proofPath],
      mutation: false,
      messages: ["Live hosted-model proof blocked before MCP calls; no secrets were read or written."]
    };
  }

  const compileArtifacts = await compileHostedModelArtifacts({ ...input, mode }, env);
  const adapter = await createSplunkAccessAdapter({ ...input, mode }, env);
  const contract = await readJson<EnvironmentContract>(join(input.outDir, "environment-contract.json"), "environment contract");
  const proofPath = await writeHostedModelProofArtifact({ outDir: input.outDir, mode, setup }, adapter, contract, env);
  const status = await hostedModelStatusFromArtifact(proofPath);

  return { status, outDir: input.outDir, artifacts: [...compileArtifacts, proofPath], mutation: false, messages: [] };
};

export const runHostedModelDiagnosticWorkflow = async (
  input: HostedModelWorkflowInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<HostedModelWorkflowResult> => {
  const mode = input.mode ?? "live";
  const setup = mode === "live" ? liveHostedModelSetupFromEnv(env) : undefined;
  const proofResult = await runHostedModelProofWorkflow({ ...input, mode }, env);
  const contract = await readJson<EnvironmentContract>(join(input.outDir, "environment-contract.json"), "environment contract").catch(
    () => undefined
  );
  const proofPath = join(input.outDir, "hosted-model-proof.json");
  const proof = await readJson<unknown>(proofPath, "hosted model proof");
  const proofStatus = stringFromRecord(proof, "status") ?? "UNKNOWN";
  const proofRecord = isRecord(proof) ? proof : {};
  const passedTools = Array.isArray(proofRecord.passedTools)
    ? proofRecord.passedTools.filter((toolName): toolName is ReadOnlySplunkToolName =>
        hostedModelToolNames.includes(toolName as ReadOnlySplunkToolName)
      )
    : [];
  const blockedTools = Array.isArray(proofRecord.blockedTools)
    ? proofRecord.blockedTools.filter((toolName): toolName is ReadOnlySplunkToolName =>
        hostedModelToolNames.includes(toolName as ReadOnlySplunkToolName)
      )
    : hostedModelToolNames;
  const availableTools = contract ? hostedModelToolNames.filter((toolName) => contract.mcpTools.includes(toolName)) : [];
  const missingTools = contract ? hostedModelToolNames.filter((toolName) => !contract.mcpTools.includes(toolName)) : hostedModelToolNames;
  const diagnosticPath = join(input.outDir, "hosted-model-diagnostic.json");
  const blocked = proofStatus !== "PASS";

  await writeJson(diagnosticPath, {
    status: blocked ? "BLOCKED" : "PASS",
    mode,
    mutation: false,
    proofPath,
    contract: {
      id: contract?.id ?? "live-hosted-model-unconfigured",
      mode: contract?.mode ?? mode
    },
    ...(setup ? { setup } : {}),
    requiredTools: hostedModelToolNames,
    availableTools,
    missingTools,
    passedTools,
    blockedTools,
    toolResults: Array.isArray(proofRecord.toolResults) ? proofRecord.toolResults : [],
    permission: blocked
      ? {
          status: "BLOCKED",
          message: hostedModelBlockedMessage(
            stringFromRecord(proof, "error") ?? "Hosted-model proof did not pass.",
            Boolean(contract)
          ),
          error: stringFromRecord(proof, "error") ?? "Hosted-model proof did not pass.",
          requiredActions: hostedModelBlockedRequiredActions(
            stringFromRecord(proof, "error") ?? "Hosted-model proof did not pass.",
            Boolean(contract)
          )
        }
      : {
          status: "OK",
          message: `The current MCP credentials can invoke ${hostedModelToolNames.join(", ")} for advisory SPL remediation.`
        },
    deterministicAuthority: "deterministic-rule-engine",
    notes:
      "This diagnostic calls hosted-model helper tools only. It does not execute the SPL query, does not grade with an LLM, and does not mutate Splunk."
  });

  if (input.requirePass && blocked) {
    throw new Error(
      `hosted-model-diagnostic requires SAIA access but hosted-model proof status was ${proofStatus}. See ${diagnosticPath}.`
    );
  }

  return {
    status: blocked ? "BLOCKED" : "PASS",
    outDir: input.outDir,
    artifacts: [...proofResult.artifacts, diagnosticPath],
    mutation: false,
    messages: []
  };
};
