import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  environmentContractSchema,
  policyPatchSchema,
  readinessProfileSchema,
  readinessReceiptSchema,
  traceEventSchema,
  violationSchema,
  type EnvironmentContract,
  type PolicyPatch,
  type ReadinessProfile,
  type ReadinessReceipt,
  type TraceEvent,
  type Violation
} from "../schemas/core.js";
import { parseMissionDefinition, type MissionDefinition } from "../missions/dsl.js";

export interface UiArtifactPaths {
  contract?: string;
  missions?: string;
  beforeTrace?: string;
  beforeViolations?: string;
  afterTrace?: string;
  afterViolations?: string;
  beforeReceipt?: string;
  afterReceipt?: string;
  policyPatchJson?: string;
  policyPatchMarkdown?: string;
  readinessProfile?: string;
  receipt: string;
  trace: string;
  violations: string;
}

export interface UiArtifacts {
  phase: "before" | "after";
  outDir: string;
  contract?: EnvironmentContract;
  missions: MissionDefinition[];
  receipt: ReadinessReceipt;
  beforeReceipt?: ReadinessReceipt;
  afterReceipt?: ReadinessReceipt;
  policyPatch?: PolicyPatch;
  readinessProfile?: ReadinessProfile;
  traceEvents: TraceEvent[];
  violations: Violation[];
  beforeTraceEvents?: TraceEvent[];
  beforeViolations?: Violation[];
  afterTraceEvents?: TraceEvent[];
  afterViolations?: Violation[];
  paths: UiArtifactPaths;
}

const exists = async (path: string): Promise<boolean> =>
  stat(path)
    .then(() => true)
    .catch(() => false);

const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8"));

const readOptionalTrace = async (path: string): Promise<TraceEvent[]> => {
  if (!(await exists(path))) {
    return [];
  }

  return traceEventSchema.array().parse(await readJson(path));
};

const readOptionalViolations = async (path: string): Promise<Violation[]> => {
  if (!(await exists(path))) {
    return [];
  }

  return violationSchema.array().parse(await readJson(path));
};

const readOptionalReceipt = async (path: string): Promise<ReadinessReceipt | undefined> => {
  if (!(await exists(path))) {
    return undefined;
  }

  return readinessReceiptSchema.parse(await readJson(path));
};

const readOptionalPolicyPatch = async (path: string): Promise<PolicyPatch | undefined> => {
  if (!(await exists(path))) {
    return undefined;
  }

  return policyPatchSchema.parse(await readJson(path));
};

const readOptionalContract = async (path: string): Promise<EnvironmentContract | undefined> => {
  if (!(await exists(path))) {
    return undefined;
  }

  return environmentContractSchema.parse(await readJson(path));
};

const readOptionalReadinessProfile = async (path: string): Promise<ReadinessProfile | undefined> => {
  if (!(await exists(path))) {
    return undefined;
  }

  return readinessProfileSchema.parse(await readJson(path));
};

const readOptionalMissions = async (path: string): Promise<MissionDefinition[]> => {
  if (!(await exists(path))) {
    return [];
  }

  const input = await readJson(path);

  if (!Array.isArray(input)) {
    throw new Error(`Expected missions artifact at ${path} to be an array.`);
  }

  return input.map((mission) => parseMissionDefinition(mission));
};

const currentReceiptPath = async (outDir: string): Promise<{ phase: "before" | "after"; path: string }> => {
  const afterPath = join(outDir, "receipt-after-001.json");

  if (await exists(afterPath)) {
    return { phase: "after", path: afterPath };
  }

  const beforePath = join(outDir, "receipt-before-001.json");

  if (await exists(beforePath)) {
    return { phase: "before", path: beforePath };
  }

  throw new Error(
    `Unable to load a Readiness Receipt from ${outDir}. Run the SplunkReady CLI receipt or rerun command first.`
  );
};

export const loadUiArtifacts = async (outDir: string): Promise<UiArtifacts> => {
  const current = await currentReceiptPath(outDir);
  const receipt = readinessReceiptSchema.parse(await readJson(current.path));
  const contractPath = join(outDir, "environment-contract.json");
  const missionsPath = join(outDir, "missions.json");
  const beforeTracePath = join(outDir, "trace-before.json");
  const beforeViolationsPath = join(outDir, "violations-before.json");
  const afterTracePath = join(outDir, "trace-after.json");
  const afterViolationsPath = join(outDir, "violations-after.json");
  const beforeReceiptPath = join(outDir, "receipt-before-001.json");
  const afterReceiptPath = join(outDir, "receipt-after-001.json");
  const policyPatchPath = join(outDir, "policy-patch.json");
  const policyPatchMarkdownPath = join(outDir, "policy-patch.md");
  const readinessProfilePath = join(outDir, "readiness-profile.json");
  const tracePath = join(outDir, `trace-${current.phase}.json`);
  const violationPath = join(outDir, `violations-${current.phase}.json`);
  const beforeTraceEvents = await readOptionalTrace(beforeTracePath);
  const beforeViolations = await readOptionalViolations(beforeViolationsPath);
  const afterTraceEvents = await readOptionalTrace(afterTracePath);
  const afterViolations = await readOptionalViolations(afterViolationsPath);

  return {
    phase: current.phase,
    outDir,
    contract: await readOptionalContract(contractPath),
    missions: await readOptionalMissions(missionsPath),
    receipt,
    beforeReceipt: await readOptionalReceipt(beforeReceiptPath),
    afterReceipt: await readOptionalReceipt(afterReceiptPath),
    policyPatch: await readOptionalPolicyPatch(policyPatchPath),
    readinessProfile: await readOptionalReadinessProfile(readinessProfilePath),
    traceEvents: current.phase === "after" ? afterTraceEvents : beforeTraceEvents,
    violations: current.phase === "after" ? afterViolations : beforeViolations,
    beforeTraceEvents,
    beforeViolations,
    afterTraceEvents,
    afterViolations,
    paths: {
      contract: contractPath,
      missions: missionsPath,
      beforeTrace: beforeTracePath,
      beforeViolations: beforeViolationsPath,
      afterTrace: afterTracePath,
      afterViolations: afterViolationsPath,
      beforeReceipt: beforeReceiptPath,
      afterReceipt: afterReceiptPath,
      policyPatchJson: policyPatchPath,
      policyPatchMarkdown: policyPatchMarkdownPath,
      readinessProfile: readinessProfilePath,
      receipt: current.path,
      trace: tracePath,
      violations: violationPath
    }
  };
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const escapeValue = (value: unknown): string => escapeHtml(String(value));

const truncate = (value: string, maxLength = 160): string =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;

const verdictClass = (verdict: string): string => {
  if (verdict === "READY") {
    return "verdict-ready";
  }

  if (verdict === "NEEDS REVIEW") {
    return "verdict-review";
  }

  return "verdict-blocked";
};

const renderList = (values: string[], emptyText: string): string => {
  if (values.length === 0) {
    return `<p class="empty">${escapeHtml(emptyText)}</p>`;
  }

  return `<ul>${values.map((value) => `<li><code>${escapeHtml(value)}</code></li>`).join("")}</ul>`;
};

const renderRefGroup = (label: string, values: string[], emptyText: string): string =>
  `<div class="ref-group">
    <h3>${escapeHtml(label)}</h3>
    ${renderList(values, emptyText)}
  </div>`;

const renderEmptyTableRow = (columnCount: number, message: string): string =>
  `<tr><td colspan="${columnCount}">${escapeHtml(message)}</td></tr>`;

const renderViolations = (violations: Violation[]): string => {
  if (violations.length === 0) {
    return `<p class="empty">No violations in the current receipt phase.</p>`;
  }

  const rows = violations
    .map(
      (violation) => `<tr>
        <td><code>${escapeHtml(violation.id)}</code></td>
        <td>${escapeHtml(violation.severity)}</td>
        <td><code>${escapeHtml(violation.ruleId)}</code></td>
        <td>${escapeHtml(violation.reason)}</td>
      </tr>`
    )
    .join("");

  return `<table>
    <thead>
      <tr><th>Violation</th><th>Severity</th><th>Rule</th><th>Reason</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
};

const renderTraceEvents = (events: TraceEvent[]): string => {
  if (events.length === 0) {
    return `<p class="empty">Trace file not loaded; receipt trace refs remain visible below.</p>`;
  }

  const rows = events
    .slice(0, 8)
    .map(
      (event) => `<tr>
        <td><code>${escapeHtml(event.id)}</code></td>
        <td>${escapeHtml(event.type)}</td>
        <td>${event.toolName ? `<code>${escapeHtml(event.toolName)}</code>` : "final answer"}</td>
        <td>${event.evidenceRefs.length}</td>
      </tr>`
    )
    .join("");

  const footer =
    events.length > 8
      ? `<tfoot><tr class="trace-limit-row"><td colspan="4">Showing 8 of ${escapeValue(events.length)} events. View full trace in the Mission trace section.</td></tr></tfoot>`
      : "";

  return `<table>
    <thead>
      <tr><th>Trace event</th><th>Type</th><th>Tool</th><th>Evidence refs</th></tr>
    </thead>
    <tbody>${rows}</tbody>
    ${footer}
  </table>`;
};

const renderIndexRows = (contract: EnvironmentContract): string => {
  if (contract.indexes.length === 0) {
    return renderEmptyTableRow(2, "No indexes compiled in contract.");
  }

  const restricted = new Set(contract.restrictedIndexes);

  return contract.indexes
    .map((index) => {
      const access = restricted.has(index.name) || index.sensitive ? "restricted" : "available";

      return `<tr>
        <td><code>${escapeHtml(index.name)}</code></td>
        <td>${escapeHtml(access)}</td>
      </tr>`;
    })
    .join("");
};

const renderSourcetypeRows = (contract: EnvironmentContract): string => {
  if (contract.sourcetypes.length === 0) {
    return renderEmptyTableRow(2, "No sourcetypes compiled in contract.");
  }

  return contract.sourcetypes
    .map(
      (sourcetype) => `<tr>
        <td><code>${escapeHtml(sourcetype.name)}</code></td>
        <td>${sourcetype.fields.map((field) => `<code>${escapeHtml(field)}</code>`).join(" ")}</td>
      </tr>`
    )
    .join("");
};

const renderCanonicalFieldRows = (contract: EnvironmentContract): string => {
  const rows = Object.entries(contract.canonicalFields).map(
    ([alias, canonical]) => `<tr>
      <td><code>${escapeHtml(alias)}</code></td>
      <td><code>${escapeHtml(canonical)}</code></td>
    </tr>`
  );

  for (const dataModel of contract.dataModels) {
    const metadata = dataModel.metadata;

    if (metadata && typeof metadata === "object" && "absentFields" in metadata && Array.isArray(metadata.absentFields)) {
      for (const absentField of metadata.absentFields) {
        rows.push(`<tr>
          <td><code>${escapeValue(absentField)}</code></td>
          <td>absent from ${escapeHtml(String(dataModel.name))}</td>
        </tr>`);
      }
    }
  }

  if (rows.length === 0) {
    return renderEmptyTableRow(2, "No canonical fields or absent fields compiled in contract.");
  }

  return rows.join("");
};

const preferredSavedSearchRefs = (missions: MissionDefinition[]): Set<string> =>
  new Set(missions.flatMap((mission) => mission.preferredSavedSearchRefs ?? []));

const renderSavedSearchRows = (contract: EnvironmentContract, missions: MissionDefinition[]): string => {
  if (contract.savedSearches.length === 0) {
    return renderEmptyTableRow(2, "No saved searches compiled in contract.");
  }

  const preferredRefs = preferredSavedSearchRefs(missions);

  return contract.savedSearches
    .map((savedSearch) => {
      const ref = `${savedSearch.app}::${savedSearch.name}`;
      const status = preferredRefs.has(ref) ? "preferred for mission" : "available";

      return `<tr>
        <td><code>${escapeHtml(ref)}</code></td>
        <td>${escapeHtml(status)}</td>
      </tr>`;
    })
    .join("");
};

const renderKnowledgeSummaryRows = (contract: EnvironmentContract): string => {
  const rows = [
    ["Macros", contract.macros.map((macro) => `${macro.app}::${macro.name}`)],
    ["Lookups", contract.lookups.map((lookup) => `${lookup.app}::${lookup.name}`)],
    ["Data models", contract.dataModels.map((dataModel) => String(dataModel.name))],
    ["App contexts", contract.appContexts]
  ];

  return rows
    .map(
      ([label, values]) => `<tr>
        <th>${escapeHtml(label as string)}</th>
        <td>${(values as string[]).length > 0 ? (values as string[]).map((value) => `<code>${escapeHtml(value)}</code>`).join(" ") : "None"}</td>
      </tr>`
    )
    .join("");
};

const renderEvidenceRuleRows = (contract: EnvironmentContract): string => {
  if (contract.evidenceRules.length === 0) {
    return `<tr><td colspan="2">No evidence rules compiled.</td></tr>`;
  }

  return contract.evidenceRules
    .map((rule) => {
      const id = typeof rule.id === "string" ? rule.id : "evidence-rule";
      const requirements = Object.entries(rule)
        .filter(([key]) => key !== "id")
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join(", ");

      return `<tr>
        <td><code>${escapeHtml(id)}</code></td>
        <td>${escapeHtml(requirements)}</td>
      </tr>`;
    })
    .join("");
};

const renderReadinessProfileRows = (profile: ReadinessProfile | undefined): string => {
  if (!profile) {
    return `<tr><td colspan="3">No readiness-profile.json artifact loaded.</td></tr>`;
  }

  const rows = profile.ruleBindings
    .slice(0, 8)
    .map(
      (binding) => `<tr>
        <td><code>${escapeHtml(binding.ruleId)}</code><br>${escapeHtml(binding.severity)}</td>
        <td>${escapeHtml(binding.source)}<br>${binding.contractRefs.map((ref) => `<code>${escapeHtml(ref)}</code>`).join(" ")}</td>
        <td>${binding.evidence.map((item) => `<code>${escapeHtml(item.ref)}</code>`).join(" ")}</td>
      </tr>`
    )
    .join("");
  const hiddenCount = Math.max(0, profile.ruleBindings.length - 8);
  const footer =
    hiddenCount > 0
      ? `<tr><td colspan="3">${escapeValue(hiddenCount)} additional deployment-bound rule(s) in readiness-profile.json.</td></tr>`
      : "";

  return `${rows}${footer}`;
};

const renderContractView = (artifacts: UiArtifacts): string => {
  if (!artifacts.contract) {
    return `<section id="contract" class="shell-section" data-route-panel="contract" aria-label="Environment contract">
      <h2>Environment contract</h2>
      <p class="empty">No environment-contract.json artifact loaded.</p>
    </section>`;
  }

  const { contract } = artifacts;

  return `<section id="contract" class="shell-section" data-route-panel="contract" aria-label="Environment contract">
    <h2>Environment contract</h2>
    <div class="contract-grid">
      <div>
        <h3>Indexes</h3>
        <table>
          <thead><tr><th>Index</th><th>Access</th></tr></thead>
          <tbody>${renderIndexRows(contract)}</tbody>
        </table>
      </div>
      <div>
        <h3>Sourcetype fields</h3>
        <table>
          <thead><tr><th>Sourcetype</th><th>Fields</th></tr></thead>
          <tbody>${renderSourcetypeRows(contract)}</tbody>
        </table>
      </div>
      <div>
        <h3>Canonical fields</h3>
        <table>
          <thead><tr><th>Observed or alias</th><th>Compiled contract guidance</th></tr></thead>
          <tbody>${renderCanonicalFieldRows(contract)}</tbody>
        </table>
      </div>
      <div>
        <h3>Saved searches</h3>
        <table>
          <thead><tr><th>Object ref</th><th>Use</th></tr></thead>
          <tbody>${renderSavedSearchRows(contract, artifacts.missions)}</tbody>
        </table>
      </div>
      <div>
        <h3>Knowledge graph summary</h3>
        <table>
          <tbody>${renderKnowledgeSummaryRows(contract)}</tbody>
        </table>
      </div>
      <div>
        <h3>Budgets and evidence rules</h3>
        <table>
          <tbody>
            <tr><th>maxToolCalls</th><td>${escapeValue(contract.queryBudgets.maxToolCalls)}</td></tr>
            <tr><th>maxResultRows</th><td>${escapeValue(contract.queryBudgets.maxResultRows)}</td></tr>
            <tr><th>timeoutSeconds</th><td>${escapeValue(contract.queryBudgets.timeoutSeconds)}</td></tr>
          </tbody>
        </table>
        <table class="stacked-table">
          <thead><tr><th>Evidence rule</th><th>Requirements</th></tr></thead>
          <tbody>${renderEvidenceRuleRows(contract)}</tbody>
        </table>
      </div>
      <div>
        <h3>Readiness profile</h3>
        <table>
          <thead><tr><th>Rule</th><th>Activation source</th><th>Evidence refs</th></tr></thead>
          <tbody>${renderReadinessProfileRows(artifacts.readinessProfile)}</tbody>
        </table>
      </div>
    </div>
  </section>`;
};

const renderMissionCheckBadges = (
  missionId: string,
  checks: string[],
  beforeViolations: Violation[],
  afterViolations: Violation[],
  hasAfterEvidence: boolean
): string => {
  if (checks.length === 0) {
    return "None";
  }

  const beforeRuleIds = new Set<string>(
    beforeViolations.filter((violation) => violation.missionId === missionId).map((violation) => violation.ruleId)
  );
  const afterRuleIds = new Set<string>(
    afterViolations.filter((violation) => violation.missionId === missionId).map((violation) => violation.ruleId)
  );

  return checks
    .map((checkId) => {
      const failedBefore = beforeRuleIds.has(checkId);
      const failedAfter = afterRuleIds.has(checkId);
      const status = failedAfter || (failedBefore && !hasAfterEvidence) ? "failed" : failedBefore ? "resolved" : "pass";

      return `<span class="check-badge check-badge-${status}" title="${escapeHtml(checkId)} ${status}">${escapeHtml(checkId)} ${status}</span>`;
    })
    .join(" ");
};

const renderMissionList = (
  missions: MissionDefinition[],
  beforeViolations: Violation[] = [],
  afterViolations: Violation[] = [],
  hasAfterEvidence = false
): string => {
  if (missions.length === 0) {
    return `<p class="empty">No missions artifact loaded.</p>`;
  }

  const rows = missions
    .map(
      (mission) => `<tr>
        <td><code>${escapeHtml(mission.id)}</code><br>${escapeHtml(mission.title)}</td>
        <td>${mission.expectedTools.map((tool) => `<code>${escapeHtml(tool)}</code>`).join(" ")}</td>
        <td>${(mission.preferredSavedSearchRefs ?? []).map((ref) => `<code>${escapeHtml(ref)}</code>`).join(" ") || "None"}</td>
        <td>${(mission.authorizedIndexes ?? []).map((index) => `<code>${escapeHtml(index)}</code>`).join(" ") || "None"}</td>
        <td>${renderMissionCheckBadges(mission.id, mission.checks, beforeViolations, afterViolations, hasAfterEvidence)}</td>
      </tr>`
    )
    .join("");

  return `<table>
    <thead><tr><th>Mission</th><th>Expected tools</th><th>Preferred saved search</th><th>Authorized indexes</th><th>Deterministic checks</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
};

const toolInputSummary = (event: TraceEvent): string => {
  if (!event.toolInput) {
    return event.toolOutputSummary ? truncate(event.toolOutputSummary) : "";
  }

  if ("query" in event.toolInput && typeof event.toolInput.query === "string") {
    return event.toolInput.query;
  }

  if ("name" in event.toolInput && typeof event.toolInput.name === "string") {
    const app = "app" in event.toolInput && typeof event.toolInput.app === "string" ? `${event.toolInput.app}::` : "";
    return `${app}${event.toolInput.name}`;
  }

  return truncate(JSON.stringify(event.toolInput));
};

const violationsByTraceEvent = (violations: Violation[]): Map<string, Violation[]> => {
  const grouped = new Map<string, Violation[]>();

  for (const violation of violations) {
    const current = grouped.get(violation.traceEventId) ?? [];
    if (!current.some((existing) => existing.id === violation.id)) {
      current.push(violation);
    }
    grouped.set(violation.traceEventId, current);
  }

  return grouped;
};

const renderInlineViolations = (violations: Violation[]): string => {
  if (violations.length === 0) {
    return "";
  }

  return `<ul class="inline-violations">
    ${violations
      .map(
        (violation) =>
          `<li><code>${escapeHtml(violation.id)}</code> ${escapeHtml(violation.severity)} <code>${escapeHtml(violation.ruleId)}</code>: ${escapeHtml(violation.reason)}</li>`
      )
      .join("")}
  </ul>`;
};

const renderTraceTimeline = (label: string, events: TraceEvent[], violations: Violation[]): string => {
  if (events.length === 0) {
    return `<div>
      <h3>${escapeHtml(label)}</h3>
      <p class="empty">No ${escapeHtml(label.toLowerCase())} trace artifact loaded.</p>
    </div>`;
  }

  const groupedViolations = violationsByTraceEvent(violations);
  const rows = events
    .map((event) => {
      const eventViolations = groupedViolations.get(event.id) ?? [];
      const evidence = event.evidenceRefs.length > 0 ? event.evidenceRefs.map((ref) => `<code>${escapeHtml(ref)}</code>`).join(" ") : "None";

      return `<tr>
        <td>${event.step ? escapeValue(event.step) : ""}</td>
        <td><code>${escapeHtml(event.id)}</code><br>${escapeHtml(event.type)}</td>
        <td>${event.toolName ? `<code>${escapeHtml(event.toolName)}</code>` : "final answer"}</td>
        <td><code>${escapeHtml(toolInputSummary(event))}</code></td>
        <td>${escapeValue(event.resultCount ?? "n/a")}</td>
        <td>${evidence}${renderInlineViolations(eventViolations)}</td>
      </tr>`;
    })
    .join("");

  return `<div>
    <h3>${escapeHtml(label)}</h3>
    <table class="timeline-table">
      <thead><tr><th>Step</th><th>Trace event</th><th>Tool</th><th>Input or summary</th><th>Results</th><th>Evidence and violations</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
};

const renderMissionTraceView = (artifacts: UiArtifacts): string => {
  const beforeTraceEvents = artifacts.beforeTraceEvents ?? (artifacts.phase === "before" ? artifacts.traceEvents : []);
  const beforeViolations = artifacts.beforeViolations ?? (artifacts.phase === "before" ? artifacts.violations : []);
  const afterTraceEvents = artifacts.afterTraceEvents ?? (artifacts.phase === "after" ? artifacts.traceEvents : []);
  const afterViolations = artifacts.afterViolations ?? (artifacts.phase === "after" ? artifacts.violations : []);
  const hasAfterEvidence = afterTraceEvents.length > 0 || artifacts.afterReceipt !== undefined;

  return `<section id="mission-trace" class="shell-section" data-route-panel="mission-trace" aria-label="Mission execution and MCP trace">
    <h2>Mission and trace</h2>
    ${renderMissionList(artifacts.missions, beforeViolations, afterViolations, hasAfterEvidence)}
    <div class="trace-phases">
      ${renderTraceTimeline("Failing trace before patch", beforeTraceEvents, beforeViolations)}
      ${renderTraceTimeline("Passing trace after patch", afterTraceEvents, afterViolations)}
    </div>
  </section>`;
};

const receiptSummaryRows = (receipt: ReadinessReceipt): string =>
  `<table>
    <tbody>
      <tr><th>Receipt</th><td><code>${escapeHtml(receipt.id)}</code></td></tr>
      <tr><th>Verdict</th><td>${escapeHtml(receipt.verdict)}</td></tr>
      <tr><th>Score</th><td>${escapeValue(receipt.score)}</td></tr>
      <tr><th>Violations</th><td>${escapeValue(receipt.violations.length)}</td></tr>
      <tr><th>Critical</th><td>${escapeValue(receipt.criticalViolations.length)}</td></tr>
    </tbody>
  </table>`;

const renderScoreComparison = (beforeReceipt: ReadinessReceipt | undefined, afterReceipt: ReadinessReceipt | undefined): string => {
  if (!beforeReceipt || !afterReceipt) {
    return `<p class="empty">Before and after receipts are both required for score comparison.</p>`;
  }

  const resolvedViolations = Array.isArray(afterReceipt.rerunComparison.resolvedViolations)
    ? afterReceipt.rerunComparison.resolvedViolations.map((value) => String(value))
    : beforeReceipt.violations.filter((violationId) => !afterReceipt.violations.includes(violationId));
  const uniqueResolvedViolations = [...new Set(resolvedViolations)];

  return `<table>
    <thead><tr><th>Before score</th><th>After score</th><th>Before verdict</th><th>After verdict</th><th>Resolved violations</th></tr></thead>
    <tbody>
      <tr>
        <td>${escapeValue(beforeReceipt.score)}</td>
        <td>${escapeValue(afterReceipt.score)}</td>
        <td>${escapeHtml(beforeReceipt.verdict)}</td>
        <td>${escapeHtml(afterReceipt.verdict)}</td>
        <td>${uniqueResolvedViolations.length > 0 ? uniqueResolvedViolations.map((id) => `<code>${escapeHtml(id)}</code>`).join(" ") : "None"}</td>
      </tr>
    </tbody>
  </table>`;
};

const renderPolicyPatch = (policyPatch: PolicyPatch | undefined): string => {
  if (!policyPatch) {
    return `<p class="empty">No policy-patch.json artifact loaded.</p>`;
  }

  const rules = policyPatch.rules
    .map(
      (rule) => `<tr>
        <td><code>${escapeHtml(rule.id)}</code></td>
        <td>${escapeHtml(rule.text)}</td>
      </tr>`
    )
    .join("");

  return `<table>
    <thead><tr><th>Patch rule</th><th>Text</th></tr></thead>
    <tbody>
      <tr><th>Patch</th><td><code>${escapeHtml(policyPatch.id)}</code></td></tr>
      <tr><th>Source receipt</th><td><code>${escapeHtml(policyPatch.sourceReceiptId)}</code></td></tr>
      <tr><th>Status</th><td>${escapeHtml(policyPatch.status)}</td></tr>
      ${rules}
    </tbody>
  </table>`;
};

const renderCriticalIssueFixPairs = (
  beforeReceipt: ReadinessReceipt | undefined,
  beforeViolations: Violation[],
  policyPatch: PolicyPatch | undefined
): string => {
  if (!beforeReceipt || beforeReceipt.criticalViolations.length === 0) {
    return `<p class="empty">No critical issues in the failed receipt.</p>`;
  }

  const violationById = new Map(beforeViolations.map((violation) => [violation.id, violation]));
  const patchRules = policyPatch?.rules ?? [];
  const criticalViolationIds = [...new Set(beforeReceipt.criticalViolations)];
  const matchingPatchRule = (violation: Violation | undefined, index: number): PolicyPatch["rules"][number] | undefined => {
    if (!violation) {
      return patchRules[index];
    }

    if (violation.ruleId.startsWith("EVD") || violation.ruleId.startsWith("ANS")) {
      return patchRules.find((rule) => rule.id.includes("evidence") || rule.text.toLowerCase().includes("evidence"));
    }

    if (violation.ruleId.startsWith("KO") || violation.ruleId === "SPL-003") {
      return patchRules.find((rule) => rule.id.includes("saved-search") || rule.text.toLowerCase().includes("saved search"));
    }

    if (violation.ruleId === "SPL-001" || violation.ruleId.startsWith("SAF")) {
      return patchRules.find((rule) => rule.id.includes("contract") || rule.text.toLowerCase().includes("contract"));
    }

    return patchRules[index];
  };

  const rows = criticalViolationIds
    .map((violationId, index) => {
      const violation = violationById.get(violationId);
      const patchRule = matchingPatchRule(violation, index);
      const fallbackFix = violation?.suggestedPolicyPatch;

      return `<tr>
        <td><code>${escapeHtml(violationId)}</code>${violation ? `<br><code>${escapeHtml(violation.ruleId)}</code> ${escapeHtml(violation.reason)}` : ""}</td>
        <td>${patchRule ? `<code>${escapeHtml(patchRule.id)}</code><br>${escapeHtml(patchRule.text)}` : escapeHtml(fallbackFix ?? "No patch rule mapped.")}</td>
      </tr>`;
    })
    .join("");

  return `<table>
    <thead><tr><th>Critical issue</th><th>Policy patch or fix</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
};

const uniqueStrings = (values: string[]): string[] => [...new Set(values.filter((value) => value.length > 0))];

const renderReplayCell = (label: string, value: string, options: { code?: boolean; className?: string } = {}): string =>
  `<div class="${options.className ? `cell ${escapeHtml(options.className)}` : "cell"}">
    <b>${escapeHtml(label)}</b>
    ${options.code ? `<code>${escapeHtml(value)}</code>` : `<span>${escapeHtml(value)}</span>`}
  </div>`;

const renderReplayTable = (rows: string, className = ""): string =>
  `<div class="tbl${className ? ` ${escapeHtml(className)}` : ""}">${rows}</div>`;

const contractBudgetSummary = (contract: EnvironmentContract | undefined): string => {
  if (!contract) {
    return "contract not loaded";
  }

  return `${contract.queryBudgets.maxToolCalls} calls / ${contract.queryBudgets.maxResultRows} rows / ${contract.queryBudgets.timeoutSeconds}s`;
};

const contractSavedSearchSummary = (contract: EnvironmentContract | undefined, missions: MissionDefinition[]): string => {
  if (!contract) {
    return "contract not loaded";
  }

  const preferredRefs = preferredSavedSearchRefs(missions);
  const preferred = contract.savedSearches
    .map((savedSearch) => `${savedSearch.app}::${savedSearch.name}`)
    .find((ref) => preferredRefs.has(ref));

  return preferred ?? `${contract.savedSearches.length} saved search(es) compiled`;
};

const contractIndexSummary = (contract: EnvironmentContract | undefined, mission: MissionDefinition | undefined): string => {
  if (!contract) {
    return "contract not loaded";
  }

  const authorized = mission?.authorizedIndexes ?? contract.indexes.filter((index) => !index.sensitive).map((index) => index.name);
  const restricted = contract.restrictedIndexes;

  return `allow ${authorized.join(", ") || "none"} / restrict ${restricted.join(", ") || "none"}`;
};

const renderContractReplayTable = (
  contract: EnvironmentContract | undefined,
  missions: MissionDefinition[],
  mission: MissionDefinition | undefined
): string =>
  renderReplayTable(
    [
      renderReplayCell("contract", contract ? `${contract.name} / ${contract.version}` : "environment-contract.json missing", {
        code: Boolean(contract)
      }),
      renderReplayCell("mission", mission?.title ?? "missions.json missing"),
      renderReplayCell("adapter mode", contract?.mode ?? "unknown"),
      renderReplayCell("budget", contractBudgetSummary(contract)),
      renderReplayCell("indexes", contractIndexSummary(contract, mission)),
      renderReplayCell("saved search", contractSavedSearchSummary(contract, missions), { code: Boolean(contract) })
    ].join(""),
    "col-3"
  );

const traceEvidenceSummary = (event: TraceEvent): string =>
  event.evidenceRefs.length > 0 ? event.evidenceRefs.join(", ") : "refs (none)";

const renderTraceReplayTable = (events: TraceEvent[], emptyMessage: string): string => {
  if (events.length === 0) {
    return `<p class="empty">${escapeHtml(emptyMessage)}</p>`;
  }

  return renderReplayTable(
    events
      .map((event, index) => {
        const step = event.step ?? index + 1;
        const tool = event.toolName ?? event.type;
        const summary = toolInputSummary(event) || event.toolOutputSummary || event.id;
        const results = event.resultCount === null ? "results n/a" : `results ${event.resultCount}`;

        return [
          renderReplayCell(String(step).padStart(2, "0"), event.type, { className: "step" }),
          renderReplayCell(tool, `${event.id} / ${summary}`, { code: Boolean(event.toolName) }),
          renderReplayCell(results, traceEvidenceSummary(event))
        ].join("");
      })
      .join(""),
    "col-3"
  );
};

const renderRuleReplayTable = (
  violations: Violation[],
  mission: MissionDefinition | undefined,
  readinessProfile: ReadinessProfile | undefined
): string => {
  const profileSummary = readinessProfile
    ? `${readinessProfile.ruleBindings.length} deployment-bound rules`
    : mission
      ? `${mission.checks.length} deterministic checks loaded`
      : "deterministic checks loaded";
  const sourceSummary = readinessProfile
    ? `${readinessProfile.deploymentSignals.savedSearchCount} saved searches / ${readinessProfile.deploymentSignals.restrictedIndexCount} restricted indexes`
    : "contract profile missing";

  if (violations.length === 0) {
    return renderReplayTable(
      [
        renderReplayCell("rules", profileSummary),
        renderReplayCell("profile source", sourceSummary),
        renderReplayCell("violations", "0 active violations in this trace"),
        renderReplayCell("judge", "deterministic rule engine")
      ].join(""),
      "col-3"
    );
  }

  return renderReplayTable(
    [
      renderReplayCell("profile", profileSummary),
      renderReplayCell("source", sourceSummary),
      renderReplayCell("judge", "deterministic rule engine"),
      ...violations.map((violation) =>
        [
          renderReplayCell(violation.ruleId, violation.severity),
          renderReplayCell(violation.traceEventId, violation.reason),
          renderReplayCell("patch hint", violation.suggestedPolicyPatch)
        ].join("")
      )
    ].join(""),
    "col-3"
  );
};

const renderPatchReplayTable = (policyPatch: PolicyPatch | undefined): string => {
  if (!policyPatch) {
    return `<p class="empty">No policy-patch.json artifact loaded.</p>`;
  }

  const rows = [
    renderReplayCell("patch", `${policyPatch.id} / ${policyPatch.status}`, { code: true }),
    renderReplayCell("source receipt", policyPatch.sourceReceiptId, { code: true }),
    ...policyPatch.rules.map((rule, index) =>
      [
        renderReplayCell(`+${index + 1}`, rule.id, { code: true }),
        renderReplayCell("rule text", rule.text),
        renderReplayCell("handling", "exported for review / no auto-apply")
      ].join("")
    )
  ];

  return renderReplayTable(rows.join(""), "col-patch");
};

const renderReceiptReplayTable = (
  beforeReceipt: ReadinessReceipt | undefined,
  afterReceipt: ReadinessReceipt | undefined,
  afterViolations: Violation[],
  afterTraceEvents: TraceEvent[]
): string => {
  const afterEvidenceRefs = uniqueStrings(afterTraceEvents.flatMap((event) => event.evidenceRefs));
  const resolvedViolations = uniqueStrings(
    afterReceipt && Array.isArray(afterReceipt.rerunComparison.resolvedViolations)
      ? afterReceipt.rerunComparison.resolvedViolations.map((value) => String(value))
      : []
  );

  return renderReplayTable(
    [
      renderReplayCell("readiness", afterReceipt ? `${afterReceipt.verdict} / ${afterReceipt.score}/100` : "rerun receipt missing"),
      renderReplayCell(
        "before",
        beforeReceipt ? `${beforeReceipt.verdict} / ${beforeReceipt.score}/100 / ${beforeReceipt.criticalViolations.length} critical` : "failed receipt missing"
      ),
      renderReplayCell(
        "after",
        afterReceipt ? `${afterViolations.length} violation(s) / ${afterReceipt.criticalViolations.length} critical` : "rerun receipt missing"
      ),
      renderReplayCell("resolved", resolvedViolations.length > 0 ? resolvedViolations.join(", ") : "none recorded"),
      renderReplayCell("evidence", afterEvidenceRefs.length > 0 ? afterEvidenceRefs.join(", ") : "refs (none)"),
      renderReplayCell("receipt", afterReceipt?.id ?? "missing", { code: Boolean(afterReceipt) })
    ].join(""),
    "col-3"
  );
};

const artifactFileList = (paths: UiArtifactPaths): string[] =>
  [
    paths.contract,
    paths.missions,
    paths.beforeTrace,
    paths.beforeViolations,
    paths.policyPatchJson,
    paths.readinessProfile,
    paths.afterTrace,
    paths.afterViolations,
    paths.afterReceipt
  ].filter((path): path is string => Boolean(path));

const renderReplaySection = (id: string, mark: string, title: string, body: string, active = false): string => `<section
  id="${escapeHtml(id)}"
  class="replay-card-section"
  data-replay-section
  aria-labelledby="${escapeHtml(id)}-title"
  ${active ? "" : "hidden"}
>
  <div class="replay-section-title">
    <span>${escapeHtml(mark)}</span>
    <h3 id="${escapeHtml(id)}-title">${escapeHtml(title)}</h3>
  </div>
  ${body}
</section>`;

const renderCertificationReplay = (artifacts: UiArtifacts): string => {
  const beforeReceipt = artifacts.beforeReceipt ?? (artifacts.phase === "before" ? artifacts.receipt : undefined);
  const afterReceipt = artifacts.afterReceipt ?? (artifacts.phase === "after" ? artifacts.receipt : undefined);
  const beforeTraceEvents = artifacts.beforeTraceEvents ?? (artifacts.phase === "before" ? artifacts.traceEvents : []);
  const afterTraceEvents = artifacts.afterTraceEvents ?? (artifacts.phase === "after" ? artifacts.traceEvents : []);
  const beforeViolations = artifacts.beforeViolations ?? (artifacts.phase === "before" ? artifacts.violations : []);
  const afterViolations = artifacts.afterViolations ?? (artifacts.phase === "after" ? artifacts.violations : []);
  const mission = artifacts.missions[0];
  const readinessState = afterReceipt ? `${afterReceipt.verdict} / ${afterReceipt.score}/100` : "rerun receipt missing";
  const mutationText =
    artifacts.receipt.mode === "fixture"
      ? "fixture mode / no live Splunk mutation"
      : "live mode / read-only inventory / no Splunk mutation";
  const artifactsText = artifactFileList(artifacts.paths)
    .map((path) => path.split("/").at(-1) ?? path)
    .join(" / ");

  return `<section id="certification-replay" class="shell-section" data-route-panel="certification-replay" aria-label="Certification replay">
    <p class="replay-invocation"><code>$ splc verify --replay --mode=${escapeHtml(artifacts.receipt.mode)} --out=${escapeHtml(artifacts.outDir)}</code></p>
    <article class="replay-card" data-replay aria-label="Readiness Pre-Flight Card">
      <header class="replay-card-header">
        <div>
          <p>SplunkReady / Agent Readiness Compiler</p>
          <h2>Readiness Pre-Flight Card</h2>
          <span>${escapeHtml(artifacts.receipt.agent.name)} ${escapeHtml(artifacts.receipt.agent.version)} against ${escapeHtml(artifacts.receipt.environment.name)}</span>
        </div>
        <strong>${escapeHtml(readinessState)}</strong>
      </header>
      <nav class="replay-card-rail" aria-label="Pre-flight card sections">
        <button type="button" data-replay-target="sec-a" aria-current="true" aria-selected="true" aria-controls="sec-a"><span>A</span>Contract</button>
        <button type="button" data-replay-target="sec-b" aria-selected="false" aria-controls="sec-b"><span>B</span>Trace A</button>
        <button type="button" data-replay-target="sec-c" aria-selected="false" aria-controls="sec-c"><span>C</span>Rules</button>
        <button type="button" data-replay-target="sec-d" aria-selected="false" aria-controls="sec-d"><span>D</span>Patch</button>
        <button type="button" data-replay-target="sec-e" aria-selected="false" aria-controls="sec-e"><span>E</span>Trace B</button>
      </nav>
      <div class="replay-card-body">
        ${renderReplaySection("sec-a", "A", "Contract", renderContractReplayTable(artifacts.contract, artifacts.missions, mission), true)}
        ${renderReplaySection("sec-b", "B", "Trace A - before patch", renderTraceReplayTable(beforeTraceEvents, "No trace-before.json artifact loaded."))}
        ${renderReplaySection("sec-c", "C", "Deterministic rules", renderRuleReplayTable(beforeViolations, mission, artifacts.readinessProfile))}
        ${renderReplaySection("sec-d", "D", "Policy patch", renderPatchReplayTable(artifacts.policyPatch))}
        ${renderReplaySection(
          "sec-e",
          "E",
          "Trace B - after patch",
          `${renderTraceReplayTable(afterTraceEvents, "No trace-after.json artifact loaded.")}${renderReceiptReplayTable(
            beforeReceipt,
            afterReceipt,
            afterViolations,
            afterTraceEvents
          )}`
        )}
      </div>
      <footer class="replay-compile">
        <span>compiled by Agent Readiness Compiler</span>
        <span>${escapeHtml(mutationText)}</span>
        <code>${escapeHtml(artifactsText)}</code>
      </footer>
    </article>
  </section>`;
};

const renderReceiptRerunView = (artifacts: UiArtifacts): string => {
  const beforeReceipt = artifacts.beforeReceipt ?? (artifacts.phase === "before" ? artifacts.receipt : undefined);
  const afterReceipt = artifacts.afterReceipt ?? (artifacts.phase === "after" ? artifacts.receipt : undefined);
  const failComplete = Boolean(beforeReceipt) || artifacts.receipt.verdict === "NOT READY";
  const patchComplete = Boolean(artifacts.policyPatch);
  const rerunComplete = Boolean(artifacts.afterReceipt) || artifacts.phase === "after";
  const passComplete = afterReceipt?.verdict === "READY";
  const stepClass = (complete: boolean): string => (complete ? "readiness-step readiness-step-complete" : "readiness-step");
  const stepState = (complete: boolean): string => (complete ? "complete" : "pending");

  return `<section id="rerun-receipts" class="shell-section" data-route-panel="rerun-receipts" aria-label="Readiness receipt rerun comparison">
    <h2>Receipts and rerun</h2>
    <div class="readiness-flow" aria-label="Readiness lifecycle">
      <div class="${stepClass(failComplete)}">
        <div class="step-index">1</div>
        <div><strong>Fail</strong><span>${stepState(failComplete)}</span></div>
      </div>
      <div class="${stepClass(patchComplete)}">
        <div class="step-index">2</div>
        <div><strong>Patch</strong><span>${stepState(patchComplete)}</span></div>
      </div>
      <div class="${stepClass(rerunComplete)}">
        <div class="step-index">3</div>
        <div><strong>Rerun</strong><span>${stepState(rerunComplete)}</span></div>
      </div>
      <div class="${stepClass(passComplete)}">
        <div class="step-index">4</div>
        <div><strong>Pass</strong><span>${stepState(passComplete)}</span></div>
      </div>
    </div>
    <div class="receipt-comparison">
      <div>
        <h3>Failed receipt</h3>
        ${beforeReceipt ? receiptSummaryRows(beforeReceipt) : `<p class="empty">No receipt-before-001.json artifact loaded.</p>`}
      </div>
      <div>
        <h3>Rerun receipt</h3>
        ${afterReceipt ? receiptSummaryRows(afterReceipt) : `<p class="empty">No receipt-after-001.json artifact loaded.</p>`}
      </div>
    </div>
    <div class="trace-phases">
      <div>
        <h3>Score comparison</h3>
        ${renderScoreComparison(beforeReceipt, afterReceipt)}
      </div>
      <div>
        <h3>Policy patch</h3>
        ${renderPolicyPatch(artifacts.policyPatch)}
      </div>
      <div>
        <h3>Critical issues and fixes</h3>
        ${renderCriticalIssueFixPairs(beforeReceipt, artifacts.beforeViolations ?? [], artifacts.policyPatch)}
      </div>
    </div>
  </section>`;
};

const renderArtifactPaths = (paths: UiArtifactPaths): string =>
  `<dl class="artifact-paths">
    ${paths.contract ? `<div><dt>Contract</dt><dd><code>${escapeHtml(paths.contract)}</code></dd></div>` : ""}
    ${paths.missions ? `<div><dt>Missions</dt><dd><code>${escapeHtml(paths.missions)}</code></dd></div>` : ""}
    ${paths.beforeTrace ? `<div><dt>Before trace</dt><dd><code>${escapeHtml(paths.beforeTrace)}</code></dd></div>` : ""}
    ${paths.beforeViolations ? `<div><dt>Before violations</dt><dd><code>${escapeHtml(paths.beforeViolations)}</code></dd></div>` : ""}
    ${paths.afterTrace ? `<div><dt>After trace</dt><dd><code>${escapeHtml(paths.afterTrace)}</code></dd></div>` : ""}
    ${paths.afterViolations ? `<div><dt>After violations</dt><dd><code>${escapeHtml(paths.afterViolations)}</code></dd></div>` : ""}
    ${paths.beforeReceipt ? `<div><dt>Before receipt</dt><dd><code>${escapeHtml(paths.beforeReceipt)}</code></dd></div>` : ""}
    ${paths.afterReceipt ? `<div><dt>After receipt</dt><dd><code>${escapeHtml(paths.afterReceipt)}</code></dd></div>` : ""}
    ${paths.policyPatchJson ? `<div><dt>Policy patch JSON</dt><dd><code>${escapeHtml(paths.policyPatchJson)}</code></dd></div>` : ""}
    ${paths.policyPatchMarkdown ? `<div><dt>Policy patch Markdown</dt><dd><code>${escapeHtml(paths.policyPatchMarkdown)}</code></dd></div>` : ""}
    ${paths.readinessProfile ? `<div><dt>Readiness profile</dt><dd><code>${escapeHtml(paths.readinessProfile)}</code></dd></div>` : ""}
    <div><dt>Receipt</dt><dd><code>${escapeHtml(paths.receipt)}</code></dd></div>
    <div><dt>Trace</dt><dd><code>${escapeHtml(paths.trace)}</code></dd></div>
    <div><dt>Violations</dt><dd><code>${escapeHtml(paths.violations)}</code></dd></div>
  </dl>`;

export const renderUiShell = (artifacts: UiArtifacts): string => {
  const { receipt } = artifacts;
  const criticalCount = receipt.criticalViolations.length;
  const violationCount = receipt.violations.length;
  const evidenceCount = receipt.evidenceRefs.length;
  const traceCount = receipt.traceRefs.length;
  const resolvedViolations = Array.isArray(artifacts.receipt.rerunComparison.resolvedViolations)
    ? artifacts.receipt.rerunComparison.resolvedViolations.map((value) => String(value))
    : [];
  const modeDetail =
    receipt.mode === "fixture"
      ? "Fixture mode: reproducible local fixture; no live Splunk mutation."
      : "Live mode: operator-supplied Splunk MCP context; no automatic Splunk mutation.";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="data:,">
  <title>SplunkReady - Readiness Receipt</title>
  <style>
    html {
      scroll-behavior: smooth;
    }

    :root {
      color-scheme: dark;
      --page: #211d10;
      --ink: #ebe7db;
      --muted: #b8b0a1;
      --line: #756f60;
      --surface: #211d10;
      --surface-2: #302a1c;
      --paper: #211d10;
      --paper-cell: #2a2300;
      --paper-line: #756f60;
      --rail: #211d10;
      --rail-muted: #c9c2b5;
      --accent: #b45224;
      --ready: #76e0bd;
      --review: #d9aa4f;
      --blocked: #ff8175;
      --max-content: 100%;
    }

    * {
      box-sizing: border-box;
    }

    [hidden] {
      display: none !important;
    }

    body {
      margin: 0;
      background: var(--page);
      color: var(--ink);
      font-family: "Aptos", "Helvetica Neue", sans-serif;
      font-size: 14px;
      line-height: 1.45;
    }

    code {
      font-family: "SF Mono", "Menlo", monospace;
      font-size: 12px;
      overflow-wrap: anywhere;
    }

    .app-shell {
      min-height: 100vh;
    }

    .side-nav {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 22px;
      position: fixed;
      top: 0;
      bottom: 0;
      left: 0;
      width: 300px;
      height: 100vh;
      overflow: hidden;
      background: var(--rail);
      color: var(--ink);
      border-right: 1px solid var(--paper-line);
      padding: 26px 24px 20px;
    }

    .side-nav > div:first-child {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
    }

    .brand {
      font-size: 19px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .tagline {
      color: var(--rail-muted);
      margin: 0;
    }

    .side-nav nav {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      margin-top: 28px;
      padding: 18px 0;
      border-top: 1px solid var(--paper-line);
      border-bottom: 1px solid var(--paper-line);
      justify-content: space-between;
    }

    .side-nav a {
      display: flex;
      align-items: center;
      color: var(--ink);
      text-decoration: none;
      min-height: 36px;
      padding: 0 0 0 16px;
      border-left: 1px solid rgba(117, 111, 96, 0.55);
      transition: background-color 0.15s ease;
    }

    .side-nav a:last-child {
      border-left: 1px solid rgba(117, 111, 96, 0.55);
    }

    .side-nav a:hover {
      background: transparent;
      color: #fffaf0;
    }

    .side-nav a[aria-current="page"] {
      background: transparent;
      color: #fffaf0;
      border-left-color: var(--ink);
      font-weight: 700;
    }

    .side-nav a[aria-current="page"]:hover {
      background: transparent;
    }

    .side-status {
      border: 1px solid var(--paper-line);
      border-left: 0;
      border-right: 0;
      padding: 10px 0 0;
      background: transparent;
      color: var(--rail-muted);
    }

    .side-status span {
      display: block;
      color: var(--ready);
      font-weight: 700;
      margin-bottom: 6px;
    }

    .side-status code {
      color: var(--ink);
    }

    .side-status p {
      margin: 8px 0 0;
      color: var(--muted);
      font-size: 12px;
    }

    .content {
      min-width: 0;
      min-height: 100vh;
      margin-left: 300px;
      padding: 28px 34px;
      background: var(--page);
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      max-width: var(--max-content);
      margin: 0 auto;
      padding: 0 0 24px;
      background: transparent;
      border-bottom: 1px solid var(--line);
    }

    h1,
    h2,
    h3 {
      margin: 0;
      font-weight: 680;
    }

    h1 {
      font-size: 22px;
    }

    h2 {
      font-size: 16px;
      margin-bottom: 14px;
    }

    h3 {
      font-size: 14px;
      margin-bottom: 10px;
    }

    .subtle {
      color: var(--muted);
      margin: 4px 0 0;
    }

    .mode-indicator {
      border: 1px solid var(--line);
      padding: 7px 10px;
      background: var(--paper-cell);
      color: var(--ink);
      max-width: 360px;
    }

    .mode-label {
      white-space: nowrap;
      font-weight: 650;
    }

    .mode-detail {
      display: block;
      color: var(--muted);
      font-size: 12px;
      margin-top: 2px;
    }

    .readiness-flow {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 18px;
    }

    .readiness-step {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      padding: 10px 12px;
      background: transparent;
      border: 1px solid var(--line);
      color: var(--muted);
    }

    .readiness-step-complete {
      border-color: #d7a48d;
      color: var(--ink);
    }

    .step-index {
      display: grid;
      place-items: center;
      width: 24px;
      height: 24px;
      flex: 0 0 auto;
      border-radius: 999px;
      background: #343020;
      color: var(--ink);
      font-weight: 700;
      font-size: 12px;
    }

    .readiness-step-complete .step-index {
      background: var(--paper-line);
      color: var(--ink);
    }

    .readiness-step strong {
      display: block;
    }

    .readiness-step span {
      display: block;
      font-size: 12px;
      color: var(--muted);
    }

    .replay-invocation {
      max-width: var(--max-content);
      margin: 0 auto 10px;
      color: var(--muted);
    }

    .replay-card {
      display: flex;
      flex-direction: column;
      background: var(--paper);
      color: var(--ink);
      border: 1px solid var(--paper-line);
      max-width: var(--max-content);
      margin: 0 auto;
    }

    .replay-card-header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(180px, max-content);
      gap: 18px;
      align-items: start;
      padding: 18px 20px 16px;
      border-bottom: 1px solid var(--paper-line);
      background: var(--paper);
      color: var(--ink);
    }

    .replay-card-header p,
    .replay-card-header span {
      display: block;
      margin: 0;
      color: var(--muted);
      font-size: 12px;
    }

    .replay-card-header h2 {
      margin: 3px 0 5px;
      font-size: 20px;
    }

    .replay-card-header strong {
      justify-self: end;
      padding: 7px 9px;
      border: 1px solid var(--paper-line);
      background: var(--paper-cell);
      color: var(--ink);
      font-size: 13px;
    }

    .replay-card-rail {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      background: #302a1c;
      border-bottom: 1px solid var(--paper-line);
    }

    .replay-card-rail button {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      padding: 9px 10px;
      border-right: 1px solid var(--paper-line);
      border-top: 0;
      border-bottom: 0;
      border-left: 0;
      background: transparent;
      color: var(--ink);
      font: inherit;
      font-size: 13px;
      font-weight: 650;
      text-align: left;
      cursor: pointer;
      transition: background-color 0.15s ease;
    }

    .replay-card-rail button:last-child {
      border-right: 0;
    }

    .replay-card-rail button:hover,
    .replay-card-rail button[aria-current="true"] {
      background: var(--paper);
    }

    .replay-card-rail span,
    .replay-section-title span {
      display: grid;
      place-items: center;
      width: 22px;
      height: 22px;
      flex: 0 0 auto;
      border: 1px solid currentColor;
      font-size: 12px;
      font-weight: 700;
    }

    .replay-card-body {
      flex: 1;
      background: var(--paper);
      color: var(--ink);
    }

    .replay-card-section {
      padding: 18px 20px 20px;
      border-bottom: 1px solid var(--paper-line);
    }

    .replay-section-title {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }

    .replay-section-title h3 {
      margin: 0;
      font-size: 15px;
    }

    .tbl {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      border-top: 1px solid var(--paper-line);
      border-left: 1px solid var(--paper-line);
      background: var(--paper-cell);
    }

    .tbl.col-3 {
      grid-template-columns: minmax(92px, 0.55fr) minmax(0, 1.55fr) minmax(160px, 0.9fr);
    }

    .tbl.col-patch {
      grid-template-columns: 180px minmax(0, 1.4fr) minmax(180px, 0.8fr);
    }

    .cell {
      min-width: 0;
      padding: 9px 10px;
      border-right: 1px solid var(--paper-line);
      border-bottom: 1px solid var(--paper-line);
      overflow-wrap: anywhere;
    }

    .cell b {
      display: block;
      margin-bottom: 4px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 650;
    }

    .cell span {
      display: block;
    }

    .cell.step {
      background: #2f2a18;
    }

    .replay-card-section .empty {
      background: var(--paper-cell);
      color: var(--muted);
      border-color: var(--paper-line);
    }

    .replay-compile {
      display: grid;
      grid-template-columns: minmax(0, 0.8fr) minmax(0, 0.8fr) minmax(0, 1.6fr);
      gap: 0;
      background: #17130a;
      color: var(--ink);
      border-top: 1px solid var(--paper-line);
    }

    .replay-compile span,
    .replay-compile code {
      padding: 10px 12px;
      border-right: 1px solid var(--paper-line);
    }

    .replay-compile code {
      color: var(--ink);
    }

    .receipt-strip {
      display: grid;
      grid-template-columns: 240px repeat(4, minmax(120px, 1fr));
      gap: 0;
      max-width: var(--max-content);
      margin: 0 auto;
      background: transparent;
      border-bottom: 1px solid var(--line);
    }

    .verdict-cell,
    .metric-cell {
      padding: 18px 22px;
      border-right: 1px solid var(--line);
    }

    .metric-cell:last-child {
      border-right: 0;
    }

    .cell-label {
      color: var(--muted);
      margin-bottom: 5px;
    }

    .cell-value {
      font-size: 22px;
      font-weight: 700;
    }

    .verdict-ready .cell-value {
      color: var(--ready);
    }

    .verdict-review .cell-value {
      color: var(--review);
    }

    .verdict-blocked .cell-value {
      color: var(--blocked);
    }

    .shell-section {
      padding: 32px 0 0;
      max-width: var(--max-content);
      margin: 0 auto;
      border: 0;
      background: transparent;
    }

    #certification-replay {
      padding: 0;
      border: 0;
      background: transparent;
    }

    .section-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.8fr);
      gap: 24px;
    }

    .contract-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 24px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--paper);
      border: 1px solid var(--line);
    }

    th,
    td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }

    th {
      background: var(--surface-2);
      font-weight: 650;
    }

    tr:last-child td {
      border-bottom: 0;
    }

    tbody tr {
      transition: background-color 0.1s ease;
    }

    tbody tr:hover td {
      background: #292515;
    }

    .trace-limit-row td {
      color: var(--muted);
      text-align: center;
      background: var(--surface-2);
      font-size: 12px;
    }

    .stacked-table {
      margin-top: 12px;
    }

    .trace-phases {
      display: grid;
      gap: 24px;
      margin-top: 24px;
    }

    .receipt-comparison {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 24px;
    }

    .timeline-table th:nth-child(4),
    .timeline-table td:nth-child(4) {
      width: 34%;
    }

    .check-badge {
      display: inline-block;
      margin: 0 4px 4px 0;
      padding: 2px 6px;
      border: 1px solid var(--line);
      border-radius: 4px;
      font-size: 12px;
      white-space: nowrap;
    }

    .check-badge-pass {
      color: var(--ready);
      background: #193126;
    }

    .check-badge-resolved {
      color: var(--muted);
      background: var(--surface-2);
    }

    .check-badge-failed {
      color: var(--blocked);
      background: #3a201b;
    }

    .inline-violations {
      margin-top: 8px;
      padding-left: 16px;
      color: var(--blocked);
    }

    ul {
      margin: 0;
      padding-left: 18px;
    }

    li {
      margin-bottom: 7px;
    }

    .artifact-paths {
      margin: 0;
      background: var(--paper);
      border: 1px solid var(--line);
    }

    .artifact-paths div {
      display: grid;
      grid-template-columns: 96px minmax(0, 1fr);
      gap: 12px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
    }

    .artifact-paths div:last-child {
      border-bottom: 0;
    }

    dt {
      color: var(--muted);
    }

    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }

    .empty {
      margin: 0;
      color: var(--muted);
      background: var(--paper-cell);
      border: 1px solid var(--line);
      padding: 12px;
    }

    .provenance-columns {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 24px;
    }

    .ref-groups {
      display: grid;
      gap: 16px;
    }

    @media (max-width: 920px) {
      .app-shell {
        display: block;
      }

      .side-nav {
        position: static;
        width: auto;
        height: auto;
        border-right: 0;
        border-bottom: 1px solid var(--paper-line);
        min-height: auto;
      }

      .content {
        margin-left: 0;
      }

      .receipt-strip,
      .section-grid,
      .contract-grid,
      .receipt-comparison,
      .provenance-columns,
      .replay-card-header,
      .replay-card-rail,
      .tbl,
      .tbl.col-3,
      .tbl.col-patch,
      .replay-compile {
        grid-template-columns: 1fr;
      }

      .verdict-cell,
      .metric-cell {
        border-right: 0;
        border-bottom: 1px solid var(--line);
      }

      .topbar {
        align-items: flex-start;
        flex-direction: column;
      }

      .readiness-flow {
        grid-template-columns: 1fr;
      }

      .replay-card-header strong {
        justify-self: start;
      }

      .replay-card-rail button,
      .replay-compile span,
      .replay-compile code {
        border-right: 0;
        border-bottom: 1px solid var(--paper-line);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      html {
        scroll-behavior: auto;
      }

      .side-nav a,
      .replay-card-rail button,
      tbody tr {
        transition: none;
      }
    }
  </style>
</head>
<body>
  <div class="app-shell">
    <aside class="side-nav" aria-label="SplunkReady sections">
      <div>
        <div class="brand">SplunkReady</div>
        <p class="tagline">Certify AI agents before they touch production Splunk.</p>
        <nav>
          <a aria-current="page" href="#receipt">Readiness Receipt</a>
          <a href="#certification-replay">Replay</a>
          <a href="#contract">Contract</a>
          <a href="#mission-trace">Mission trace</a>
          <a href="#rerun-receipts">Rerun receipts</a>
          <a href="#provenance">Provenance</a>
          <a href="#violations">Violations</a>
          <a href="#artifacts">Artifacts</a>
        </nav>
      </div>
      <div class="side-status">
        <span>${escapeHtml(receipt.verdict)} / ${escapeValue(receipt.score)}/100</span>
        <code>${escapeHtml(receipt.mode)} · ${escapeHtml(artifacts.phase)}</code>
        <p>${escapeHtml(receipt.generatedBy ?? "Agent Readiness Compiler")}</p>
      </div>
    </aside>
    <main class="content">
      <header class="topbar" data-route-panel="receipt">
        <div>
          <h1>Readiness Receipt</h1>
          <p class="subtle">Agent Readiness Compiler output for ${escapeHtml(receipt.agent.name)} ${escapeHtml(receipt.agent.version)}</p>
        </div>
        <div class="mode-indicator">
          <span class="mode-label">${escapeHtml(receipt.mode)} mode / ${escapeHtml(artifacts.phase)} run</span>
          <span class="mode-detail">${escapeHtml(modeDetail)}</span>
        </div>
      </header>

      <section id="receipt" class="receipt-strip" data-route-panel="receipt" aria-label="Current agent verdict">
        <div class="verdict-cell ${verdictClass(receipt.verdict)}">
          <div class="cell-label">Current verdict</div>
          <div class="cell-value">${escapeHtml(receipt.verdict)}</div>
        </div>
        <div class="metric-cell">
          <div class="cell-label">Score</div>
          <div class="cell-value">${escapeValue(receipt.score)}</div>
        </div>
        <div class="metric-cell">
          <div class="cell-label">Violations</div>
          <div class="cell-value">${escapeValue(violationCount)}</div>
        </div>
        <div class="metric-cell">
          <div class="cell-label">Trace refs</div>
          <div class="cell-value">${escapeValue(traceCount)}</div>
        </div>
        <div class="metric-cell">
          <div class="cell-label">Evidence refs</div>
          <div class="cell-value">${escapeValue(evidenceCount)}</div>
        </div>
      </section>

      ${renderCertificationReplay(artifacts)}

      <section class="shell-section" data-route-panel="receipt" aria-label="Receipt identity">
        <div class="section-grid">
          <div>
            <h2>${escapeHtml(receipt.id)}</h2>
            <table>
              <tbody>
                <tr><th>Environment</th><td>${escapeHtml(receipt.environment.name)} <code>${escapeHtml(receipt.environment.id)}</code></td></tr>
                ${
                  receipt.policy
                    ? `<tr><th>Policy</th><td>${escapeHtml(receipt.policy.name)} ${escapeHtml(receipt.policy.version)} <code>${escapeHtml(receipt.policy.id)}</code></td></tr>`
                    : ""
                }
                <tr><th>Contract</th><td>${escapeHtml(receipt.contractVersion)}</td></tr>
                <tr><th>Mission suite</th><td>${escapeHtml(receipt.missionSuiteVersion)}</td></tr>
                <tr><th>Generated by</th><td>${escapeHtml(receipt.generatedBy ?? "Agent Readiness Compiler")}</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <h2>Rerun comparison</h2>
            <table>
              <tbody>
                <tr><th>Critical violations</th><td>${escapeValue(criticalCount)}</td></tr>
                <tr><th>Resolved violations</th><td>${escapeValue(resolvedViolations.length)}</td></tr>
                <tr><th>Passed missions</th><td>${escapeValue(receipt.passedMissions.length)}</td></tr>
                <tr><th>Failed missions</th><td>${escapeValue(receipt.failedMissions.length)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      ${renderReceiptRerunView(artifacts)}

      ${renderContractView(artifacts)}

      ${renderMissionTraceView(artifacts)}

      <section id="provenance" class="shell-section" data-route-panel="provenance" aria-label="Trace and evidence provenance">
        <div class="section-grid">
          <div>
            <h2>Trace events</h2>
            ${renderTraceEvents(artifacts.traceEvents)}
          </div>
          <div>
            <h2>Receipt refs</h2>
            <div class="ref-groups">
              ${renderRefGroup("Trace refs", receipt.traceRefs, "No trace refs.")}
              ${renderRefGroup("Evidence refs", receipt.evidenceRefs, "No evidence refs.")}
              ${renderRefGroup("Violation refs", receipt.violations, "No violation refs.")}
            </div>
          </div>
        </div>
      </section>

      <section id="violations" class="shell-section" data-route-panel="violations" aria-label="Deterministic violations">
        <h2>Deterministic violations</h2>
        ${renderViolations(artifacts.violations)}
      </section>

      <section id="artifacts" class="shell-section" data-route-panel="artifacts" aria-label="Loaded artifact paths">
        <h2>Loaded artifacts</h2>
        ${renderArtifactPaths(artifacts.paths)}
      </section>
    </main>
  </div>
  <script>
    window.addEventListener("DOMContentLoaded", () => {
      const links = Array.from(document.querySelectorAll(".side-nav a"));
      const routePanels = Array.from(document.querySelectorAll("[data-route-panel]"));
      const validRoutes = new Set(links.map((link) => link.getAttribute("href")?.slice(1)).filter(Boolean));
      const normalizeRoute = (hash) => {
        const route = (hash || "#receipt").replace(/^#/, "");
        return validRoutes.has(route) ? route : "receipt";
      };
      const showRoute = (route, shouldScroll = true) => {
        const activeHash = "#" + route;

        links.forEach((link) => {
          if (link.getAttribute("href") === activeHash) {
            link.setAttribute("aria-current", "page");
          } else {
            link.removeAttribute("aria-current");
          }
        });

        routePanels.forEach((panel) => {
          if (panel.getAttribute("data-route-panel") === route) {
            panel.removeAttribute("hidden");
          } else {
            panel.setAttribute("hidden", "");
          }
        });

        if (shouldScroll) {
          window.scrollTo({ top: 0, left: 0 });
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
        }
      };

      links.forEach((link) => {
        link.addEventListener("click", (event) => {
          const route = normalizeRoute(link.getAttribute("href") || "#receipt");

          event.preventDefault();
          history.pushState(null, "", "#" + route);
          showRoute(route);
        });
      });

      window.addEventListener("popstate", () => {
        showRoute(normalizeRoute(window.location.hash));
      });
      window.addEventListener("hashchange", () => {
        showRoute(normalizeRoute(window.location.hash));
      });
      showRoute(normalizeRoute(window.location.hash), false);

      const replayTargets = Array.from(document.querySelectorAll("[data-replay-target]"));
      const replaySections = Array.from(document.querySelectorAll("[data-replay-section]"));
      const activateReplayTarget = (target) => {
        const targetId = target.getAttribute("data-replay-target");

        replayTargets.forEach((candidate) => {
          if (candidate === target) {
            candidate.setAttribute("aria-current", "true");
            candidate.setAttribute("aria-selected", "true");
          } else {
            candidate.removeAttribute("aria-current");
            candidate.setAttribute("aria-selected", "false");
          }
        });

        replaySections.forEach((section) => {
          if (section.id === targetId) {
            section.removeAttribute("hidden");
          } else {
            section.setAttribute("hidden", "");
          }
        });
      };

      replayTargets.forEach((target) => {
        target.addEventListener("click", () => {
          activateReplayTarget(target);
        });

        target.addEventListener("keydown", (event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            return;
          }

          event.preventDefault();
          const currentIndex = replayTargets.indexOf(target);
          const nextIndex =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? replayTargets.length - 1
                : event.key === "ArrowRight"
                  ? (currentIndex + 1) % replayTargets.length
                  : (currentIndex - 1 + replayTargets.length) % replayTargets.length;
          const nextTarget = replayTargets[nextIndex];

          nextTarget.focus();
          activateReplayTarget(nextTarget);
        });
      });
    });
  </script>
</body>
</html>`;
};

export const writeUiShell = async (outDir: string, targetPath = join(outDir, "splunkready-shell.html")): Promise<string> => {
  const html = renderUiShell(await loadUiArtifacts(outDir));

  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${html}\n`, "utf8");

  return targetPath;
};
