import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { createFixtureSplunkAccessAdapter, loadFixtureSplunkDatasetFromFile } from "./adapters/fixture.js";
import {
  createHttpLiveSplunkTransport,
  createLiveSplunkAccessAdapter,
  createLiveSplunkAdapterConfigFromEnv
} from "./adapters/live.js";
import type { SplunkAccessAdapter } from "./adapters/splunk-access.js";
import { createGeminiConfigFromEnv, createGeminiLlmAgentModel } from "./agents/gemini-model.js";
import { LlmSpecimenAgent } from "./agents/llm-specimen.js";
import { NaiveSpecimenAgent } from "./agents/specimen.js";
import { compileEnvironmentContract } from "./compiler/environment.js";
import { compileReadinessProfile } from "./compiler/readiness-profile.js";
import { createAnswerRules } from "./grader/answer.js";
import { createAppContextRules } from "./grader/app-context.js";
import { createBudgetRules } from "./grader/budget.js";
import { createContractLookupRules } from "./grader/contract.js";
import { createEvidenceRules } from "./grader/evidence.js";
import { createInjectionRules } from "./grader/injection.js";
import { runRuleEngine, type GraderRule } from "./grader/engine.js";
import { createSavedSearchRules } from "./grader/saved-search.js";
import { scoreMissionReadiness } from "./grader/scoring.js";
import { createSplStructuralRules } from "./grader/spl.js";
import { SplunkFirewallGateway } from "./gateway/firewall.js";
import { parseMissionDefinition, type MissionDefinition } from "./missions/dsl.js";
import { deriveLiveMission, type LiveSavedSearchCandidateResult } from "./missions/live.js";
import { compileAgentPolicy, type AgentPolicy } from "./policy/compiler.js";
import { generatePolicyPatch } from "./policy/patch.js";
import { generateReadinessReceipt } from "./receipts/generator.js";
import {
  readOnlySplunkToolNameSchema,
  environmentContractSchema,
  readinessReceiptSchema,
  traceEventSchema,
  type EnvironmentContract,
  type PolicyPatch,
  type ReadOnlySplunkToolName,
  type TraceEvent,
  type Violation
} from "./schemas/core.js";
import { writeUiShell } from "./ui/shell.js";

const defaultFixturePath = "fixtures/acme-soc-dev/adapter-fixture.json";
const defaultMissionPath = "fixtures/acme-soc-dev/missions/security-investigation-readiness.json";
const defaultOutDir = "artifacts/fixture-demo";
const generatedAt = "2026-06-01T06:30:00.000Z";
const compiledAt = "2026-06-01T06:45:00.000Z";
const liveSmokeInventoryTools: ReadOnlySplunkToolName[] = [
  "splunk_get_info",
  "splunk_get_user_info",
  "splunk_get_indexes",
  "splunk_get_metadata",
  "splunk_get_knowledge_objects"
];
const liveSmokeNotCalledTools = readOnlySplunkToolNameSchema.options.filter(
  (toolName) => !liveSmokeInventoryTools.includes(toolName)
);

interface CliOptions {
  mode: "fixture" | "live";
  fixture: string;
  mission: string;
  out: string;
  phase: "before" | "after";
  requireLive: boolean;
  trace: string;
  agentName: string;
  agentVersion: string;
  agentModel: string;
  candidateLimit: number;
  firewall: boolean;
  json: boolean;
}

interface CliOutput {
  command: string;
  status: "PASS" | "SKIP";
  artifacts: string[];
  messages?: string[];
}

const allRules = (): GraderRule[] => [
  ...createSplStructuralRules(),
  ...createContractLookupRules(),
  ...createSavedSearchRules(),
  ...createAppContextRules(),
  ...createEvidenceRules(),
  ...createAnswerRules(),
  ...createInjectionRules(),
  ...createBudgetRules()
];

const usage = `SplunkReady CLI

Commands:
  compile   --mode fixture|live --fixture <path> --mission <path> --out <dir> [--json]
  evaluate  --mode fixture|live --out <dir> [--firewall] [--json]
  grade-trace --trace <path> --out <dir> [--agent-name <name>] [--agent-version <version>] [--json]
  llm-agent --mode fixture|live --out <dir> [--agent-model <model>]
  live-candidates --out <dir> [--candidate-limit <n>]
  live-proof --out <dir> [--candidate-limit <n>] [--firewall] [--json]
  receipt   --out <dir> [--phase before|after] [--json]
  rerun     --mode fixture|live --out <dir> [--firewall] [--json]
  live-smoke --out <dir> [--require-live true|false]
  demo      --mode fixture|live --out <dir>

Defaults:
  --mode fixture
  --fixture ${defaultFixturePath}
  --mission ${defaultMissionPath}
  --out ${defaultOutDir}
`;

const parseArgs = (argv: string[]): { command: string; options: CliOptions } => {
  const [command = "help", ...rest] = argv;
  const options: CliOptions = {
    mode: "fixture",
    fixture: defaultFixturePath,
    mission: defaultMissionPath,
    out: defaultOutDir,
    phase: "before",
    requireLive: false,
    trace: "",
    agentName: "External Splunk MCP Agent",
    agentVersion: "unversioned",
    agentModel: "",
    candidateLimit: 12,
    firewall: false,
    json: false
  };

  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    const value = rest[index + 1];

    if (flag === "--json") {
      options.json = true;
      continue;
    }

    if (flag === "--firewall") {
      options.firewall = true;
      continue;
    }

    if (!flag.startsWith("--") || !value) {
      throw new Error(`Invalid argument near ${flag}. Use --flag value syntax.\n${usage}`);
    }

    index += 1;

    if (flag === "--mode") {
      if (value !== "fixture" && value !== "live") {
        throw new Error("--mode must be fixture or live.");
      }

      options.mode = value;
    } else if (flag === "--fixture") {
      options.fixture = value;
    } else if (flag === "--mission") {
      options.mission = value;
    } else if (flag === "--out") {
      options.out = value;
    } else if (flag === "--phase") {
      if (value !== "before" && value !== "after") {
        throw new Error("--phase must be before or after.");
      }

      options.phase = value;
    } else if (flag === "--require-live") {
      if (value !== "true" && value !== "false") {
        throw new Error("--require-live must be true or false.");
      }

      options.requireLive = value === "true";
    } else if (flag === "--trace") {
      options.trace = value;
    } else if (flag === "--agent-name") {
      options.agentName = value;
    } else if (flag === "--agent-version") {
      options.agentVersion = value;
    } else if (flag === "--agent-model") {
      options.agentModel = value;
    } else if (flag === "--candidate-limit") {
      const parsedLimit = Number(value);
      if (!Number.isInteger(parsedLimit) || parsedLimit <= 0 || parsedLimit > 25) {
        throw new Error("--candidate-limit must be an integer from 1 to 25.");
      }

      options.candidateLimit = parsedLimit;
    } else {
      throw new Error(`Unknown option ${flag}.\n${usage}`);
    }
  }

  return { command, options };
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const writeText = async (filePath: string, value: string): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, value.endsWith("\n") ? value : `${value}\n`, "utf8");
};

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

const readJson = async <T>(filePath: string, label: string): Promise<T> => {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    throw new Error(`Unable to read ${label} at ${filePath}. Run the prerequisite CLI command first.`);
  }
};

const loadMission = async (missionPath: string): Promise<MissionDefinition> =>
  parseMissionDefinition(JSON.parse(await readFile(missionPath, "utf8")) as unknown);

const loadContract = async (outDir: string): Promise<EnvironmentContract> =>
  environmentContractSchema.parse(await readJson(join(outDir, "environment-contract.json"), "environment contract"));

const loadTrace = async (outDir: string, phase: string): Promise<TraceEvent[]> =>
  readJson(join(outDir, `trace-${phase}.json`), `${phase} trace`);

const loadViolations = async (outDir: string, phase: string): Promise<Violation[]> =>
  readJson(join(outDir, `violations-${phase}.json`), `${phase} violations`);

const loadTraceFile = async (tracePath: string): Promise<TraceEvent[]> => {
  if (!tracePath) {
    throw new Error("grade-trace requires --trace <path>.");
  }

  return traceEventSchema.array().parse(JSON.parse(await readFile(tracePath, "utf8")) as unknown);
};

const assertTraceMatchesMission = (mission: MissionDefinition, traceEvents: TraceEvent[]): void => {
  const mismatchedMissionIds = [...new Set(traceEvents.map((event) => event.missionId).filter((id) => id !== mission.id))];

  if (mismatchedMissionIds.length > 0) {
    throw new Error(
      `Trace missionId mismatch. Expected ${mission.id}; found ${mismatchedMissionIds.join(", ")}.`
    );
  }
};

const gradeTrace = (contract: EnvironmentContract, mission: MissionDefinition, traceEvents: TraceEvent[]): Violation[] =>
  runRuleEngine({ contract, mission, traceEvents }, allRules()).violations;

const splAssistanceRuleIds = new Set(["SPL-001", "SPL-003", "SPL-004"]);

const queryFromViolation = (violation: Violation): string | undefined => {
  const query = violation.evidence["query"];
  return typeof query === "string" && query.trim().length > 0 ? query : undefined;
};

const collectSplAssistance = async (
  adapter: SplunkAccessAdapter,
  violations: Violation[]
): Promise<PolicyPatch["splAssistance"]> => {
  if (!adapter.explainSpl || !adapter.optimizeSpl) {
    return undefined;
  }

  const assistance: NonNullable<PolicyPatch["splAssistance"]> = [];
  const cache = new Map<
    string,
    {
      explanation: Awaited<ReturnType<NonNullable<SplunkAccessAdapter["explainSpl"]>>>;
      optimization: Awaited<ReturnType<NonNullable<SplunkAccessAdapter["optimizeSpl"]>>>;
    }
  >();

  for (const violation of violations) {
    if (!splAssistanceRuleIds.has(violation.ruleId)) {
      continue;
    }

    const query = queryFromViolation(violation);
    if (!query) {
      continue;
    }

    let result = cache.get(query);
    if (!result) {
      const callOptions = {
        requestId: `req-saia-${cache.size + 1}`,
        missionId: violation.missionId,
        traceEventId: violation.traceEventId
      };
      const [explanation, optimization] = await Promise.all([
        adapter.explainSpl({ query }, callOptions),
        adapter.optimizeSpl({ query }, callOptions)
      ]);
      result = { explanation, optimization };
      cache.set(query, result);
    }

    assistance.push({
      violationRef: violation.id,
      ruleId: violation.ruleId,
      query,
      explanation: result.explanation.explanation,
      optimizedQuery: result.optimization.optimizedQuery,
      rationale: result.optimization.rationale,
      warnings: [...result.explanation.warnings, ...result.optimization.warnings]
    });
  }

  return assistance.length > 0 ? assistance : undefined;
};

const llmEnabled = (env: NodeJS.ProcessEnv = process.env): boolean => env.SPLUNKREADY_LLM_ENABLED === "true";

const createLlmSpecimenAgent = (
  contract: EnvironmentContract,
  options: CliOptions,
  env: NodeJS.ProcessEnv = process.env
): LlmSpecimenAgent => {
  const geminiConfig = createGeminiConfigFromEnv(env);

  if (!geminiConfig) {
    throw new Error("SPLUNKREADY_LLM_ENABLED=true requires GEMINI_API_KEY. No Gemini request was made.");
  }

  return new LlmSpecimenAgent({
    contract,
    model: createGeminiLlmAgentModel({
      ...geminiConfig,
      model: options.agentModel || geminiConfig.model
    })
  });
};

const specimenAgentDescriptor = (
  options: CliOptions,
  env: NodeJS.ProcessEnv = process.env
): { name: string; version: string } => {
  if (!llmEnabled(env)) {
    return { name: "Naive SOC MCP Agent", version: "0.1.0" };
  }

  const geminiConfig = createGeminiConfigFromEnv(env);

  return {
    name: "Gemini Splunk MCP Agent",
    version: options.agentModel || geminiConfig?.model || "gemini-3.1-flash-lite"
  };
};

const createSplunkAccessAdapter = async (
  options: CliOptions,
  env: NodeJS.ProcessEnv = process.env
): Promise<SplunkAccessAdapter> => {
  if (options.mode === "live") {
    return createLiveSplunkAccessAdapter({
      ...createLiveSplunkAdapterConfigFromEnv(env),
      transport: createHttpLiveSplunkTransport()
    });
  }

  const fixture = await loadFixtureSplunkDatasetFromFile(options.fixture);
  return createFixtureSplunkAccessAdapter(fixture);
};

const maybeWrapFirewall = (
  adapter: SplunkAccessAdapter,
  contract: EnvironmentContract,
  policy: AgentPolicy,
  options: CliOptions
): SplunkAccessAdapter =>
  options.firewall ? new SplunkFirewallGateway(adapter, contract, policy) : adapter;

const compileContract = async (
  options: CliOptions,
  env: NodeJS.ProcessEnv = process.env
): Promise<EnvironmentContract> => {
  const adapter = await createSplunkAccessAdapter(options, env);
  return compileEnvironmentContract(adapter, {
    requestId: `req-cli-${options.mode}-compile-001`,
    contractVersion: "2026.06.01",
    generatedAt
  });
};

const writeCompiledArtifacts = async (
  outDir: string,
  contract: EnvironmentContract,
  mission: MissionDefinition,
  versions: {
    policyVersion: string;
    profileVersion: string;
  } = {
    policyVersion: "policy-2026.06.01",
    profileVersion: "profile-2026.06.01"
  }
): Promise<string[]> => {
  const policy = compileAgentPolicy(contract, { policyVersion: versions.policyVersion, compiledAt });
  const readinessProfile = compileReadinessProfile(contract, [mission], {
    profileVersion: versions.profileVersion,
    generatedAt: compiledAt
  });

  await writeJson(join(outDir, "environment-contract.json"), contract);
  await writeJson(join(outDir, "missions.json"), [mission]);
  await writeJson(join(outDir, "agent-policy.json"), policy);
  await writeJson(join(outDir, "readiness-profile.json"), readinessProfile);

  return [
    join(outDir, "environment-contract.json"),
    join(outDir, "missions.json"),
    join(outDir, "agent-policy.json"),
    join(outDir, "readiness-profile.json")
  ];
};

const compileCommand = async (options: CliOptions, env: NodeJS.ProcessEnv = process.env): Promise<string[]> => {
  const contract = await compileContract(options, env);
  const mission = await loadMission(options.mission);
  return writeCompiledArtifacts(options.out, contract, mission);
};

const liveSmokeMissingEnvFields = (env: NodeJS.ProcessEnv): string[] => {
  const missingFields: string[] = [];

  if (env.SPLUNKREADY_LIVE_ENABLED !== "true") {
    missingFields.push("SPLUNKREADY_LIVE_ENABLED=true");
  }

  if (!env.SPLUNKREADY_SPLUNK_MCP_URL) {
    missingFields.push("SPLUNKREADY_SPLUNK_MCP_URL");
  }

  if (!env.SPLUNKREADY_SPLUNK_MCP_TOKEN) {
    missingFields.push("SPLUNKREADY_SPLUNK_MCP_TOKEN");
  }

  return missingFields;
};

const liveSmokeCommand = async (
  options: CliOptions,
  env: NodeJS.ProcessEnv = process.env
): Promise<{ status: "PASS" | "SKIP"; artifacts: string[]; messages: string[] }> => {
  const missingFields = liveSmokeMissingEnvFields(env);

  if (missingFields.length > 0) {
    const message = [
      `Live smoke skipped; missing ${missingFields.join(", ")}.`,
      "No live Splunk calls were made and no live artifacts were written.",
      "Fixture commands still run without live credentials.",
      "See docs/live-adapter.md for the opt-in setup checklist."
    ].join(" ");

    if (options.requireLive) {
      throw new Error(message);
    }

    return { status: "SKIP", artifacts: [], messages: [message] };
  }

  const metadataTimeWindow = { earliest: "-15m", latest: "now" };
  const adapter = createLiveSplunkAccessAdapter({
    ...createLiveSplunkAdapterConfigFromEnv(env),
    capabilities: liveSmokeInventoryTools,
    transport: createHttpLiveSplunkTransport()
  });
  const contract = await compileEnvironmentContract(adapter, {
    requestId: "req-cli-live-smoke-001",
    contractVersion: "live-smoke-2026.06.01",
    generatedAt,
    metadataTimeWindow,
    queryBudgets: {
      maxToolCalls: 5,
      maxResultRows: 1,
      timeoutSeconds: 30
    }
  });
  const mission = await loadMission(options.mission);
  const readinessProfile = compileReadinessProfile(contract, [mission], {
    profileVersion: "live-smoke-profile-2026.06.01",
    generatedAt: compiledAt
  });
  const contractPath = join(options.out, "live-smoke-contract.json");
  const profilePath = join(options.out, "live-smoke-readiness-profile.json");
  const summaryPath = join(options.out, "live-smoke-summary.json");

  await writeJson(contractPath, contract);
  await writeJson(profilePath, readinessProfile);
  await writeJson(summaryPath, {
    status: "PASS",
    mode: contract.mode,
    contractId: contract.id,
    readinessProfileId: readinessProfile.id,
    sourceRefs: contract.sourceRefs,
    metadataTimeWindow,
    allowedTools: liveSmokeInventoryTools,
    notCalledTools: liveSmokeNotCalledTools,
    readOnlyToolsOnly: true,
    destructiveOperations: false
  });

  return { status: "PASS", artifacts: [contractPath, profilePath, summaryPath], messages: [] };
};

const savedSearchCandidateScore = (savedSearch: EnvironmentContract["savedSearches"][number]): number => {
  const haystack = `${savedSearch.app} ${savedSearch.name}`.toLowerCase();
  let score = 0;

  if (/\b(error|alert|auth|login|security|notable|incident|lateral)\b/.test(haystack)) {
    score += 4;
  }

  if (savedSearch.app === "search") {
    score += 2;
  }

  if (!/instrumentation|deploymentserver|dmc|monitoring_console/i.test(haystack)) {
    score += 1;
  }

  return score;
};

const sortedSavedSearchCandidates = (
  savedSearches: EnvironmentContract["savedSearches"],
  limit: number
): EnvironmentContract["savedSearches"] =>
  [...savedSearches]
    .sort((left, right) => {
      const scoreDiff = savedSearchCandidateScore(right) - savedSearchCandidateScore(left);
      return scoreDiff !== 0 ? scoreDiff : `${left.app}::${left.name}`.localeCompare(`${right.app}::${right.name}`);
    })
    .slice(0, limit);

const liveCandidatesCommand = async (options: CliOptions, env: NodeJS.ProcessEnv = process.env): Promise<string[]> => {
  const liveOptions = { ...options, mode: "live" as const };
  const contract = await loadContract(options.out);
  const adapter = await createSplunkAccessAdapter(liveOptions, env);
  const candidates = sortedSavedSearchCandidates(contract.savedSearches, options.candidateLimit);
  const results: LiveSavedSearchCandidateResult[] = [];

  for (const candidate of candidates) {
    try {
      const result = await adapter.runSavedSearch(
        {
          app: candidate.app,
          name: candidate.name,
          maxRows: 5
        },
        {
          requestId: `req-cli-live-candidates-${results.length + 1}`,
          missionId: "live-candidate-scan"
        }
      );

      results.push({
        ref: `${candidate.app}::${candidate.name}`,
        app: candidate.app,
        name: candidate.name,
        resultCount: result.resultCount,
        evidenceRefs: result.evidenceRefs,
        warnings: result.warnings
      });
    } catch (error) {
      results.push({
        ref: `${candidate.app}::${candidate.name}`,
        app: candidate.app,
        name: candidate.name,
        resultCount: null,
        evidenceRefs: [],
        warnings: [],
        error: formatCliError(error)
      });
    }
  }

  const reportPath = join(options.out, "live-candidates.json");
  const derived = deriveLiveMission(contract, results);
  const derivedMissionPath = join(options.out, "live-derived-mission.json");
  const derivedProfilePath = join(options.out, "live-derived-readiness-profile.json");
  const artifacts = [reportPath];

  if (derived.mission) {
    const readinessProfile = compileReadinessProfile(contract, [derived.mission], {
      profileVersion: "live-derived-profile-2026.06.01",
      generatedAt: compiledAt
    });

    await writeJson(derivedMissionPath, derived.mission);
    await writeJson(derivedProfilePath, readinessProfile);
    artifacts.push(derivedMissionPath, derivedProfilePath);
  }

  await writeJson(reportPath, {
    mode: "live",
    contractId: contract.id,
    checked: results.length,
    maxRowsPerSavedSearch: 5,
    mutation: false,
    candidates: results,
    candidatesWithRows: results.filter((result) => typeof result.resultCount === "number" && result.resultCount > 0),
    derivedMission: {
      strategy: derived.strategy,
      reason: derived.reason,
      missionId: derived.mission?.id,
      artifacts: derived.mission ? [derivedMissionPath, derivedProfilePath] : []
    }
  });

  return artifacts;
};

const liveProofCommand = async (options: CliOptions, env: NodeJS.ProcessEnv = process.env): Promise<string[]> => {
  const liveOptions = { ...options, mode: "live" as const };
  const contract = await compileContract(liveOptions, env);
  const contractPath = join(options.out, "environment-contract.json");

  await writeJson(contractPath, contract);

  const candidateArtifacts = await liveCandidatesCommand(liveOptions, env);
  const candidateReport = await readJson<{
    derivedMission?: { strategy: string; reason: string; missionId?: string };
  }>(join(options.out, "live-candidates.json"), "live candidates report");
  const derivedMissionPath = join(options.out, "live-derived-mission.json");

  if (!candidateReport.derivedMission?.missionId) {
    throw new Error(
      `live-proof could not derive a runnable mission. ${candidateReport.derivedMission?.reason ?? "Run live-candidates for details."}`
    );
  }

  const mission = await loadMission(derivedMissionPath);
  const compileArtifacts = await writeCompiledArtifacts(options.out, contract, mission, {
    policyVersion: "live-derived-policy-2026.06.01",
    profileVersion: "live-derived-profile-2026.06.01"
  });
  const runOptions = { ...liveOptions, mission: derivedMissionPath };
  const evaluateArtifacts = await evaluateCommand(runOptions, env);
  const receiptArtifacts = await receiptCommand(runOptions, env);
  const rerunArtifacts = await rerunCommand(runOptions, env);
  const beforeReceipt = readinessReceiptSchema.parse(
    await readJson(join(options.out, "receipt-before-001.json"), "before receipt")
  );
  const afterReceipt = readinessReceiptSchema.parse(
    await readJson(join(options.out, "receipt-after-001.json"), "after receipt")
  );
  const summaryPath = join(options.out, "live-proof-summary.json");

  await writeJson(summaryPath, {
    status: "PASS",
    mode: "live",
    mutation: false,
    derivedMission: candidateReport.derivedMission,
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
    failToPass: beforeReceipt.verdict === "NOT READY" && afterReceipt.verdict === "READY",
    readyWithoutPatch: beforeReceipt.verdict === "READY" && afterReceipt.verdict === "READY",
    notes:
      beforeReceipt.verdict === "READY" && afterReceipt.verdict === "READY"
        ? "The live-derived mission was already ready before policy injection; this proves live certification but not the fail-to-pass patch loop."
        : "The live-derived mission exercised the receipt rerun flow."
  });

  return [
    ...new Set([
      contractPath,
      ...candidateArtifacts,
      ...compileArtifacts,
      ...evaluateArtifacts,
      ...receiptArtifacts,
      ...rerunArtifacts,
      summaryPath
    ])
  ];
};

const evaluateCommand = async (options: CliOptions, env: NodeJS.ProcessEnv = process.env): Promise<string[]> => {
  const baseAdapter = await createSplunkAccessAdapter(options, env);
  const contract = await loadContract(options.out);
  const mission = await loadMission(options.mission);
  const policy = options.firewall ? await readJson<AgentPolicy>(join(options.out, "agent-policy.json"), "agent policy") : undefined;
  const adapter = policy ? maybeWrapFirewall(baseAdapter, contract, policy, options) : baseAdapter;
  const agent = llmEnabled(env) ? createLlmSpecimenAgent(contract, options, env) : new NaiveSpecimenAgent();
  const run = await agent.run({ mission, adapter });
  const violations = gradeTrace(contract, mission, run.traceEvents);
  const score = scoreMissionReadiness(mission, violations);

  await writeJson(join(options.out, "trace-before.json"), run.traceEvents);
  await writeJson(join(options.out, "violations-before.json"), violations);
  await writeJson(join(options.out, "score-before.json"), score);

  return [
    join(options.out, "trace-before.json"),
    join(options.out, "violations-before.json"),
    join(options.out, "score-before.json")
  ];
};

const gradeTraceCommand = async (options: CliOptions): Promise<string[]> => {
  const contract = await loadContract(options.out);
  const mission = await loadMission(options.mission);
  const traceEvents = await loadTraceFile(options.trace);
  assertTraceMatchesMission(mission, traceEvents);
  const violations = gradeTrace(contract, mission, traceEvents);
  const score = scoreMissionReadiness(mission, violations);
  const generated = generateReadinessReceipt({
    id: "receipt-external-001",
    agent: { name: options.agentName, version: options.agentVersion },
    environment: contract,
    missionSuiteVersion: "external-trace-1",
    missions: [mission],
    traceEvents,
    violations,
    notes:
      "This receipt grades an externally supplied trace. The deterministic rule engine decides pass/fail; the trace producer is outside SplunkReady."
  });

  await writeJson(join(options.out, "trace-external.json"), traceEvents);
  await writeJson(join(options.out, "violations-external.json"), violations);
  await writeJson(join(options.out, "score-external.json"), score);
  await writeText(join(options.out, "receipt-external-001.json"), generated.json);
  await writeText(join(options.out, "receipt-external-001.md"), generated.markdown);

  return [
    join(options.out, "trace-external.json"),
    join(options.out, "violations-external.json"),
    join(options.out, "score-external.json"),
    join(options.out, "receipt-external-001.json"),
    join(options.out, "receipt-external-001.md")
  ];
};

const llmAgentCommand = async (
  options: CliOptions,
  env: NodeJS.ProcessEnv = process.env
): Promise<string[]> => {
  const geminiConfig = createGeminiConfigFromEnv(env);

  if (!geminiConfig) {
    throw new Error("llm-agent requires GEMINI_API_KEY. No Gemini request was made and no Splunk calls were made.");
  }

  const compileArtifacts = await compileCommand(options, env);
  const adapter = await createSplunkAccessAdapter(options, env);
  const contract = await loadContract(options.out);
  const mission = await loadMission(options.mission);
  const agent = createLlmSpecimenAgent(contract, options, env);
  const run = await agent.run({ mission, adapter });
  const violations = gradeTrace(contract, mission, run.traceEvents);
  const score = scoreMissionReadiness(mission, violations);
  const generated = generateReadinessReceipt({
    id: "receipt-llm-agent-001",
    agent: { name: "Gemini Splunk MCP Agent", version: options.agentModel || geminiConfig.model },
    environment: contract,
    missionSuiteVersion: "security-readiness-llm-1",
    missions: [mission],
    traceEvents: run.traceEvents,
    violations,
    notes:
      "This receipt grades a trace produced by a Gemini-backed specimen agent. The model chooses read-only Splunk tool calls; the deterministic rule engine decides pass/fail."
  });

  await writeJson(join(options.out, "trace-llm-agent.json"), run.traceEvents);
  await writeJson(join(options.out, "llm-agent-observations.json"), run.observations);
  await writeJson(join(options.out, "violations-llm-agent.json"), violations);
  await writeJson(join(options.out, "score-llm-agent.json"), score);
  await writeText(join(options.out, "receipt-llm-agent-001.json"), generated.json);
  await writeText(join(options.out, "receipt-llm-agent-001.md"), generated.markdown);

  return [
    ...compileArtifacts,
    join(options.out, "trace-llm-agent.json"),
    join(options.out, "llm-agent-observations.json"),
    join(options.out, "violations-llm-agent.json"),
    join(options.out, "score-llm-agent.json"),
    join(options.out, "receipt-llm-agent-001.json"),
    join(options.out, "receipt-llm-agent-001.md")
  ];
};

const receiptCommand = async (
  options: CliOptions,
  env: NodeJS.ProcessEnv = process.env
): Promise<string[]> => {
  const contract = await loadContract(options.out);
  const mission = await loadMission(options.mission);
  const traceEvents = await loadTrace(options.out, options.phase);
  const violations = await loadViolations(options.out, options.phase);
  const receiptId = `receipt-${options.phase}-001`;
  const generated = generateReadinessReceipt({
    id: receiptId,
    agent: specimenAgentDescriptor(options, env),
    environment: contract,
    missionSuiteVersion: "security-readiness-1",
    missions: [mission],
    traceEvents,
    violations,
    policyPatchSummary: options.phase === "before" && violations.length > 0 ? [{ id: "patch-security-readiness", status: "exported" }] : [],
    rerunComparison: {}
  });
  const jsonPath = join(options.out, `${receiptId}.json`);
  const markdownPath = join(options.out, `${receiptId}.md`);

  await writeText(jsonPath, generated.json);
  await writeText(markdownPath, generated.markdown);

  if (options.phase === "before" && violations.length > 0) {
    const adapter = await createSplunkAccessAdapter(options, env);
    const splAssistance = await collectSplAssistance(adapter, violations);
    const patch = generatePolicyPatch({
      id: "patch-security-readiness",
      createdAt: compiledAt,
      sourceReceipt: generated.receipt,
      targetAgent: generated.receipt.agent,
      environment: contract,
      violations,
      splAssistance
    });

    await writeText(join(options.out, "policy-patch.json"), patch.json);
    await writeText(join(options.out, "policy-patch.md"), patch.markdown);

    return [jsonPath, markdownPath, join(options.out, "policy-patch.json"), join(options.out, "policy-patch.md")];
  }

  return [jsonPath, markdownPath];
};

const rerunCommand = async (options: CliOptions, env: NodeJS.ProcessEnv = process.env): Promise<string[]> => {
  const baseAdapter = await createSplunkAccessAdapter(options, env);
  const contract = await loadContract(options.out);
  const mission = await loadMission(options.mission);
  const policy = await readJson<AgentPolicy>(join(options.out, "agent-policy.json"), "agent policy");
  const adapter = maybeWrapFirewall(baseAdapter, contract, policy, options);
  const agent = llmEnabled(env) ? createLlmSpecimenAgent(contract, options, env) : new NaiveSpecimenAgent();
  const run = await agent.run({ mission, adapter, policy });
  const violations = gradeTrace(contract, mission, run.traceEvents);
  const score = scoreMissionReadiness(mission, violations);

  await writeJson(join(options.out, "trace-after.json"), run.traceEvents);
  await writeJson(join(options.out, "violations-after.json"), violations);
  await writeJson(join(options.out, "score-after.json"), score);

  const beforeReceipt = readinessReceiptSchema.safeParse(
    await readJson(join(options.out, "receipt-before-001.json"), "before receipt")
  );
  const resolvedViolations = beforeReceipt.success
    ? beforeReceipt.data.violations.filter((violationId) => !violations.some((violation) => violation.id === violationId))
    : [];
  const generated = generateReadinessReceipt({
    id: "receipt-after-001",
    agent: specimenAgentDescriptor(options, env),
    environment: contract,
    missionSuiteVersion: "security-readiness-1",
    missions: [mission],
    traceEvents: run.traceEvents,
    violations,
    rerunComparison: beforeReceipt.success
      ? {
          beforeScore: beforeReceipt.data.score,
          afterScore: score.score,
          beforeVerdict: beforeReceipt.data.verdict,
          afterVerdict: score.verdict,
          resolvedViolations
        }
      : {}
  });

  await writeText(join(options.out, "receipt-after-001.json"), generated.json);
  await writeText(join(options.out, "receipt-after-001.md"), generated.markdown);

  return [
    join(options.out, "trace-after.json"),
    join(options.out, "violations-after.json"),
    join(options.out, "score-after.json"),
    join(options.out, "receipt-after-001.json"),
    join(options.out, "receipt-after-001.md")
  ];
};

const demoCommand = async (options: CliOptions): Promise<string[]> => {
  const startedAt = Date.now();
  const beforeOptions = { ...options, phase: "before" as const };
  const compileArtifacts = await compileCommand(beforeOptions);
  const evaluateArtifacts = await evaluateCommand(beforeOptions);
  const receiptArtifacts = await receiptCommand(beforeOptions);
  const rerunArtifacts = await rerunCommand(beforeOptions);
  const uiShellPath = await writeUiShell(options.out);
  const rehearsalPath = join(options.out, "demo-rehearsal.json");
  const notesPath = join(options.out, "demo-rehearsal.md");
  const elapsedSeconds = Number(((Date.now() - startedAt) / 1000).toFixed(3));
  const expectedArtifacts = [
    ...compileArtifacts,
    ...evaluateArtifacts,
    ...receiptArtifacts,
    ...rerunArtifacts,
    uiShellPath,
    rehearsalPath,
    notesPath
  ];
  const uiRoute = `${uiShellPath}#certification-replay`;
  const rehearsal = {
    status: "PASS",
    targetSeconds: 180,
    measuredSeconds: elapsedSeconds,
    fitsUnderThreeMinutes: elapsedSeconds < 180,
    uiRoute,
    story: "fail -> compile -> patch -> rerun -> pass",
    expectedArtifacts,
    timingNotes: [
      { segment: "setup", targetSeconds: 15 },
      { segment: "scary failure", targetSeconds: 30 },
      { segment: "compile and grade", targetSeconds: 70 },
      { segment: "policy patch", targetSeconds: 25 },
      { segment: "rerun and close", targetSeconds: 40 }
    ]
  };

  await writeJson(rehearsalPath, rehearsal);
  await writeText(
    notesPath,
    `# SplunkReady Demo Rehearsal

- Story: fail -> compile -> patch -> rerun -> pass.
- Target: under 180 seconds.
- Measured CLI orchestration: ${elapsedSeconds}s.
- UI route: ${uiRoute}
- Expected artifacts: ${expectedArtifacts.length}

Open the UI shell at the route above and follow docs/demo-script.md for the spoken path.
`
  );

  return expectedArtifacts;
};

const main = async (): Promise<void> => {
  const { command, options } = parseArgs(process.argv.slice(2));
  let artifacts: string[];

  if (command === "help" || command === "--help" || command === "-h") {
    console.log(usage);
    return;
  }

  if (command === "live-smoke") {
    const result = await liveSmokeCommand(options);
    printCliOutput({ command, status: result.status, artifacts: result.artifacts, messages: result.messages }, options);
    return;
  }

  if (command === "compile") {
    artifacts = await compileCommand(options);
  } else if (command === "evaluate") {
    artifacts = await evaluateCommand(options);
  } else if (command === "grade-trace") {
    artifacts = await gradeTraceCommand(options);
  } else if (command === "llm-agent") {
    artifacts = await llmAgentCommand(options);
  } else if (command === "live-candidates") {
    artifacts = await liveCandidatesCommand(options);
  } else if (command === "live-proof") {
    artifacts = await liveProofCommand(options);
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

main().catch((error: unknown) => {
  console.error(formatCliError(error));
  process.exitCode = 1;
});
