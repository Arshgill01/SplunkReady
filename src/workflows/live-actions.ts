import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  createHttpLiveSplunkTransport,
  createLiveSplunkAccessAdapter,
  createLiveSplunkAdapterConfigFromEnv
} from "../adapters/live.js";
import { compileEnvironmentContract } from "../compiler/environment.js";
import { compileReadinessProfile } from "../compiler/readiness-profile.js";
import {
  liveSecurityKitCleanupGuidance,
  liveSecurityKitOperatorWarnings,
  validateLiveSecurityKit
} from "../live-security-kit/validator.js";
import { deriveLiveMission, type LiveSavedSearchCandidateResult } from "../missions/live.js";
import {
  readinessReceiptSchema,
  type EnvironmentContract,
  type PolicyPatch,
  type ReadOnlySplunkToolName
} from "../schemas/core.js";
import {
  certificationCompiledAt,
  certificationGeneratedAt,
  compileCommand,
  compileContract,
  createSplunkAccessAdapter,
  defaultFixturePath,
  defaultMissionPath,
  evaluateCommand,
  llmEnabled,
  loadContract,
  loadMission,
  readOptionalPolicyPatch,
  receiptCommand,
  rerunCommand,
  writeCompiledArtifacts,
  type CertificationActionOptions
} from "./certification-actions.js";
import { hostedModelToolNames, writeHostedModelProofArtifact } from "./hosted-model-actions.js";
import { classifyProofLoop, runProofAuditWorkflow } from "./proof-audit.js";

export type LiveActionWorkflow =
  | "live-smoke"
  | "live-candidates"
  | "live-security-readiness"
  | "live-security-kit"
  | "live-security-proof";

export interface LiveActionWorkflowInput {
  outDir: string;
  fixturePath?: string;
  missionPath?: string;
  requireLive?: boolean;
  requirePass?: boolean;
  candidateLimit?: number;
  compileFirst?: boolean;
  firewall?: boolean;
  agentModel?: string;
  liveMock?: boolean;
}

export interface LiveSecurityUiBundleInput {
  outDir: string;
  proofDir: string;
  securityCheckDir: string;
  securityKitDir: string;
  hostedModelProofDir: string;
}

export interface LiveActionWorkflowResult {
  status: "PASS" | "SKIP";
  outDir: string;
  artifacts: string[];
  mutation: false;
  messages: string[];
}

const liveSmokeInventoryTools: ReadOnlySplunkToolName[] = [
  "splunk_get_info",
  "splunk_get_user_info",
  "splunk_get_indexes",
  "splunk_get_metadata",
  "splunk_get_knowledge_objects"
];
const liveSmokeNotCalledTools: ReadOnlySplunkToolName[] = [
  "splunk_run_query",
  "splunk_run_saved_search",
  "saia_explain_spl",
  "saia_optimize_spl"
];

const flagshipSecuritySavedSearch = {
  app: "SplunkEnterpriseSecuritySuite",
  name: "ES - Lateral Movement Auth Chain",
  ref: "SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain"
};

const flagshipLiveSecuritySetupRequirements = [
  {
    id: "saved-search",
    description: `Read-only saved search ${flagshipSecuritySavedSearch.ref} exists in the live contract.`
  },
  {
    id: "evidence-rows",
    description: "Saved search returns at least one row for win-finance-07 in the -24h to now mission window."
  },
  {
    id: "evidence-identifiers",
    description: "Returned rows expose stable evidence identifiers such as eventRef, _cd, _raw, or _time."
  },
  {
    id: "operator-owned-setup",
    description: "Any missing app, index, saved search, or sample event setup is performed by the operator, not SplunkReady."
  }
] as const;

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

const liveCertificationOptions = (
  input: LiveActionWorkflowInput,
  overrides: Partial<CertificationActionOptions> = {}
): CertificationActionOptions => ({
  mode: "live",
  fixture: input.fixturePath ?? defaultFixturePath,
  mission: input.missionPath ?? defaultMissionPath,
  out: input.outDir,
  phase: "before",
  firewall: input.firewall ?? false,
  agentModel: input.agentModel ?? "",
  requirePass: input.requirePass,
  liveMock: input.liveMock ?? false,
  ...overrides
});

const formatWorkflowError = (error: unknown): string => {
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

const stringFromRecord = (value: unknown, key: string): string | undefined => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field : undefined;
};

const summarizeHostedModels = (
  contract: EnvironmentContract,
  policyPatch: PolicyPatch | undefined,
  hostedModelProof?: unknown
): {
  status: "invoked" | "available_not_applicable" | "unavailable";
  availableTools: ReadOnlySplunkToolName[];
  missingTools: ReadOnlySplunkToolName[];
  assistanceItems: number;
  notes: string;
} => {
  const contractTools = new Set(contract.mcpTools);
  const availableTools = hostedModelToolNames.filter((toolName) => contractTools.has(toolName));
  const missingTools = hostedModelToolNames.filter((toolName) => !contractTools.has(toolName));
  const patchAssistanceItems = policyPatch?.splAssistance?.length ?? 0;
  const hostedModelProofStatus = stringFromRecord(hostedModelProof, "status");
  const hostedModelProofInvoked = hostedModelProofStatus === "PASS";
  const assistanceItems = patchAssistanceItems > 0 ? patchAssistanceItems : hostedModelProofInvoked ? 1 : 0;

  if (patchAssistanceItems > 0) {
    return {
      status: "invoked",
      availableTools,
      missingTools,
      assistanceItems,
      notes:
        "SAIA explain/optimize returned advisory output for SPL-rule violations. Deterministic rules remained authoritative for pass/fail."
    };
  }

  if (hostedModelProofInvoked) {
    return {
      status: "invoked",
      availableTools,
      missingTools,
      assistanceItems,
      notes:
        "SAIA explain/optimize returned advisory output in hosted-model proof mode. The SPL was not executed; deterministic rules remained authoritative for pass/fail."
    };
  }

  if (hostedModelProofStatus === "BLOCKED") {
    return {
      status: "unavailable",
      availableTools,
      missingTools,
      assistanceItems,
      notes:
        "Hosted-model tools were advertised but could not be invoked with the current MCP credentials or entitlement."
    };
  }

  if (missingTools.length > 0) {
    return {
      status: "unavailable",
      availableTools,
      missingTools,
      assistanceItems,
      notes:
        "The contract did not expose both hosted-model tools, so no SAIA explain/optimize evidence could be collected for this proof."
    };
  }

  return {
    status: "available_not_applicable",
    availableTools,
    missingTools,
    assistanceItems,
    notes:
      "SAIA explain/optimize tools were available, but this proof did not produce SPL-rule violations with query evidence."
  };
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

export const runLiveSmokeWorkflow = async (
  input: LiveActionWorkflowInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<LiveActionWorkflowResult> => {
  const missingFields = liveSmokeMissingEnvFields(env);

  if (missingFields.length > 0) {
    const message = [
      `Live smoke skipped; missing ${missingFields.join(", ")}.`,
      "No live Splunk calls were made and no live artifacts were written.",
      "Fixture commands still run without live credentials.",
      "See docs/live-adapter.md for the opt-in setup checklist."
    ].join(" ");

    if (input.requireLive ?? true) {
      throw new Error(message);
    }

    return { status: "SKIP", outDir: input.outDir, artifacts: [], mutation: false, messages: [message] };
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
    generatedAt: certificationGeneratedAt,
    metadataTimeWindow,
    queryBudgets: {
      maxToolCalls: 5,
      maxResultRows: 1,
      timeoutSeconds: 30
    }
  });
  const mission = await loadMission(input.missionPath ?? defaultMissionPath);
  const readinessProfile = compileReadinessProfile(contract, [mission], {
    profileVersion: "live-smoke-profile-2026.06.01",
    generatedAt: certificationCompiledAt
  });
  const contractPath = join(input.outDir, "live-smoke-contract.json");
  const profilePath = join(input.outDir, "live-smoke-readiness-profile.json");
  const summaryPath = join(input.outDir, "live-smoke-summary.json");

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

  return {
    status: "PASS",
    outDir: input.outDir,
    artifacts: [contractPath, profilePath, summaryPath],
    mutation: false,
    messages: []
  };
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

export const runLiveSecurityKitWorkflow = async (
  input: LiveActionWorkflowInput
): Promise<LiveActionWorkflowResult> => {
  const kitGeneratedAt = new Date();
  const appRoot = join(input.outDir, flagshipSecuritySavedSearch.app);
  const appConfPath = join(appRoot, "default", "app.conf");
  const indexesPath = join(appRoot, "default", "indexes.conf");
  const propsPath = join(appRoot, "default", "props.conf");
  const savedSearchesPath = join(appRoot, "default", "savedsearches.conf");
  const sampleEventsPath = join(input.outDir, "lateral-movement-events.csv");
  const readmePath = join(input.outDir, "README.md");
  const manifestPath = join(input.outDir, "live-security-kit.json");

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
cd ${input.outDir}

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

## Cleanup

Cleanup is operator-owned and outside SplunkReady. SplunkReady does not remove app content, indexes, saved searches, or ingested events.

- On a disposable trial, remove or disable the generated \`${flagshipSecuritySavedSearch.app}\` app through normal Splunk admin controls.
- Delete imported sample events only in an approved disposable environment.
- Do not run destructive cleanup against production data or an existing Enterprise Security deployment.
`
  );
  const validation = await validateLiveSecurityKit(input.outDir);

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
    validation,
    operatorWarnings: [...liveSecurityKitOperatorWarnings],
    cleanupGuidance: [...liveSecurityKitCleanupGuidance],
    artifacts: [appConfPath, indexesPath, propsPath, savedSearchesPath, sampleEventsPath, readmePath]
  });

  if (validation.status !== "PASS") {
    throw new Error(`Generated live security kit failed validation: ${validation.checks.filter((check) => check.status === "FAIL").map((check) => check.id).join(", ")}`);
  }

  return {
    status: "PASS",
    outDir: input.outDir,
    artifacts: [manifestPath, appConfPath, indexesPath, propsPath, savedSearchesPath, sampleEventsPath, readmePath],
    mutation: false,
    messages: ["Generated local operator-owned security kit. SplunkReady performed no Splunk write operation."]
  };
};

export const runLiveSecurityReadinessWorkflow = async (
  input: LiveActionWorkflowInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<LiveActionWorkflowResult> => {
  const options = liveCertificationOptions(input);
  const contract = await compileContract(options, env);
  const contractPath = join(input.outDir, "environment-contract.json");

  await writeJson(contractPath, contract);

  const adapter = await createSplunkAccessAdapter(options, env);
  const requiredTools: ReadOnlySplunkToolName[] = ["splunk_get_knowledge_objects", "splunk_run_saved_search"];
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
        error: formatWorkflowError(error)
      };
    }
  }

  const hasRows = runResult.attempted && typeof runResult.resultCount === "number" && runResult.resultCount > 0;
  const hasEvidenceRefs = runResult.attempted && runResult.evidenceRefs.length > 0;
  const ready = missingTools.length === 0 && Boolean(exactSavedSearch) && hasRows && hasEvidenceRefs;
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
      "Run live-security-proof with LLM mode enabled; the deployment has the saved-search evidence needed for the flagship live security path."
    );
  }

  const reportPath = join(input.outDir, "live-security-readiness.json");

  await writeJson(reportPath, {
    status: ready ? "READY_FOR_FLAGSHIP_LIVE_SECURITY_PROOF" : "BLOCKED",
    mode: "live",
    mutation: false,
    proofMode: {
      type: "strict-flagship-security",
      fallbackAllowed: false,
      rationale:
        "The flagship lateral-movement proof requires the exact saved search and row-level evidence. It does not fall back to generic _internal proof."
    },
    mission: {
      id: "mission-security-lateral-movement-readiness",
      story: "security investigation readiness"
    },
    setupRequirements: flagshipLiveSecuritySetupRequirements.map((requirement) => ({
      ...requirement,
      satisfied:
        requirement.id === "saved-search"
          ? Boolean(exactSavedSearch)
          : requirement.id === "evidence-rows"
            ? hasRows
            : requirement.id === "evidence-identifiers"
              ? hasEvidenceRefs
              : true,
      operatorOwned: true
    })),
    fallbackPolicy: {
      genericLiveCommand: "live-proof",
      genericLiveDescription:
        "Use live-proof only as generic live MCP evidence when the target deployment lacks flagship security content.",
      flagshipProofCommand: "live-security-proof",
      flagshipDescription:
        "Use live-security-proof for the prize/demo lateral-movement story after operator-owned setup makes readiness green."
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

  return { status: "PASS", outDir: input.outDir, artifacts: [contractPath, reportPath], mutation: false, messages: [] };
};

export const runLiveSecurityUiBundleWorkflow = async (input: LiveSecurityUiBundleInput): Promise<LiveActionWorkflowResult> => {
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
    "hosted-model-proof.json",
    "hosted-model-diagnostic.json",
    "score-before.json",
    "score-after.json"
  ];
  const artifacts: string[] = [];
  const missingOptional: string[] = [];

  for (const fileName of requiredProofFiles) {
    artifacts.push(await copyRequiredArtifact(input.proofDir, input.outDir, fileName, `live proof artifact ${fileName}`));
  }

  for (const fileName of optionalProofFiles) {
    const copied = await copyOptionalArtifact(input.proofDir, input.outDir, fileName);

    if (copied) {
      artifacts.push(copied);
    } else {
      missingOptional.push(join(input.proofDir, fileName));
    }
  }

  artifacts.push(
    await copyRequiredArtifact(
      input.securityCheckDir,
      input.outDir,
      "live-security-readiness.json",
      "live security readiness report"
    )
  );
  artifacts.push(
    await copyRequiredArtifact(input.securityKitDir, input.outDir, "live-security-kit.json", "live security operator kit manifest")
  );

  if (!artifacts.some((artifact) => artifact.endsWith("hosted-model-proof.json"))) {
    const hostedModelProof = await copyOptionalArtifact(input.hostedModelProofDir, input.outDir, "hosted-model-proof.json");

    if (hostedModelProof) {
      artifacts.push(hostedModelProof);
    } else {
      missingOptional.push(join(input.hostedModelProofDir, "hosted-model-proof.json"));
    }
  }

  if (!artifacts.some((artifact) => artifact.endsWith("hosted-model-diagnostic.json"))) {
    const hostedModelDiagnostic = await copyOptionalArtifact(
      input.hostedModelProofDir,
      input.outDir,
      "hosted-model-diagnostic.json"
    );

    if (hostedModelDiagnostic) {
      artifacts.push(hostedModelDiagnostic);
    } else {
      missingOptional.push(join(input.hostedModelProofDir, "hosted-model-diagnostic.json"));
    }
  }

  const summaryPath = join(input.outDir, "live-security-ui-bundle.json");

  await writeJson(summaryPath, {
    status: "PASS",
    mutation: false,
    proofDir: input.proofDir,
    securityCheckDir: input.securityCheckDir,
    securityKitDir: input.securityKitDir,
    hostedModelProofDir: input.hostedModelProofDir,
    artifacts,
    missingOptional
  });
  artifacts.push(summaryPath);

  return { status: "PASS", outDir: input.outDir, artifacts, mutation: false, messages: [] };
};

const liveCandidatesArtifacts = async (
  input: LiveActionWorkflowInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<string[]> => {
  const options = liveCertificationOptions(input);
  const contract = await loadContract(input.outDir);
  const adapter = await createSplunkAccessAdapter(options, env);
  const candidates = sortedSavedSearchCandidates(contract.savedSearches, input.candidateLimit ?? 12);
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
        error: formatWorkflowError(error)
      });
    }
  }

  const reportPath = join(input.outDir, "live-candidates.json");
  const derived = deriveLiveMission(contract, results);
  const derivedMissionPath = join(input.outDir, "live-derived-mission.json");
  const derivedProfilePath = join(input.outDir, "live-derived-readiness-profile.json");
  const artifacts = [reportPath];

  if (derived.mission) {
    const readinessProfile = compileReadinessProfile(contract, [derived.mission], {
      profileVersion: "live-derived-profile-2026.06.01",
      generatedAt: certificationCompiledAt
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

export const runLiveCandidatesWorkflow = async (
  input: LiveActionWorkflowInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<LiveActionWorkflowResult> => {
  const options = liveCertificationOptions(input);
  const compileArtifacts = input.compileFirst ?? true ? await compileCommand(options, env) : [];
  const candidateArtifacts = await liveCandidatesArtifacts(input, env);

  return {
    status: "PASS",
    outDir: input.outDir,
    artifacts: [...new Set([...compileArtifacts, ...candidateArtifacts])],
    mutation: false,
    messages: []
  };
};

export const runLiveProofWorkflow = async (
  input: LiveActionWorkflowInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<LiveActionWorkflowResult> => {
  const options = liveCertificationOptions(input);
  const contract = await compileContract(options, env);
  const contractPath = join(input.outDir, "environment-contract.json");

  await writeJson(contractPath, contract);

  const candidateArtifacts = await liveCandidatesArtifacts(input, env);
  const candidateReport = await readJson<{
    derivedMission?: { strategy: string; reason: string; missionId?: string };
  }>(join(input.outDir, "live-candidates.json"), "live candidates report");
  const derivedMissionPath = join(input.outDir, "live-derived-mission.json");

  if (!candidateReport.derivedMission?.missionId) {
    throw new Error(
      `live-proof could not derive a runnable mission. ${candidateReport.derivedMission?.reason ?? "Run live-candidates for details."}`
    );
  }

  const mission = await loadMission(derivedMissionPath);
  const compileArtifacts = await writeCompiledArtifacts(input.outDir, contract, mission, {
    policyVersion: "live-derived-policy-2026.06.01",
    profileVersion: "live-derived-profile-2026.06.01"
  });
  const runOptions = liveCertificationOptions({ ...input, missionPath: derivedMissionPath });
  const evaluateArtifacts = await evaluateCommand(runOptions, env);
  const receiptArtifacts = await receiptCommand(runOptions, env);
  const rerunArtifacts = await rerunCommand(runOptions, env);
  const beforeReceipt = readinessReceiptSchema.parse(
    await readJson(join(input.outDir, "receipt-before-001.json"), "before receipt")
  );
  const afterReceipt = readinessReceiptSchema.parse(
    await readJson(join(input.outDir, "receipt-after-001.json"), "after receipt")
  );
  const policyPatch = await readOptionalPolicyPatch(input.outDir);
  const hostedModels = summarizeHostedModels(contract, policyPatch);
  const summaryPath = join(input.outDir, "live-proof-summary.json");
  const proofLoop = classifyProofLoop(beforeReceipt, afterReceipt);

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
    proofLoop,
    hostedModels,
    notes:
      proofLoop === "ready-without-patch"
        ? "The live-derived mission was already ready before policy injection; this proves live certification but not the fail-to-pass patch loop."
        : proofLoop === "fail-to-pass"
          ? "The live-derived mission exercised a NOT READY -> READY patch loop."
          : "The live-derived mission ran against live Splunk MCP tools; inspect receipts for remaining readiness state."
  });

  return {
    status: "PASS",
    outDir: input.outDir,
    artifacts: [
      ...new Set([
        contractPath,
        ...candidateArtifacts,
        ...compileArtifacts,
        ...evaluateArtifacts,
        ...receiptArtifacts,
        ...rerunArtifacts,
        summaryPath
      ])
    ],
    mutation: false,
    messages: []
  };
};

export const runLiveSecurityProofArtifacts = async (
  input: LiveActionWorkflowInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<string[]> => {
  if (!llmEnabled(env)) {
    throw new Error("live-security-proof requires SPLUNKREADY_LLM_ENABLED=true so the certified specimen is a real LLM agent.");
  }

  const options = liveCertificationOptions(input, { requirePass: true });
  const checkResult = await runLiveSecurityReadinessWorkflow(input, env);
  const readiness = await readJson<{
    status: string;
    blockers?: string[];
    nextActions?: string[];
  }>(join(input.outDir, "live-security-readiness.json"), "live security readiness report");

  if (readiness.status !== "READY_FOR_FLAGSHIP_LIVE_SECURITY_PROOF") {
    const blockers = readiness.blockers && readiness.blockers.length > 0 ? readiness.blockers.join(" ") : "No blockers were reported.";
    const nextActions =
      readiness.nextActions && readiness.nextActions.length > 0
        ? ` Next actions: ${readiness.nextActions.join(" ")}`
        : "";

    throw new Error(`live-security-proof is blocked: ${blockers}${nextActions}`);
  }

  const compileArtifacts = await compileCommand(options, env);
  const evaluateArtifacts = await evaluateCommand(options, env);
  const receiptArtifacts = await receiptCommand(options, env);
  const rerunArtifacts = await rerunCommand(options, env);
  const beforeReceipt = readinessReceiptSchema.parse(
    await readJson(join(input.outDir, "receipt-before-001.json"), "before receipt")
  );
  const afterReceipt = readinessReceiptSchema.parse(
    await readJson(join(input.outDir, "receipt-after-001.json"), "after receipt")
  );
  const contract = await loadContract(input.outDir);
  const policyPatch = await readOptionalPolicyPatch(input.outDir);
  const hostedModelProofPath = await writeHostedModelProofArtifact(
    { outDir: input.outDir, mode: "live" },
    await createSplunkAccessAdapter(options, env),
    contract
  );
  const hostedModelProof = await readJson<unknown>(hostedModelProofPath, "hosted model proof");
  const hostedModels = summarizeHostedModels(contract, policyPatch, hostedModelProof);
  const liveProofSummaryPath = join(input.outDir, "live-proof-summary.json");
  const securitySummaryPath = join(input.outDir, "live-security-proof-summary.json");
  const failToPass = beforeReceipt.verdict === "NOT READY" && afterReceipt.verdict === "READY";
  const readyAfterPatch = afterReceipt.verdict === "READY";
  const proofLoop = classifyProofLoop(beforeReceipt, afterReceipt);

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
    proofLoop,
    hostedModels,
    notes: proofLoop === "fail-to-pass"
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
    proofLoop,
    hostedModels,
    notes: proofLoop === "fail-to-pass"
      ? "The flagship live security mission completed the LLM fail -> patch -> rerun -> pass path against read-only Splunk MCP tools."
      : "The flagship live security mission ran against live Splunk MCP tools; inspect receipts for remaining readiness state."
  });

  return [
    ...new Set([
      ...checkResult.artifacts,
      ...compileArtifacts,
      ...evaluateArtifacts,
      ...receiptArtifacts,
      ...rerunArtifacts,
      hostedModelProofPath,
      liveProofSummaryPath,
      securitySummaryPath
    ])
  ];
};

export const runLiveSecurityProofWorkflow = async (
  input: LiveActionWorkflowInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<LiveActionWorkflowResult> => {
  const proofArtifacts = await runLiveSecurityProofArtifacts(input, env);
  const audit = await runProofAuditWorkflow({
    outDir: input.outDir,
    requirePass: input.requirePass ?? false,
    generatedAt: certificationCompiledAt
  });

  return {
    status: "PASS",
    outDir: input.outDir,
    artifacts: [...new Set([...proofArtifacts, ...audit.artifacts])],
    mutation: false,
    messages: []
  };
};
