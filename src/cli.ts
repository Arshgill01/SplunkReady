import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { createFixtureSplunkAccessAdapter, loadFixtureSplunkDatasetFromFile } from "./adapters/fixture.js";
import {
  createHttpLiveSplunkTransport,
  createLiveSplunkAccessAdapter,
  createLiveSplunkAdapterConfigFromEnv
} from "./adapters/live.js";
import { NaiveSpecimenAgent } from "./agents/specimen.js";
import { compileEnvironmentContract } from "./compiler/environment.js";
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
import { parseMissionDefinition, type MissionDefinition } from "./missions/dsl.js";
import { compileAgentPolicy, type AgentPolicy } from "./policy/compiler.js";
import { generatePolicyPatch } from "./policy/patch.js";
import { generateReadinessReceipt } from "./receipts/generator.js";
import {
  readOnlySplunkToolNameSchema,
  environmentContractSchema,
  readinessReceiptSchema,
  traceEventSchema,
  type EnvironmentContract,
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
  fixture: string;
  mission: string;
  out: string;
  phase: "before" | "after";
  requireLive: boolean;
  trace: string;
  agentName: string;
  agentVersion: string;
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
  compile   --fixture <path> --mission <path> --out <dir>
  evaluate  --out <dir>
  grade-trace --trace <path> --out <dir> [--agent-name <name>] [--agent-version <version>]
  receipt   --out <dir> [--phase before|after]
  rerun     --out <dir>
  live-smoke --out <dir> [--require-live true|false]
  demo      --out <dir>

Defaults:
  --fixture ${defaultFixturePath}
  --mission ${defaultMissionPath}
  --out ${defaultOutDir}
`;

const parseArgs = (argv: string[]): { command: string; options: CliOptions } => {
  const [command = "help", ...rest] = argv;
  const options: CliOptions = {
    fixture: defaultFixturePath,
    mission: defaultMissionPath,
    out: defaultOutDir,
    phase: "before",
    requireLive: false,
    trace: "",
    agentName: "External Splunk MCP Agent",
    agentVersion: "unversioned"
  };

  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    const value = rest[index + 1];

    if (!flag.startsWith("--") || !value) {
      throw new Error(`Invalid argument near ${flag}. Use --flag value syntax.\n${usage}`);
    }

    index += 1;

    if (flag === "--fixture") {
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

const compileCommand = async (options: CliOptions): Promise<string[]> => {
  const fixture = await loadFixtureSplunkDatasetFromFile(options.fixture);
  const adapter = createFixtureSplunkAccessAdapter(fixture);
  const contract = await compileEnvironmentContract(adapter, {
    requestId: "req-cli-compile-001",
    contractVersion: "2026.06.01",
    generatedAt
  });
  const mission = await loadMission(options.mission);
  const policy = compileAgentPolicy(contract, { policyVersion: "policy-2026.06.01", compiledAt });

  await writeJson(join(options.out, "environment-contract.json"), contract);
  await writeJson(join(options.out, "missions.json"), [mission]);
  await writeJson(join(options.out, "agent-policy.json"), policy);

  return [
    join(options.out, "environment-contract.json"),
    join(options.out, "missions.json"),
    join(options.out, "agent-policy.json")
  ];
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
  const contractPath = join(options.out, "live-smoke-contract.json");
  const summaryPath = join(options.out, "live-smoke-summary.json");

  await writeJson(contractPath, contract);
  await writeJson(summaryPath, {
    status: "PASS",
    mode: contract.mode,
    contractId: contract.id,
    sourceRefs: contract.sourceRefs,
    metadataTimeWindow,
    allowedTools: liveSmokeInventoryTools,
    notCalledTools: liveSmokeNotCalledTools,
    readOnlyToolsOnly: true,
    destructiveOperations: false
  });

  return { status: "PASS", artifacts: [contractPath, summaryPath], messages: [] };
};

const evaluateCommand = async (options: CliOptions): Promise<string[]> => {
  const fixture = await loadFixtureSplunkDatasetFromFile(options.fixture);
  const adapter = createFixtureSplunkAccessAdapter(fixture);
  const contract = await loadContract(options.out);
  const mission = await loadMission(options.mission);
  const agent = new NaiveSpecimenAgent();
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

const receiptCommand = async (options: CliOptions): Promise<string[]> => {
  const contract = await loadContract(options.out);
  const mission = await loadMission(options.mission);
  const traceEvents = await loadTrace(options.out, options.phase);
  const violations = await loadViolations(options.out, options.phase);
  const receiptId = `receipt-${options.phase}-001`;
  const generated = generateReadinessReceipt({
    id: receiptId,
    agent: { name: "Naive SOC MCP Agent", version: "0.1.0" },
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
    const patch = generatePolicyPatch({
      id: "patch-security-readiness",
      createdAt: compiledAt,
      sourceReceipt: generated.receipt,
      targetAgent: generated.receipt.agent,
      environment: contract,
      violations
    });

    await writeText(join(options.out, "policy-patch.json"), patch.json);
    await writeText(join(options.out, "policy-patch.md"), patch.markdown);

    return [jsonPath, markdownPath, join(options.out, "policy-patch.json"), join(options.out, "policy-patch.md")];
  }

  return [jsonPath, markdownPath];
};

const rerunCommand = async (options: CliOptions): Promise<string[]> => {
  const fixture = await loadFixtureSplunkDatasetFromFile(options.fixture);
  const adapter = createFixtureSplunkAccessAdapter(fixture);
  const contract = await loadContract(options.out);
  const mission = await loadMission(options.mission);
  const policy = await readJson<AgentPolicy>(join(options.out, "agent-policy.json"), "agent policy");
  const agent = new NaiveSpecimenAgent();
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
    agent: { name: "Naive SOC MCP Agent", version: "0.1.0" },
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
    console.log(`${result.status} live-smoke`);
    for (const message of result.messages) {
      console.log(message);
    }
    for (const artifact of result.artifacts) {
      console.log(`artifact ${artifact}`);
    }
    return;
  }

  if (command === "compile") {
    artifacts = await compileCommand(options);
  } else if (command === "evaluate") {
    artifacts = await evaluateCommand(options);
  } else if (command === "grade-trace") {
    artifacts = await gradeTraceCommand(options);
  } else if (command === "receipt") {
    artifacts = await receiptCommand(options);
  } else if (command === "rerun") {
    artifacts = await rerunCommand(options);
  } else if (command === "demo") {
    artifacts = await demoCommand(options);
  } else {
    throw new Error(`Unknown command ${command}.\n${usage}`);
  }

  console.log(`PASS ${command}`);
  for (const artifact of artifacts) {
    console.log(`artifact ${artifact}`);
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
