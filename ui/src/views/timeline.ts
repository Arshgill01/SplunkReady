import type { UiArtifactBundle } from "../artifacts.js";
import type { PolicyPatch, TraceEvent, Violation } from "../../../src/schemas/core.js";
import {
  value,
  code,
  renderProofArtifactWarning,
  violationByEvent,
  splAssistanceByViolation
} from "./helpers.js";
import { renderMcpTranscriptImport } from "./mcp.js";

export const eventSummary = (event: TraceEvent): string => {
  if (event.toolInput && typeof event.toolInput["query"] === "string") {
    return event.toolInput["query"];
  }

  if (event.toolInput && typeof event.toolInput["name"] === "string") {
    return `${event.toolInput["app"] ?? "search"}::${event.toolInput["name"]}`;
  }

  return event.toolOutputSummary ?? event.type;
};

export const renderFindings = (
  violations: Violation[],
  assistanceByViolation: Map<string, NonNullable<PolicyPatch["splAssistance"]>[number]>
): string => {
  if (violations.length === 0) {
    return "None";
  }

  return `<div class="finding-list">${violations
    .map((violation) => {
      const assistance = assistanceByViolation.get(violation.id);
      const beforeSpl = typeof violation.evidence["query"] === "string" ? violation.evidence["query"] : assistance?.query;

      return `<article class="finding">
        <strong>${value(violation.ruleId)}</strong>
        <p>${value(violation.reason)}</p>
        ${
          assistance
            ? `<div class="saia-compare">
                <div>
                  <b>Before SPL</b>
                  ${code(beforeSpl ?? "n/a")}
                </div>
                <div>
                  <b>SAIA recommended SPL</b>
                  ${code(assistance.optimizedQuery)}
                </div>
              </div>
              <p>${value(assistance.explanation)}</p>`
            : ""
        }
      </article>`;
    })
    .join("")}</div>`;
};

export const renderTraceRows = (events: TraceEvent[], violations: Violation[], policyPatch: PolicyPatch | undefined): string => {
  const groupedViolations = violationByEvent(violations);
  const assistanceByViolation = splAssistanceByViolation(policyPatch);

  if (events.length === 0) {
    return `<tr><td colspan="5">Trace artifact not loaded.</td></tr>`;
  }

  return events
    .map((event, index) => {
      const eventViolations = groupedViolations.get(event.id) ?? [];
      return `<tr>
        <td>${index + 1}</td>
        <td>${code(event.id)}<span>${value(event.type)}</span></td>
        <td>${value(event.toolName ?? event.actor)}</td>
        <td>${value(eventSummary(event))}</td>
        <td>${renderFindings(eventViolations, assistanceByViolation)}</td>
      </tr>`;
    })
    .join("");
};

export const externalTraceForDisplay = (bundle: UiArtifactBundle): TraceEvent[] =>
  bundle.externalTrace.length > 0 ? bundle.externalTrace : bundle.importedTrace;

export const renderTraceTimeline = (bundle: UiArtifactBundle): string => {
  const externalTrace = externalTraceForDisplay(bundle);
  const externalTitle = bundle.externalTrace.length > 0 ? "External graded trace" : "Imported MCP trace";

  return `<main class="view" data-view="trace-timeline">
    <section class="workbench">
      <div class="section-title">
        <h1>Trace timeline</h1>
      </div>
      ${renderProofArtifactWarning(bundle)}
      <div class="trace-stack">
        <section class="panel">
          <h2>Before patch</h2>
          <table class="trace-table">
            <thead><tr><th>Step</th><th>Event</th><th>Tool</th><th>Input or output</th><th>Findings</th></tr></thead>
            <tbody>${renderTraceRows(bundle.beforeTrace, bundle.beforeViolations, bundle.policyPatch)}</tbody>
          </table>
        </section>
        <section class="panel">
          <h2>After patch</h2>
          <table class="trace-table">
            <thead><tr><th>Step</th><th>Event</th><th>Tool</th><th>Input or output</th><th>Findings</th></tr></thead>
            <tbody>${renderTraceRows(bundle.afterTrace, bundle.afterViolations, bundle.policyPatch)}</tbody>
          </table>
        </section>
        ${
          externalTrace.length > 0
            ? `<section class="panel">
                <h2>${value(externalTitle)}</h2>
                <table class="trace-table">
                  <thead><tr><th>Step</th><th>Event</th><th>Tool</th><th>Input or output</th><th>Findings</th></tr></thead>
                  <tbody>${renderTraceRows(externalTrace, bundle.externalViolations, bundle.policyPatch)}</tbody>
                </table>
              </section>`
            : ""
        }
        ${renderMcpTranscriptImport(bundle.mcpTranscriptImport)}
      </div>
    </section>
  </main>`;
};
