import { type TraceEvent, type Violation } from "../../schemas/core.js";
import { type MissionDefinition } from "../../missions/dsl.js";
import { type UiArtifacts } from "../shell.js";
import { escapeHtml, escapeValue, truncate } from "./helpers.js";

export const renderMissionCheckBadges = (
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

export const renderMissionList = (
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

export const toolInputSummary = (event: TraceEvent): string => {
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

export const violationsByTraceEvent = (violations: Violation[]): Map<string, Violation[]> => {
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

export const renderInlineViolations = (violations: Violation[]): string => {
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

export const renderTraceTimeline = (label: string, events: TraceEvent[], violations: Violation[]): string => {
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

export const renderMissionTraceView = (artifacts: UiArtifacts): string => {
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
