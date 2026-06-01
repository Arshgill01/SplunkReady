import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  environmentContractSchema,
  readinessReceiptSchema,
  traceEventSchema,
  violationSchema,
  type EnvironmentContract,
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

const readOptionalContract = async (path: string): Promise<EnvironmentContract | undefined> => {
  if (!(await exists(path))) {
    return undefined;
  }

  return environmentContractSchema.parse(await readJson(path));
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

  return `<table>
    <thead>
      <tr><th>Trace event</th><th>Type</th><th>Tool</th><th>Evidence refs</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
};

const renderIndexRows = (contract: EnvironmentContract): string => {
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

const renderSourcetypeRows = (contract: EnvironmentContract): string =>
  contract.sourcetypes
    .map(
      (sourcetype) => `<tr>
        <td><code>${escapeHtml(sourcetype.name)}</code></td>
        <td>${sourcetype.fields.map((field) => `<code>${escapeHtml(field)}</code>`).join(" ")}</td>
      </tr>`
    )
    .join("");

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

  return rows.join("");
};

const preferredSavedSearchRefs = (missions: MissionDefinition[]): Set<string> =>
  new Set(missions.flatMap((mission) => mission.preferredSavedSearchRefs ?? []));

const renderSavedSearchRows = (contract: EnvironmentContract, missions: MissionDefinition[]): string => {
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

const renderContractView = (artifacts: UiArtifacts): string => {
  if (!artifacts.contract) {
    return `<section id="contract" class="shell-section" aria-label="Environment contract">
      <h2>Environment contract</h2>
      <p class="empty">No environment-contract.json artifact loaded.</p>
    </section>`;
  }

  const { contract } = artifacts;

  return `<section id="contract" class="shell-section" aria-label="Environment contract">
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
    </div>
  </section>`;
};

const renderMissionList = (missions: MissionDefinition[]): string => {
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
      </tr>`
    )
    .join("");

  return `<table>
    <thead><tr><th>Mission</th><th>Expected tools</th><th>Preferred saved search</th><th>Authorized indexes</th></tr></thead>
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

  return `<section id="mission-trace" class="shell-section" aria-label="Mission execution and MCP trace">
    <h2>Mission and trace</h2>
    ${renderMissionList(artifacts.missions)}
    <div class="trace-phases">
      ${renderTraceTimeline("Failing trace before patch", beforeTraceEvents, beforeViolations)}
      ${renderTraceTimeline("Passing trace after patch", afterTraceEvents, afterViolations)}
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

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="data:,">
  <title>SplunkReady - Readiness Receipt</title>
  <style>
    :root {
      color-scheme: light;
      --page: #f7f7f4;
      --ink: #1f2421;
      --muted: #646a66;
      --line: #d7d9d2;
      --surface: #ffffff;
      --rail: #242622;
      --rail-muted: #c6c8bf;
      --accent: #b45224;
      --ready: #176b4d;
      --review: #8a5a14;
      --blocked: #a2342e;
    }

    * {
      box-sizing: border-box;
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
      display: grid;
      grid-template-columns: 248px minmax(0, 1fr);
      min-height: 100vh;
    }

    .side-nav {
      background: var(--rail);
      color: #f7f7f4;
      border-right: 1px solid #171915;
      padding: 24px 18px;
    }

    .brand {
      font-size: 19px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .tagline {
      color: var(--rail-muted);
      margin: 0 0 28px;
    }

    .side-nav a {
      display: block;
      color: #f7f7f4;
      text-decoration: none;
      padding: 9px 10px;
      border-radius: 6px;
      margin-bottom: 4px;
    }

    .side-nav a[aria-current="page"] {
      background: #34372f;
    }

    .content {
      min-width: 0;
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      padding: 22px 28px;
      background: var(--surface);
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
      border-radius: 6px;
      padding: 7px 10px;
      background: #fbfbf8;
      color: var(--ink);
      white-space: nowrap;
    }

    .receipt-strip {
      display: grid;
      grid-template-columns: 240px repeat(4, minmax(120px, 1fr));
      gap: 0;
      background: var(--surface);
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
      padding: 24px 28px;
      border-bottom: 1px solid var(--line);
      background: var(--page);
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
      background: var(--surface);
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
      background: #eeeeea;
      font-weight: 650;
    }

    tr:last-child td {
      border-bottom: 0;
    }

    .stacked-table {
      margin-top: 12px;
    }

    .trace-phases {
      display: grid;
      gap: 24px;
      margin-top: 24px;
    }

    .timeline-table th:nth-child(4),
    .timeline-table td:nth-child(4) {
      width: 34%;
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
      background: var(--surface);
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
      background: var(--surface);
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
        grid-template-columns: 1fr;
      }

      .side-nav {
        border-right: 0;
        border-bottom: 1px solid #171915;
      }

      .receipt-strip,
      .section-grid,
      .contract-grid,
      .provenance-columns {
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
    }
  </style>
</head>
<body>
  <div class="app-shell">
    <aside class="side-nav" aria-label="SplunkReady sections">
      <div class="brand">SplunkReady</div>
      <p class="tagline">Certify AI agents before they touch production Splunk.</p>
      <nav>
        <a aria-current="page" href="#receipt">Readiness Receipt</a>
        <a href="#contract">Contract</a>
        <a href="#mission-trace">Mission trace</a>
        <a href="#provenance">Provenance</a>
        <a href="#violations">Violations</a>
        <a href="#artifacts">Artifacts</a>
      </nav>
    </aside>
    <main class="content">
      <header class="topbar">
        <div>
          <h1>Readiness Receipt</h1>
          <p class="subtle">Agent Readiness Compiler output for ${escapeHtml(receipt.agent.name)} ${escapeHtml(receipt.agent.version)}</p>
        </div>
        <div class="mode-indicator">${escapeHtml(receipt.mode)} mode / ${escapeHtml(artifacts.phase)} run</div>
      </header>

      <section id="receipt" class="receipt-strip" aria-label="Current agent verdict">
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

      <section class="shell-section" aria-label="Receipt identity">
        <div class="section-grid">
          <div>
            <h2>${escapeHtml(receipt.id)}</h2>
            <table>
              <tbody>
                <tr><th>Environment</th><td>${escapeHtml(receipt.environment.name)} <code>${escapeHtml(receipt.environment.id)}</code></td></tr>
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

      ${renderContractView(artifacts)}

      ${renderMissionTraceView(artifacts)}

      <section id="provenance" class="shell-section" aria-label="Trace and evidence provenance">
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

      <section id="violations" class="shell-section" aria-label="Deterministic violations">
        <h2>Deterministic violations</h2>
        ${renderViolations(artifacts.violations)}
      </section>

      <section id="artifacts" class="shell-section" aria-label="Loaded artifact paths">
        <h2>Loaded artifacts</h2>
        ${renderArtifactPaths(artifacts.paths)}
      </section>
    </main>
  </div>
</body>
</html>`;
};

export const writeUiShell = async (outDir: string, targetPath = join(outDir, "splunkready-shell.html")): Promise<string> => {
  const html = renderUiShell(await loadUiArtifacts(outDir));

  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${html}\n`, "utf8");

  return targetPath;
};
