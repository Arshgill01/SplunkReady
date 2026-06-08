import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { createFixtureSplunkAccessAdapter, loadFixtureSplunkDatasetFromFile } from "../adapters/fixture.js";
import {
  createHttpLiveSplunkTransport,
  createLiveSplunkAccessAdapter,
  createLiveSplunkAdapterConfigFromEnv
} from "../adapters/live.js";
import { createMockSplunkMcpLiveTransport } from "../mock-splunk-mcp/server.js";
import type { SplunkAccessAdapter, SplunkAdapterError } from "../adapters/splunk-access.js";
import { createGeminiConfigFromEnv, createGeminiLlmAgentModel } from "../agents/gemini-model.js";
import { LlmSpecimenAgent, type LlmSpecimenAgentRun } from "../agents/llm-specimen.js";
import { NaiveSpecimenAgent, type SpecimenAgentRun } from "../agents/specimen.js";
import { compileEnvironmentContract } from "../compiler/environment.js";
import { compileReadinessProfile } from "../compiler/readiness-profile.js";
import { firewallBlockedCode, SplunkFirewallGateway } from "../gateway/firewall.js";
import { createAnswerRules } from "../grader/answer.js";
import { createAppContextRules } from "../grader/app-context.js";
import { createBudgetRules } from "../grader/budget.js";
import { createContractLookupRules } from "../grader/contract.js";
import { createEvidenceRules } from "../grader/evidence.js";
import { runRuleEngine, type GraderRule } from "../grader/engine.js";
import { createInjectionRules } from "../grader/injection.js";
import { createSafetyRules } from "../grader/safety.js";
import { createSavedSearchRules } from "../grader/saved-search.js";
import { scoreMissionReadiness } from "../grader/scoring.js";
import { createSplStructuralRules } from "../grader/spl.js";
import { parseMissionDefinition, type MissionDefinition } from "../missions/dsl.js";
import { compileAgentPolicy, type AgentPolicy } from "../policy/compiler.js";
import { generatePolicyPatch } from "../policy/patch.js";
import {
  loadPolicyBundle,
  policyIdentityFor,
  publishPolicy,
  validatePolicyForMission,
  type PolicyIdentity
} from "../policies/registry.js";
import { generateReadinessReceipt } from "../receipts/generator.js";
import {
  environmentContractSchema,
  policyPatchSchema,
  readinessReceiptSchema,
  type EnvironmentContract,
  type PolicyPatch,
  type TraceEvent,
  type Violation
} from "../schemas/core.js";
import { writeUiShell } from "../ui/shell.js";
import type { FixtureCertificationWorkflowSteps } from "./fixture-certification.js";
import { runProofAuditWorkflow } from "./proof-audit.js";

export const defaultFixturePath = "fixtures/acme-soc-dev/adapter-fixture.json";
export const defaultMissionPath = "fixtures/acme-soc-dev/missions/security-investigation-readiness.json";
export const certificationGeneratedAt = "2026-06-01T06:30:00.000Z";
export const certificationCompiledAt = "2026-06-01T06:45:00.000Z";

export interface CertificationActionOptions {
  mode: "fixture" | "live";
  fixture: string;
  mission: string;
  out: string;
  phase: "before" | "after";
  firewall: boolean;
  agentModel: string;
  requirePass?: boolean;
  liveMock?: boolean;
  mockState?: "ok" | "degraded" | "route-not-found";
  policy?: string;
}

interface FirewallBlockReport {
  status: "BLOCKED";
  code: "FIREWALL_POLICY_BLOCKED";
  phase: "before" | "after";
  mode: CertificationActionOptions["mode"];
  mutation: false;
  blockedBeforeSplunk: true;
  toolName: string;
  requestId: string;
  missionId?: string;
  message: string;
  query?: string;
  violations?: unknown;
}

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
  } catch {
    throw new Error(`Unable to read ${label} at ${filePath}. Run the prerequisite CLI command first.`);
  }
};

const exists = async (filePath: string): Promise<boolean> =>
  stat(filePath)
    .then(() => true)
    .catch(() => false);

const removeOptionalFile = async (filePath: string): Promise<void> => {
  await rm(filePath, { force: true });
};

const isLlmSpecimenRun = (run: SpecimenAgentRun): run is LlmSpecimenAgentRun =>
  "plan" in run && "answer" in run && "observations" in run && "outputQuality" in run;

const writeLlmDeliberationArtifact = async (
  outDir: string,
  phase: "before" | "after",
  run: SpecimenAgentRun
): Promise<string[]> => {
  if (!isLlmSpecimenRun(run)) {
    return [];
  }

  const artifactPath = join(outDir, `llm-deliberation-${phase}.json`);

  await writeJson(artifactPath, {
    source: "splunkready-llm-deliberation",
    phase,
    advisoryOnly: true,
    passFailAuthority: "deterministic-rule-engine",
    plan: run.plan,
    observations: run.observations,
    answer: run.answer,
    outputQuality: run.outputQuality
  });

  return [artifactPath];
};

export const readOptionalPolicyPatch = async (outDir: string): Promise<PolicyPatch | undefined> => {
  const patchPath = join(outDir, "policy-patch.json");

  if (!(await exists(patchPath))) {
    return undefined;
  }

  return policyPatchSchema.parse(await readJson<unknown>(patchPath, "policy patch"));
};

export const loadMission = async (missionPath: string): Promise<MissionDefinition> =>
  parseMissionDefinition(JSON.parse(await readFile(missionPath, "utf8")) as unknown);

export const loadContract = async (outDir: string): Promise<EnvironmentContract> =>
  environmentContractSchema.parse(await readJson(join(outDir, "environment-contract.json"), "environment contract"));

const loadTrace = async (outDir: string, phase: string): Promise<TraceEvent[]> =>
  readJson(join(outDir, `trace-${phase}.json`), `${phase} trace`);

const loadViolations = async (outDir: string, phase: string): Promise<Violation[]> =>
  readJson(join(outDir, `violations-${phase}.json`), `${phase} violations`);

const loadPolicyIdentity = async (outDir: string): Promise<PolicyIdentity | undefined> => {
  const policyPath = join(outDir, "policy-evaluation.json");

  if (!(await exists(policyPath))) {
    return undefined;
  }

  const parsed = await readJson<{ policy?: PolicyIdentity }>(policyPath, "policy evaluation");
  return parsed.policy;
};

const allRules = (): GraderRule[] => [
  ...createSplStructuralRules(),
  ...createContractLookupRules(),
  ...createSavedSearchRules(),
  ...createAppContextRules(),
  ...createEvidenceRules(),
  ...createAnswerRules(),
  ...createInjectionRules(),
  ...createBudgetRules(),
  ...createSafetyRules()
];

export const gradeTrace = (
  contract: EnvironmentContract,
  mission: MissionDefinition,
  traceEvents: TraceEvent[]
): Violation[] => runRuleEngine({ contract, mission, traceEvents }, allRules()).violations;

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
      let explanation: Awaited<ReturnType<NonNullable<SplunkAccessAdapter["explainSpl"]>>>;
      let optimization: Awaited<ReturnType<NonNullable<SplunkAccessAdapter["optimizeSpl"]>>>;

      try {
        [explanation, optimization] = await Promise.all([
          adapter.explainSpl({ query }, callOptions),
          adapter.optimizeSpl({ query }, callOptions)
        ]);
      } catch {
        continue;
      }

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

export const llmEnabled = (env: NodeJS.ProcessEnv = process.env): boolean => env.SPLUNKREADY_LLM_ENABLED === "true";

export const createLlmSpecimenAgent = (
  contract: EnvironmentContract,
  options: CertificationActionOptions,
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

export const specimenAgentDescriptor = (
  options: CertificationActionOptions,
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

export const createSplunkAccessAdapter = async (
  options: CertificationActionOptions,
  env: NodeJS.ProcessEnv = process.env
): Promise<SplunkAccessAdapter> => {
  if (options.mode === "live") {
    if (options.liveMock) {
      const fixture = await loadFixtureSplunkDatasetFromFile(options.fixture);

      return createLiveSplunkAccessAdapter({
        enabled: true,
        endpointUrl: "mock://splunkready",
        authToken: "mock-token",
        defaultApp: env.SPLUNKREADY_SPLUNK_APP,
        capabilities: fixture.readOnlyTools,
        transport: createMockSplunkMcpLiveTransport(fixture, { state: options.mockState })
      });
    }

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
  options: CertificationActionOptions
): SplunkAccessAdapter =>
  options.firewall ? new SplunkFirewallGateway(adapter, contract, policy) : adapter;

const isFirewallBlockedError = (error: unknown): error is SplunkAdapterError =>
  Boolean(
    error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "SplunkAdapterError" &&
      "code" in error &&
      error.code === firewallBlockedCode
  );

const writeFirewallBlockReport = async (
  options: CertificationActionOptions,
  phase: "before" | "after",
  error: SplunkAdapterError
): Promise<string> => {
  const cause =
    error.cause && typeof error.cause === "object"
      ? (error.cause as { query?: unknown; violations?: unknown })
      : {};
  const report: FirewallBlockReport = {
    status: "BLOCKED",
    code: firewallBlockedCode,
    phase,
    mode: options.mode,
    mutation: false,
    blockedBeforeSplunk: true,
    toolName: error.context.toolName,
    requestId: error.context.requestId,
    missionId: error.context.missionId,
    message: error.message,
    query: typeof cause.query === "string" ? cause.query : undefined,
    violations: cause.violations
  };
  const reportPath = join(options.out, `firewall-block-${phase}.json`);

  await writeJson(reportPath, report);
  return reportPath;
};

export const compileContract = async (
  options: CertificationActionOptions,
  env: NodeJS.ProcessEnv = process.env
): Promise<EnvironmentContract> => {
  const adapter = await createSplunkAccessAdapter(options, env);
  return compileEnvironmentContract(adapter, {
    requestId: `req-cli-${options.mode}-compile-001`,
    contractVersion: "2026.06.01",
    generatedAt: certificationGeneratedAt
  });
};

export const writeCompiledArtifacts = async (
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
  const policy = compileAgentPolicy(contract, { policyVersion: versions.policyVersion, compiledAt: certificationCompiledAt });
  const readinessProfile = compileReadinessProfile(contract, [mission], {
    profileVersion: versions.profileVersion,
    generatedAt: certificationCompiledAt
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

export const compileCommand = async (
  options: CertificationActionOptions,
  env: NodeJS.ProcessEnv = process.env
): Promise<string[]> => {
  const contract = await compileContract(options, env);
  const mission = await loadMission(options.mission);
  return writeCompiledArtifacts(options.out, contract, mission);
};

export const evaluateCommand = async (
  options: CertificationActionOptions,
  env: NodeJS.ProcessEnv = process.env
): Promise<string[]> => {
  const baseAdapter = await createSplunkAccessAdapter(options, env);
  const contract = await loadContract(options.out);
  const mission = await loadMission(options.mission);
  let policyIdentity: PolicyIdentity | undefined;
  if (options.policy) {
    const { policy } = await loadPolicyBundle(options.policy);
    const published = await publishPolicy({ policyRef: options.policy, outDir: options.out });

    validatePolicyForMission(policy, mission);
    policyIdentity = policyIdentityFor(policy, published.manifest.policyHash);
    await writeJson(join(options.out, "policy-evaluation.json"), {
      source: "splunkready-policy-evaluation",
      policy: policyIdentity,
      policyManifest: published.artifacts[0],
      deterministicAuthority: true,
      mutation: false
    });
  }
  const policy = options.firewall ? await readJson<AgentPolicy>(join(options.out, "agent-policy.json"), "agent policy") : undefined;
  const adapter = policy ? maybeWrapFirewall(baseAdapter, contract, policy, options) : baseAdapter;
  const agent = llmEnabled(env) ? createLlmSpecimenAgent(contract, options, env) : new NaiveSpecimenAgent();
  let run: SpecimenAgentRun;

  try {
    run = await agent.run({ mission, adapter });
  } catch (error) {
    if (isFirewallBlockedError(error)) {
      await writeFirewallBlockReport(options, "before", error);
    }

    throw error;
  }

  const violations = gradeTrace(contract, mission, run.traceEvents);
  const score = scoreMissionReadiness(mission, violations);
  const llmArtifacts = await writeLlmDeliberationArtifact(options.out, "before", run);

  await writeJson(join(options.out, "trace-before.json"), run.traceEvents);
  await writeJson(join(options.out, "violations-before.json"), violations);
  await writeJson(join(options.out, "score-before.json"), score);

  return [
    ...(policyIdentity ? [join(options.out, "policy-evaluation.json")] : []),
    ...llmArtifacts,
    join(options.out, "trace-before.json"),
    join(options.out, "violations-before.json"),
    join(options.out, "score-before.json")
  ];
};

export const receiptCommand = async (
  options: CertificationActionOptions,
  env: NodeJS.ProcessEnv = process.env
): Promise<string[]> => {
  const contract = await loadContract(options.out);
  const mission = await loadMission(options.mission);
  const traceEvents = await loadTrace(options.out, options.phase);
  const violations = await loadViolations(options.out, options.phase);
  const policyIdentity = await loadPolicyIdentity(options.out);
  const receiptId = `receipt-${options.phase}-001`;
  const generated = generateReadinessReceipt({
    id: receiptId,
    agent: specimenAgentDescriptor(options, env),
    environment: contract,
    policy: policyIdentity,
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
      createdAt: certificationCompiledAt,
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

export const rerunCommand = async (
  options: CertificationActionOptions,
  env: NodeJS.ProcessEnv = process.env
): Promise<string[]> => {
  const baseAdapter = await createSplunkAccessAdapter(options, env);
  const contract = await loadContract(options.out);
  const mission = await loadMission(options.mission);
  const policy = await readJson<AgentPolicy>(join(options.out, "agent-policy.json"), "agent policy");
  const adapter = maybeWrapFirewall(baseAdapter, contract, policy, options);
  const agent = llmEnabled(env) ? createLlmSpecimenAgent(contract, options, env) : new NaiveSpecimenAgent();
  let run: SpecimenAgentRun;

  try {
    run = await agent.run({ mission, adapter, policy });
  } catch (error) {
    if (isFirewallBlockedError(error)) {
      await writeFirewallBlockReport(options, "after", error);
    }

    throw error;
  }

  const violations = gradeTrace(contract, mission, run.traceEvents);
  const score = scoreMissionReadiness(mission, violations);
  const llmArtifacts = await writeLlmDeliberationArtifact(options.out, "after", run);

  await writeJson(join(options.out, "trace-after.json"), run.traceEvents);
  await writeJson(join(options.out, "violations-after.json"), violations);
  await writeJson(join(options.out, "score-after.json"), score);

  const beforeReceipt = readinessReceiptSchema.safeParse(
    await readJson(join(options.out, "receipt-before-001.json"), "before receipt")
  );
  const policyIdentity = await loadPolicyIdentity(options.out);
  const resolvedViolations = beforeReceipt.success
    ? beforeReceipt.data.violations.filter((violationId) => !violations.some((violation) => violation.id === violationId))
    : [];
  const generated = generateReadinessReceipt({
    id: "receipt-after-001",
    agent: specimenAgentDescriptor(options, env),
    environment: contract,
    policy: policyIdentity,
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
    ...llmArtifacts,
    join(options.out, "trace-after.json"),
    join(options.out, "violations-after.json"),
    join(options.out, "score-after.json"),
    join(options.out, "receipt-after-001.json"),
    join(options.out, "receipt-after-001.md")
  ];
};

export const firewallCheckCommand = async (
  options: CertificationActionOptions,
  env: NodeJS.ProcessEnv = process.env
): Promise<string[]> => {
  const firewallOptions: CertificationActionOptions = { ...options, firewall: true, requirePass: true };
  await Promise.all([
    removeOptionalFile(join(options.out, "firewall-block-before.json")),
    removeOptionalFile(join(options.out, "firewall-block-after.json")),
    removeOptionalFile(join(options.out, "proof-audit.json"))
  ]);

  const compileArtifacts = await compileCommand(options, env);

  try {
    const evaluateArtifacts = await evaluateCommand(firewallOptions, env);
    const reportPath = join(options.out, "firewall-check.json");
    await writeJson(reportPath, {
      status: "ALLOWED",
      phase: "before",
      mode: options.mode,
      mutation: false,
      blockedBeforeSplunk: false,
      message:
        "The specimen completed before-phase evaluation without a firewall block. Inspect trace-before.json and violations-before.json for deterministic readiness results.",
      artifacts: evaluateArtifacts
    });
    return [...compileArtifacts, ...evaluateArtifacts, reportPath];
  } catch (error) {
    if (!isFirewallBlockedError(error)) {
      throw error;
    }

    const blockPath = join(options.out, "firewall-block-before.json");
    const { artifacts: auditArtifacts } = await runProofAuditWorkflow({
      outDir: options.out,
      requirePass: firewallOptions.requirePass ?? false,
      generatedAt: certificationCompiledAt
    });
    return [...compileArtifacts, blockPath, ...auditArtifacts];
  }
};

export const defaultFixtureCertificationOptions = (outDir: string): CertificationActionOptions => ({
  mode: "fixture",
  fixture: defaultFixturePath,
  mission: defaultMissionPath,
  out: outDir,
  phase: "before",
  firewall: false,
  agentModel: ""
});

export const fixtureCertificationSteps = (
  options: CertificationActionOptions,
  env: NodeJS.ProcessEnv = process.env
): FixtureCertificationWorkflowSteps => {
  const beforeOptions = { ...options, phase: "before" as const };
  const afterOptions = { ...options, phase: "after" as const };

  return {
    compile: () => compileCommand(beforeOptions, env),
    evaluate: () => evaluateCommand(beforeOptions, env),
    receiptBefore: () => receiptCommand(beforeOptions, env),
    rerun: () => rerunCommand(afterOptions, env),
    receiptAfter: async () => [join(options.out, "receipt-after-001.json"), join(options.out, "receipt-after-001.md")],
    writeUiShell: () => writeUiShell(options.out),
    proofAudit: async () => {
      const { artifacts } = await runProofAuditWorkflow({
        outDir: options.out,
        requirePass: false,
        generatedAt: certificationCompiledAt
      });
      return artifacts;
    }
  };
};
