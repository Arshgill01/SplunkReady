import { type TraceEvent, type Violation } from "../../schemas/core.js";

export const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const escapeValue = (value: unknown): string => escapeHtml(String(value));

export const truncate = (value: string, maxLength = 160): string =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;

export const verdictClass = (verdict: string): string => {
  if (verdict === "READY") {
    return "verdict-ready";
  }

  if (verdict === "NEEDS REVIEW") {
    return "verdict-review";
  }

  return "verdict-blocked";
};

export const renderList = (values: string[], emptyText: string): string => {
  if (values.length === 0) {
    return `<p class="empty">${escapeHtml(emptyText)}</p>`;
  }

  return `<ul>${values.map((value) => `<li><code>${escapeHtml(value)}</code></li>`).join("")}</ul>`;
};

export const renderRefGroup = (label: string, values: string[], emptyText: string): string =>
  `<div class="ref-group">
    <h3>${escapeHtml(label)}</h3>
    ${renderList(values, emptyText)}
  </div>`;

export const renderEmptyTableRow = (columnCount: number, message: string): string =>
  `<tr><td colspan="${columnCount}">${escapeHtml(message)}</td></tr>`;

export const renderViolations = (violations: Violation[]): string => {
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

export const renderTraceEvents = (events: TraceEvent[]): string => {
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
