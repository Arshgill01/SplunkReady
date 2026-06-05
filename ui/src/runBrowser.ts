import { normalizeArtifactBase, type UiArtifactBundle } from "./artifacts.js";
import type { TraceEvent, Violation } from "../../src/schemas/core.js";
import type { WorkbenchRenderState, WorkbenchRunSummary } from "./workbenchTypes.js";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const value = (input: unknown): string => escapeHtml(String(input ?? "n/a"));

const code = (input: unknown): string => `<code>${value(input)}</code>`;

export const isIndexableRun = (run: WorkbenchRunSummary): boolean =>
  run.workflow !== "certification-index" &&
  run.files.includes("proof-manifest.json") &&
  run.files.includes("proof-audit.json") &&
  run.manifestStatus !== "FAIL";

export const currentRunIdFromBundle = (bundle: UiArtifactBundle): string | undefined => {
  const normalized = normalizeArtifactBase(bundle.artifactBase);
  const match = normalized.match(/\/api\/artifacts\/(run-[A-Za-z0-9._-]+)\/$/);

  return match?.[1];
};

const activeRunMatches = (run: WorkbenchRunSummary, bundle: UiArtifactBundle): boolean =>
  normalizeArtifactBase(run.artifactBase) === normalizeArtifactBase(bundle.artifactBase);

const runSearchText = (run: WorkbenchRunSummary): string =>
  [
    run.runId,
    run.workflow,
    run.state,
    run.verdict,
    run.proofAuditStatus,
    run.manifestStatus,
    ...run.missionIds,
    ...run.ruleIds,
    ...run.files
  ]
    .join(" ")
    .toLowerCase();

const filteredRuns = (runs: WorkbenchRunSummary[], workbench: WorkbenchRenderState | undefined): WorkbenchRunSummary[] => {
  const query = workbench?.runFilter?.trim().toLowerCase() ?? "";
  const status = workbench?.runStatusFilter ?? "all";
  const workflow = workbench?.runWorkflowFilter ?? "all";

  return runs.filter((run) => {
    const statusMatches = status === "all" || run.state === status || run.verdict === status || run.proofAuditStatus === status;
    const workflowMatches = workflow === "all" || run.workflow === workflow;
    const queryMatches = !query || runSearchText(run).includes(query);

    return statusMatches && workflowMatches && queryMatches;
  });
};

const runTime = (run: WorkbenchRunSummary): number => {
  const parsed = Date.parse(run.createdAt);

  if (Number.isFinite(parsed)) {
    return parsed;
  }

  return Date.parse(run.runId.replace(/^run-/, "").replace(/^(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})-(\d{3})Z-.+$/, "$1:$2:$3.$4Z"));
};

export const sortRunsByCreatedAt = (runs: WorkbenchRunSummary[]): WorkbenchRunSummary[] =>
  [...runs].sort((left, right) => {
    const rightTime = runTime(right);
    const leftTime = runTime(left);

    if (Number.isFinite(rightTime) && Number.isFinite(leftTime) && rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    return right.runId.localeCompare(left.runId);
  });

const formatRunCreatedAt = (createdAt: string): string => {
  const parsed = Date.parse(createdAt);

  if (!Number.isFinite(parsed)) {
    return createdAt;
  }

  return createdAt.replace("T", " ").replace(/\.\d{3}Z$/, "Z");
};

const uniqueRunValues = (runs: WorkbenchRunSummary[], key: "workflow" | "state"): string[] =>
  [...new Set(runs.map((run) => run[key]))].sort();

const renderRunFilters = (runs: WorkbenchRunSummary[], workbench: WorkbenchRenderState | undefined): string => {
  const selectedStatus = workbench?.runStatusFilter ?? "all";
  const selectedWorkflow = workbench?.runWorkflowFilter ?? "all";

  return `<div class="run-filters">
    <label>
      <span>Search</span>
      <input type="search" data-run-filter value="${value(workbench?.runFilter ?? "")}" placeholder="mission, verdict, rule, file">
    </label>
    <label>
      <span>Status</span>
      <select data-run-status-filter>
        <option value="all"${selectedStatus === "all" ? " selected" : ""}>All statuses</option>
        ${["succeeded", "failed", "READY", "NOT READY", "NEEDS REVIEW", "PASS", "FAIL", "WARN"]
          .map((status) => `<option value="${value(status)}"${selectedStatus === status ? " selected" : ""}>${value(status)}</option>`)
          .join("")}
      </select>
    </label>
    <label>
      <span>Workflow</span>
      <select data-run-workflow-filter>
        <option value="all"${selectedWorkflow === "all" ? " selected" : ""}>All workflows</option>
        ${uniqueRunValues(runs, "workflow")
          .map((workflow) => `<option value="${value(workflow)}"${selectedWorkflow === workflow ? " selected" : ""}>${value(workflow)}</option>`)
          .join("")}
      </select>
    </label>
  </div>`;
};

export const renderRunList = (
  bundle: UiArtifactBundle,
  runs: WorkbenchRunSummary[],
  workbench: WorkbenchRenderState | undefined
): string => {
  const visibleRuns = sortRunsByCreatedAt(filteredRuns(runs, workbench));

  if (!workbench?.available) {
    return `<section class="panel run-browser-list">
      <h2>Workbench runs</h2>
      <p class="empty">Start the local workbench backend to browse managed proof runs.</p>
    </section>`;
  }

  return `<section class="panel run-browser-list">
    <h2>Workbench runs</h2>
    ${renderRunFilters(runs, workbench)}
    ${
      visibleRuns.length === 0
        ? `<p class="empty">No managed runs match the current filters.</p>`
        : `<div class="run-card-list run-timeline-list">
            ${visibleRuns
              .map(
                (run) => `<article class="run-card ${activeRunMatches(run, bundle) ? "active" : ""}">
                  <div class="run-card-title">
                    ${code(run.runId)}
                    <span class="run-card-actions">
                      <a href="?artifacts=${encodeURIComponent(run.artifactBase)}#proof-browser" data-proof-artifact="${value(
                        run.artifactBase
                      )}" data-proof-view="proof-browser">Open</a>
                      <button class="replay-button run-export-button" type="button" data-public-proof-export="${value(run.runId)}">Export</button>
                    </span>
                  </div>
                  <div class="run-card-meta">
                    <span>${value(formatRunCreatedAt(run.createdAt))}</span>
                    <span>${value(run.workflow)}</span>
                    <span>${value(run.state)}</span>
                  </div>
                  <dl class="run-card-facts">
                    <div><dt>Receipt</dt><dd>${value(run.verdict)} / ${run.score === null ? "score n/a" : `score ${run.score}`}</dd></div>
                    <div><dt>Audit</dt><dd>${value(run.proofAuditStatus)} / ${value(run.state)}</dd></div>
                    <div><dt>Manifest</dt><dd>${value(run.manifestStatus)} / ${run.fileCount} file(s)</dd></div>
                    <div><dt>Evidence</dt><dd>${run.violations} violation(s) / ${run.evidenceRefs} ref(s)</dd></div>
                  </dl>
                </article>`
              )
              .join("")}
          </div>`
    }
  </section>`;
};

const renderTracePreviewFindings = (violations: Violation[]): string => {
  if (violations.length === 0) {
    return `<span class="trace-preview-none">None</span>`;
  }

  const ruleIds = [...new Set(violations.map((violation) => violation.ruleId))];

  return `<span class="trace-preview-rule-summary">${violations.length} finding(s): ${ruleIds.map((ruleId) => code(ruleId)).join(" / ")}</span>`;
};

const shortTraceEventId = (id: string): string => {
  const shortened = id.replace(/^mission-[a-z0-9-]+-readiness-/i, "").replace(/^trace-/, "");

  return shortened.length > 34 ? `${shortened.slice(0, 31)}...` : shortened;
};

const traceEvidenceRefCount = (events: TraceEvent[]): number =>
  events.reduce((total, event) => total + event.evidenceRefs.length, 0);

const traceToolsSummary = (events: TraceEvent[]): string => {
  const tools = [...new Set(events.map((event) => event.toolName).filter((toolName): toolName is string => Boolean(toolName)))];
  const visibleTools = tools.slice(0, 3);
  const hiddenTools = tools.length - visibleTools.length;

  if (visibleTools.length === 0) {
    return "none";
  }

  return `${visibleTools.join(" / ")}${hiddenTools > 0 ? ` / +${hiddenTools} more` : ""}`;
};

const traceSpanSummary = (events: TraceEvent[]): string => {
  const first = events[0];
  const last = events.at(-1);

  if (!first || !last) {
    return "n/a";
  }

  if (first.id === last.id) {
    return `${shortTraceEventId(first.id)} (${first.type})`;
  }

  return `${shortTraceEventId(first.id)} to ${shortTraceEventId(last.id)}`;
};

const tracePhaseSummary = (events: TraceEvent[], violations: Violation[]): string => {
  const tools = [...new Set(events.map((event) => event.toolName).filter((toolName): toolName is string => Boolean(toolName)))];

  return `${events.length} event(s) / ${tools.length} tool(s) / ${violations.length} finding(s) / ${traceEvidenceRefCount(events)} evidence ref(s)`;
};

const renderTracePreviewRows = (traces: Array<[string, TraceEvent[], Violation[]]>): string =>
  traces
    .map(
      ([label, events, violations]) => `<article class="trace-preview-phase" data-trace-preview-phase="${value(label.toLowerCase())}">
        <header>
          <h3>${value(label)}</h3>
          <span>${value(traceToolsSummary(events))}</span>
        </header>
        <dl>
          <div><dt>Events</dt><dd>${events.length}</dd></div>
          <div><dt>Findings</dt><dd>${violations.length}</dd></div>
          <div><dt>Evidence refs</dt><dd>${traceEvidenceRefCount(events)}</dd></div>
        </dl>
        <p><strong>Span</strong>${value(traceSpanSummary(events))}</p>
        <p><strong>Rule IDs</strong>${renderTracePreviewFindings(violations)}</p>
        <span class="trace-preview-summary">${value(tracePhaseSummary(events, violations))}</span>
      </article>`
    )
    .join("");

const externalTraceForDisplay = (bundle: UiArtifactBundle): TraceEvent[] =>
  bundle.externalTrace.length > 0 ? bundle.externalTrace : bundle.importedTrace;

export const renderTracePreview = (bundle: UiArtifactBundle): string => {
  const allTraces: Array<[string, TraceEvent[], Violation[]]> = [
    ["Before", bundle.beforeTrace, bundle.beforeViolations],
    ["After", bundle.afterTrace, bundle.afterViolations],
    [bundle.externalTrace.length > 0 ? "External" : "Imported", externalTraceForDisplay(bundle), bundle.externalViolations]
  ];
  const traces = allTraces.filter(([, events]) => events.length > 0);

  return `<section class="panel trace-preview">
    <div class="trace-preview-header">
      <h2>Trace preview</h2>
      <a href="#trace-timeline">Full Trace view</a>
    </div>
    <p class="trace-preview-note">Runs shows phase-level trace evidence only. Open the Trace view for the event-by-event timeline.</p>
    ${
      traces.length === 0
        ? `<p class="empty">Trace artifact not loaded.</p>`
        : `<div class="trace-preview-phases">${renderTracePreviewRows(traces)}</div>`
    }
  </section>`;
};
