import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
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
  proofDir: string;
  securityCheckDir: string;
  securityKitDir: string;
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
  live-security-check --out <dir> [--json]
  live-security-kit --out <dir> [--json]
  live-security-proof --out <dir> [--firewall] [--json]
  live-security-ui-bundle --out <dir> [--proof-dir <dir>] [--security-check-dir <dir>] [--security-kit-dir <dir>] [--json]
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
    proofDir: "artifacts/live-proof",
    securityCheckDir: "artifacts/live-security-check",
    securityKitDir: "artifacts/live-security-kit",
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
    } else if (flag === "--proof-dir") {
      options.proofDir = value;
    } else if (flag === "--security-check-dir") {
      options.securityCheckDir = value;
    } else if (flag === "--security-kit-dir") {
      options.securityKitDir = value;
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

const exists = async (filePath: string): Promise<boolean> =>
  stat(filePath)
    .then(() => true)
    .catch(() => false);

const copyRequiredArtifact = async (sourceDir: string, outDir: string, fileName: string, label: string): Promise<string> => {
  const sourcePath = join(sourceDir, fileName);
  const outPath = join(outDir, fileName);

  if (!(await exists(sourcePath))) {
    throw new Error(`Unable to read ${label} at ${sourcePath}. Run the prerequisite CLI command first.`);
  }

  await mkdir(dirname(outPath), { recursive: true });
  await copyFile(sourcePath, outPath);
  return outPath;
};

const copyOptionalArtifact = async (sourceDir: string, outDir: string, fileName: string): Promise<string | undefined> => {
  const sourcePath = join(sourceDir, fileName);

  if (!(await exists(sourcePath))) {
    return undefined;
  }

  const outPath = join(outDir, fileName);
  await mkdir(dirname(outPath), { recursive: true });
  await copyFile(sourcePath, outPath);
  return outPath;
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

const flagshipSecuritySavedSearch = {
  app: "SplunkEnterpriseSecuritySuite",
  name: "ES - Lateral Movement Auth Chain",
  ref: "SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain"
};

const formatSplunkCsvTimestamp = (date: Date): string => {
  const pad = (value: number): string => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())}`;
};

const lateralMovementSampleRows = (now = new Date()): string[] => {
  const offsetsMs = [21 * 60_000, 14 * 60_000, 7 * 60_000];
  const rows = [
    ["live-evt-102", "win-finance-07", "win-finance-07", "admin-login-02", "svc-finance", "4624", "An account was successfully logged on"],
    ["live-evt-118", "admin-login-02", "admin-login-02", "dc-01", "svc-finance", "4672", "Special privileges assigned to new logon"],
    ["live-evt-141", "dc-01", "dc-01", "finance-sql-03", "svc-finance", "4624", "An account was successfully logged on"]
  ] as const;

  return rows.map((row, index) =>
    [
      formatSplunkCsvTimestamp(new Date(now.getTime() - offsetsMs[index])),
      row[0],
      "XmlWinEventLog:Security",
      row[1],
      row[2],
      row[3],
      row[4],
      row[5],
      row[6]
    ].join(",")
  );
};

const liveSecurityKitCommand = async (options: CliOptions): Promise<string[]> => {
  const kitGeneratedAt = new Date();
  const appRoot = join(options.out, flagshipSecuritySavedSearch.app);
  const appConfPath = join(appRoot, "default", "app.conf");
  const indexesPath = join(appRoot, "default", "indexes.conf");
  const propsPath = join(appRoot, "default", "props.conf");
  const savedSearchesPath = join(appRoot, "default", "savedsearches.conf");
  const sampleEventsPath = join(options.out, "lateral-movement-events.csv");
  const readmePath = join(options.out, "README.md");
  const manifestPath = join(options.out, "live-security-kit.json");

  await writeText(
    appConfPath,
    `[install]
is_configured = 1

[launcher]
author = SplunkReady
description = Read-only content for the SplunkReady flagship security readiness proof.
version = 0.1.0

[ui]
is_visible = 0
label = SplunkReady Security Readiness
`
  );
  await writeText(
    indexesPath,
    `[wineventlog]
datatype = event
homePath = $SPLUNK_DB/wineventlog/db
coldPath = $SPLUNK_DB/wineventlog/colddb
thawedPath = $SPLUNK_DB/wineventlog/thaweddb
`
  );
  await writeText(
    propsPath,
    `[XmlWinEventLog:Security]
INDEXED_EXTRACTIONS = csv
KV_MODE = none
SHOULD_LINEMERGE = false
TIMESTAMP_FIELDS = _time
TIME_FORMAT = %Y-%m-%d %H:%M:%S
`
  );
  await writeText(
    savedSearchesPath,
    `[${flagshipSecuritySavedSearch.name}]
disabled = 0
dispatch.earliest_time = -24h
dispatch.latest_time = now
search = index=wineventlog | rex field=_raw "^(?<_csv_time>[^,]+),(?<eventRef>[^,]+),(?<csv_sourcetype>[^,]+),(?<csv_host>[^,]+),(?<src>[^,]+),(?<dest>[^,]+),(?<user>[^,]+),(?<EventCode>[^,]+),(?<signature>.*)$" | search (src="win-finance-07" OR src="admin-login-02" OR src="dc-01" OR dest="win-finance-07" OR dest="admin-login-02" OR dest="dc-01") | eval sourcetype=coalesce(sourcetype, csv_sourcetype) | dedup eventRef | table _time eventRef sourcetype src dest user EventCode signature
`
  );
  await writeText(
    sampleEventsPath,
    `_time,eventRef,sourcetype,host,src,dest,user,EventCode,signature
${lateralMovementSampleRows(kitGeneratedAt).join("\n")}
`
  );
  await writeText(
    readmePath,
    `# SplunkReady Live Security Kit

This directory contains an operator-owned setup bundle for the SplunkReady flagship security proof. SplunkReady generated these files locally; it did not connect to or mutate Splunk.

## Contents

- \`${flagshipSecuritySavedSearch.app}/default/indexes.conf\` defines the \`wineventlog\` index expected by the flagship mission.
- \`${flagshipSecuritySavedSearch.app}/default/props.conf\` defines CSV parsing for \`XmlWinEventLog:Security\`.
- \`${flagshipSecuritySavedSearch.app}/default/savedsearches.conf\` defines the exact saved search \`${flagshipSecuritySavedSearch.ref}\`.
- \`lateral-movement-events.csv\` contains three evidence rows for the \`win-finance-07\` lateral-movement story.

The CSV timestamps are generated at kit creation time and are intentionally recent so the saved search's \`-24h\` window returns rows. Regenerate this kit immediately before importing data if it has been sitting around.

## Operator Setup

Run these commands only on a local or approved Splunk Enterprise trial. They intentionally require an operator to install content and ingest data; SplunkReady will not do that automatically.

If Splunk Enterprise Security is already installed, do not blindly overwrite that app. Merge the saved-search/index/props stanzas through your normal Splunk admin process. On a clean local trial, the generated \`${flagshipSecuritySavedSearch.app}\` app directory provides the app context needed for the exact saved-search reference.

\`\`\`bash
export SPLUNK_HOME=/path/to/splunk
cd ${options.out}

# Install or copy the app, then restart if your Splunk deployment requires it for indexes.conf.
cp -R ${flagshipSecuritySavedSearch.app} "$SPLUNK_HOME/etc/apps/"
"$SPLUNK_HOME/bin/splunk" restart

# Ingest the sample evidence rows into the operator-created wineventlog index.
"$SPLUNK_HOME/bin/splunk" add oneshot lateral-movement-events.csv \\
  -index wineventlog \\
  -sourcetype XmlWinEventLog:Security \\
  -auth <user>:<password>
\`\`\`

## Verify

After setup, rerun the read-only readiness diagnostic:

\`\`\`bash
set -a; source ./.splunkready-live.env; set +a
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run splunkready -- live-security-check --out artifacts/live-security-check --json
\`\`\`

Expected signal:

- \`status\`: \`READY_FOR_FLAGSHIP_LIVE_SECURITY_PROOF\`
- \`requiredSavedSearch.present\`: \`true\`
- \`requiredSavedSearch.run.resultCount\`: at least \`1\`
- \`requiredSavedSearch.run.evidenceRefs\`: non-empty

Then run the live proof:

\`\`\`bash
set -a; source ./.splunkready-live.env; set +a
export SPLUNKREADY_LLM_ENABLED=true
export GEMINI_MODEL=gemini-3.1-flash-lite
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run splunkready -- live-security-proof --out artifacts/live-security-proof --json
\`\`\`
`
  );
  await writeJson(manifestPath, {
    status: "PASS",
    mutation: false,
    operatorActionRequired: true,
    mission: "mission-security-lateral-movement-readiness",
    savedSearch: flagshipSecuritySavedSearch,
    preferredIndex: "wineventlog",
    sourcetype: "XmlWinEventLog:Security",
    sampleEvents: 3,
    generatedAt: kitGeneratedAt.toISOString(),
    artifacts: [appConfPath, indexesPath, propsPath, savedSearchesPath, sampleEventsPath, readmePath]
  });

  return [manifestPath, appConfPath, indexesPath, propsPath, savedSearchesPath, sampleEventsPath, readmePath];
};

const liveSecurityCheckCommand = async (options: CliOptions, env: NodeJS.ProcessEnv = process.env): Promise<string[]> => {
  const liveOptions = { ...options, mode: "live" as const };
  const contract = await compileContract(liveOptions, env);
  const contractPath = join(options.out, "environment-contract.json");

  await writeJson(contractPath, contract);

  const adapter = await createSplunkAccessAdapter(liveOptions, env);
  const requiredTools: ReadOnlySplunkToolName[] = [
    "splunk_get_knowledge_objects",
    "splunk_run_saved_search"
  ];
  const missingTools = requiredTools.filter((tool) => !contract.mcpTools.includes(tool));
  const preferredIndex = contract.indexes.find((index) => index.name === "wineventlog");
  const exactSavedSearch = contract.savedSearches.find(
    (candidate) => candidate.app === flagshipSecuritySavedSearch.app && candidate.name === flagshipSecuritySavedSearch.name
  );
  const nearbySavedSearches = sortedSavedSearchCandidates(contract.savedSearches, 8)
    .map((candidate) => `${candidate.app}::${candidate.name}`)
    .filter((ref) => ref !== flagshipSecuritySavedSearch.ref);
  let runResult:
    | {
        attempted: true;
        resultCount: number | null;
        evidenceRefs: string[];
        warnings: string[];
        error?: string;
      }
    | { attempted: false; reason: string };

  if (!exactSavedSearch) {
    runResult = { attempted: false, reason: "Exact flagship saved search is not present in the live contract." };
  } else if (missingTools.length > 0) {
    runResult = {
      attempted: false,
      reason: `Cannot run saved search because required MCP tools are missing: ${missingTools.join(", ")}.`
    };
  } else {
    try {
      const result = await adapter.runSavedSearch(
        {
          app: exactSavedSearch.app,
          name: exactSavedSearch.name,
          maxRows: 5
        },
        {
          requestId: "req-cli-live-security-check-saved-search",
          missionId: "live-security-readiness-check"
        }
      );

      runResult = {
        attempted: true,
        resultCount: result.resultCount,
        evidenceRefs: result.evidenceRefs,
        warnings: result.warnings
      };
    } catch (error) {
      runResult = {
        attempted: true,
        resultCount: null,
        evidenceRefs: [],
        warnings: [],
        error: formatCliError(error)
      };
    }
  }

  const hasRows = runResult.attempted && typeof runResult.resultCount === "number" && runResult.resultCount > 0;
  const hasEvidenceRefs = runResult.attempted && runResult.evidenceRefs.length > 0;
  const ready =
    missingTools.length === 0 &&
    Boolean(exactSavedSearch) &&
    hasRows &&
    hasEvidenceRefs;
  const nextActions: string[] = [];

  if (missingTools.length > 0) {
    nextActions.push(`Expose read-only MCP tools required for the flagship mission: ${missingTools.join(", ")}.`);
  }

  if (!exactSavedSearch) {
    nextActions.push(
      `Install or create read-only saved search ${flagshipSecuritySavedSearch.ref} for the lateral-movement mission.`
    );
  }

  if (exactSavedSearch && !hasRows) {
    nextActions.push(
      "Ensure the flagship saved search returns at least one row for the current mission window before running live-proof."
    );
  }

  if (exactSavedSearch && hasRows && !hasEvidenceRefs) {
    nextActions.push("Ensure returned rows expose evidence identifiers such as eventRef, _cd, _raw, or _time.");
  }

  if (!preferredIndex) {
    nextActions.push("Confirm the deployment has an authentication/security index such as wineventlog for the flagship story.");
  }

  if (ready) {
    nextActions.push(
      "Run live-proof with LLM mode enabled; the deployment has the saved-search evidence needed for the flagship live security path."
    );
  }

  const reportPath = join(options.out, "live-security-readiness.json");

  await writeJson(reportPath, {
    status: ready ? "READY_FOR_FLAGSHIP_LIVE_SECURITY_PROOF" : "BLOCKED",
    mode: "live",
    mutation: false,
    mission: {
      id: "mission-security-lateral-movement-readiness",
      story: "security investigation readiness"
    },
    contract: {
      id: contract.id,
      name: contract.name,
      indexes: contract.indexes.length,
      savedSearches: contract.savedSearches.length,
      tools: contract.mcpTools.length
    },
    requiredTools: {
      expected: requiredTools,
      missing: missingTools
    },
    preferredIndex: {
      name: "wineventlog",
      present: Boolean(preferredIndex),
      sensitive: preferredIndex?.sensitive ?? null
    },
    requiredSavedSearch: {
      ...flagshipSecuritySavedSearch,
      present: Boolean(exactSavedSearch),
      nearbySavedSearches,
      run: runResult
    },
    blockers: nextActions.filter((action) => !ready || !action.startsWith("Run live-proof")),
    nextActions
  });

  return [contractPath, reportPath];
};

const liveSecurityUiBundleCommand = async (options: CliOptions): Promise<string[]> => {
  const requiredProofFiles = [
    "environment-contract.json",
    "missions.json",
    "readiness-profile.json",
    "receipt-before-001.json",
    "receipt-after-001.json",
    "trace-before.json",
    "trace-after.json",
    "violations-before.json",
    "violations-after.json"
  ];
  const optionalProofFiles = [
    "agent-policy.json",
    "policy-patch.json",
    "live-proof-summary.json",
    "live-security-proof-summary.json",
    "live-candidates.json",
    "live-derived-mission.json",
    "live-derived-readiness-profile.json",
    "score-before.json",
    "score-after.json"
  ];
  const artifacts: string[] = [];
  const missingOptional: string[] = [];

  for (const fileName of requiredProofFiles) {
    artifacts.push(await copyRequiredArtifact(options.proofDir, options.out, fileName, `live proof artifact ${fileName}`));
  }

  for (const fileName of optionalProofFiles) {
    const copied = await copyOptionalArtifact(options.proofDir, options.out, fileName);

    if (copied) {
      artifacts.push(copied);
    } else {
      missingOptional.push(join(options.proofDir, fileName));
    }
  }

  artifacts.push(
    await copyRequiredArtifact(
      options.securityCheckDir,
      options.out,
      "live-security-readiness.json",
      "live security readiness report"
    )
  );
  artifacts.push(
    await copyRequiredArtifact(options.securityKitDir, options.out, "live-security-kit.json", "live security operator kit manifest")
  );

  const summaryPath = join(options.out, "live-security-ui-bundle.json");

  await writeJson(summaryPath, {
    status: "PASS",
    mutation: false,
    proofDir: options.proofDir,
    securityCheckDir: options.securityCheckDir,
    securityKitDir: options.securityKitDir,
    artifacts,
    missingOptional
  });
  artifacts.push(summaryPath);

  return artifacts;
};

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

const liveSecurityProofCommand = async (options: CliOptions, env: NodeJS.ProcessEnv = process.env): Promise<string[]> => {
  if (!llmEnabled(env)) {
    throw new Error("live-security-proof requires SPLUNKREADY_LLM_ENABLED=true so the certified specimen is a real LLM agent.");
  }

  const liveOptions = { ...options, mode: "live" as const };
  const checkArtifacts = await liveSecurityCheckCommand(liveOptions, env);
  const readiness = await readJson<{
    status: string;
    blockers?: string[];
    nextActions?: string[];
  }>(join(options.out, "live-security-readiness.json"), "live security readiness report");

  if (readiness.status !== "READY_FOR_FLAGSHIP_LIVE_SECURITY_PROOF") {
    const blockers = readiness.blockers && readiness.blockers.length > 0 ? readiness.blockers.join(" ") : "No blockers were reported.";
    const nextActions =
      readiness.nextActions && readiness.nextActions.length > 0
        ? ` Next actions: ${readiness.nextActions.join(" ")}`
        : "";

    throw new Error(`live-security-proof is blocked: ${blockers}${nextActions}`);
  }

  const compileArtifacts = await compileCommand(liveOptions, env);
  const evaluateArtifacts = await evaluateCommand(liveOptions, env);
  const receiptArtifacts = await receiptCommand(liveOptions, env);
  const rerunArtifacts = await rerunCommand(liveOptions, env);
  const beforeReceipt = readinessReceiptSchema.parse(
    await readJson(join(options.out, "receipt-before-001.json"), "before receipt")
  );
  const afterReceipt = readinessReceiptSchema.parse(
    await readJson(join(options.out, "receipt-after-001.json"), "after receipt")
  );
  const liveProofSummaryPath = join(options.out, "live-proof-summary.json");
  const securitySummaryPath = join(options.out, "live-security-proof-summary.json");
  const failToPass = beforeReceipt.verdict === "NOT READY" && afterReceipt.verdict === "READY";
  const readyAfterPatch = afterReceipt.verdict === "READY";

  await writeJson(liveProofSummaryPath, {
    status: "PASS",
    mode: "live",
    mutation: false,
    derivedMission: {
      strategy: "saved-search-with-evidence",
      reason: "The flagship security readiness check passed, so the proof used the exact lateral-movement saved search.",
      missionId: "mission-security-lateral-movement-readiness",
      artifacts: ["live-security-readiness.json"]
    },
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
    failToPass,
    readyWithoutPatch: beforeReceipt.verdict === "READY" && afterReceipt.verdict === "READY",
    notes: failToPass
      ? "The flagship live security mission completed the LLM fail -> patch -> rerun -> pass path against read-only Splunk MCP tools."
      : "The flagship live security mission ran against live Splunk MCP tools; inspect receipts for remaining readiness state."
  });

  await writeJson(securitySummaryPath, {
    status: "PASS",
    mode: "live",
    mutation: false,
    mission: "mission-security-lateral-movement-readiness",
    readinessStatus: readiness.status,
    before: {
      verdict: beforeReceipt.verdict,
      score: beforeReceipt.score,
      violations: beforeReceipt.violations.length
    },
    after: {
      verdict: afterReceipt.verdict,
      score: afterReceipt.score,
      violations: afterReceipt.violations.length,
      evidenceRefs: afterReceipt.evidenceRefs
    },
    failToPass,
    readyAfterPatch,
    notes: failToPass
      ? "The flagship live security mission completed the LLM fail -> patch -> rerun -> pass path against read-only Splunk MCP tools."
      : "The flagship live security mission ran against live Splunk MCP tools; inspect receipts for remaining readiness state."
  });

  return [
    ...new Set([
      ...checkArtifacts,
      ...compileArtifacts,
      ...evaluateArtifacts,
      ...receiptArtifacts,
      ...rerunArtifacts,
      liveProofSummaryPath,
      securitySummaryPath
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
  } else if (command === "live-security-check") {
    artifacts = await liveSecurityCheckCommand(options);
  } else if (command === "live-security-kit") {
    artifacts = await liveSecurityKitCommand(options);
  } else if (command === "live-security-proof") {
    artifacts = await liveSecurityProofCommand(options);
  } else if (command === "live-security-ui-bundle") {
    artifacts = await liveSecurityUiBundleCommand(options);
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
