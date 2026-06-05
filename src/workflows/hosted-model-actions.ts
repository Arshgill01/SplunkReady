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

export const hostedModelToolNames: ReadOnlySplunkToolName[] = ["saia_explain_spl", "saia_optimize_spl"];

const defaultFixturePath = "fixtures/acme-soc-dev/adapter-fixture.json";
const defaultMissionPath = "fixtures/acme-soc-dev/missions/security-investigation-readiness.json";
const generatedAt = "2026-06-01T06:30:00.000Z";
const compiledAt = "2026-06-01T06:45:00.000Z";
const hostedModelProofQuery = "search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now";

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

const formatHostedModelProofError = (error: unknown): string => {
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
    return "Hosted-model SAIA action forbidden. The current MCP token or Splunk user can access live read-only Splunk tools, but not saia_explain_spl/saia_optimize_spl.";
  }

  return formatted.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
};

export const writeHostedModelProofArtifact = async (
  input: { outDir: string; mode: "fixture" | "live" },
  adapter: SplunkAccessAdapter,
  contract: EnvironmentContract
): Promise<string> => {
  if (!adapter.explainSpl || !adapter.optimizeSpl) {
    throw new Error("hosted-model-proof requires adapters that expose saia_explain_spl and saia_optimize_spl.");
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
    query: hostedModelProofQuery,
    deterministicContext: {
      ruleIds: ["SPL-001", "SPL-003"],
      passFailAuthority: "deterministic-rule-engine",
      purpose:
        "Demonstrate hosted-model explain/optimize as advisory remediation for a deterministic SPL violation. The query is not executed."
    },
    toolCalls: hostedModelToolNames
  };

  try {
    const [explanation, optimization] = await Promise.all([
      adapter.explainSpl({ query: hostedModelProofQuery }, callOptions),
      adapter.optimizeSpl({ query: hostedModelProofQuery }, callOptions)
    ]);

    await writeJson(proofPath, {
      status: "PASS",
      ...baseProof,
      assistance: {
        explanation: explanation.explanation,
        optimizedQuery: optimization.optimizedQuery,
        rationale: optimization.rationale,
        warnings: [...explanation.warnings, ...optimization.warnings]
      },
      error: null,
      notes:
        "This proof calls hosted-model tools only. It does not run the SPL query, does not grade with an LLM, and does not mutate Splunk."
    });
  } catch (error) {
    await writeJson(proofPath, {
      status: "BLOCKED",
      ...baseProof,
      assistance: null,
      error: formatHostedModelProofError(error),
      notes:
        "Hosted-model tools were advertised in the live contract but could not be invoked with the current MCP credentials."
    });
  }

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
  const compileArtifacts = await compileHostedModelArtifacts({ ...input, mode }, env);
  const adapter = await createSplunkAccessAdapter({ ...input, mode }, env);
  const contract = await readJson<EnvironmentContract>(join(input.outDir, "environment-contract.json"), "environment contract");
  const proofPath = await writeHostedModelProofArtifact({ outDir: input.outDir, mode }, adapter, contract);
  const status = await hostedModelStatusFromArtifact(proofPath);

  return { status, outDir: input.outDir, artifacts: [...compileArtifacts, proofPath], mutation: false, messages: [] };
};

export const runHostedModelDiagnosticWorkflow = async (
  input: HostedModelWorkflowInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<HostedModelWorkflowResult> => {
  const mode = input.mode ?? "live";
  const proofResult = await runHostedModelProofWorkflow({ ...input, mode }, env);
  const contract = await readJson<EnvironmentContract>(join(input.outDir, "environment-contract.json"), "environment contract");
  const proofPath = join(input.outDir, "hosted-model-proof.json");
  const proof = await readJson<unknown>(proofPath, "hosted model proof");
  const proofStatus = stringFromRecord(proof, "status") ?? "UNKNOWN";
  const availableTools = hostedModelToolNames.filter((toolName) => contract.mcpTools.includes(toolName));
  const missingTools = hostedModelToolNames.filter((toolName) => !contract.mcpTools.includes(toolName));
  const diagnosticPath = join(input.outDir, "hosted-model-diagnostic.json");
  const blocked = proofStatus !== "PASS";

  await writeJson(diagnosticPath, {
    status: blocked ? "BLOCKED" : "PASS",
    mode,
    mutation: false,
    proofPath,
    contract: {
      id: contract.id,
      mode: contract.mode
    },
    requiredTools: hostedModelToolNames,
    availableTools,
    missingTools,
    permission: blocked
      ? {
          status: "BLOCKED",
          message:
            "The MCP contract advertises hosted-model tools, but the current credentials did not return advisory SAIA output.",
          error: stringFromRecord(proof, "error") ?? "Hosted-model proof did not pass.",
          requiredActions: [
            "Grant the Splunk/MCP user permission to invoke saia_explain_spl.",
            "Grant the Splunk/MCP user permission to invoke saia_optimize_spl.",
            "Rerun hosted-model-diagnostic with --require-pass true before claiming hosted-model proof."
          ]
        }
      : {
          status: "OK",
          message:
            "The current MCP credentials can invoke saia_explain_spl and saia_optimize_spl for advisory SPL remediation."
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
