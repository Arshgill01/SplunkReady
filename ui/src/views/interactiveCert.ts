import type { UiArtifactBundle } from "../artifacts.js";
import type { RenderOptions } from "../render.js";
import type { InteractiveCertificationResult } from "../interactiveCertifier.js";
import { value, code, renderFactTable, renderReceiptPanel } from "./helpers.js";

export const sampleInteractiveTrace = (bundle: UiArtifactBundle): string => {
  const trace = bundle.externalTrace.length > 0 ? bundle.externalTrace : bundle.afterTrace.length > 0 ? bundle.afterTrace : bundle.beforeTrace;

  return trace.length > 0 ? JSON.stringify(trace, null, 2) : "[]";
};

export const renderInteractiveViolations = (result: InteractiveCertificationResult | undefined): string => {
  if (!result) {
    return `<p class="empty">No interactive certification has run in this session.</p>`;
  }

  if (result.violations.length === 0) {
    return `<p class="empty">No deterministic violations found.</p>`;
  }

  return `<table class="interactive-violation-table">
    <thead><tr><th>Rule</th><th>Severity</th><th>Trace event</th><th>Reason</th></tr></thead>
    <tbody>${result.violations
      .map(
        (violation) => `<tr>
          <td>${code(violation.ruleId)}</td>
          <td>${value(violation.severity)}</td>
          <td>${code(violation.traceEventId)}</td>
          <td>${value(violation.reason)}</td>
        </tr>`
      )
      .join("")}</tbody>
  </table>`;
};

export const renderInteractivePatchHints = (result: InteractiveCertificationResult | undefined): string => {
  if (!result) {
    return `<p class="empty">No policy patch summary generated.</p>`;
  }

  const summary = result.receipt.policyPatchSummary;

  return `<section class="panel interactive-result-panel">
    <h2>Policy patch summary</h2>
    ${renderFactTable([
      ["Receipt summary", summary.length > 0 ? summary.map((patch) => `${patch.id} / ${patch.status}`).join(" / ") : "none"],
      ["Patch hints", result.patchHints.length > 0 ? result.patchHints.join(" / ") : "none"]
    ])}
  </section>`;
};

export const renderInteractiveCertification = (bundle: UiArtifactBundle, options: RenderOptions): string => {
  const state = options.interactiveCertification ?? { status: "idle" };
  const result = state.result;
  const disabled = state.status === "running";
  const canRun = Boolean(bundle.contract && bundle.missions[0]);
  const sampleTrace = sampleInteractiveTrace(bundle);

  return `<main class="view" data-view="interactive-certification">
    <section class="workbench">
      <div class="section-title">
        <h1>Interactive certification</h1>
      </div>
      <div class="interactive-grid">
        <section class="panel interactive-input-panel">
          <h2>Trace input</h2>
          ${renderFactTable([
            ["Execution", "browser-hosted deterministic certifier"],
            ["Contract", bundle.contract?.id ?? "not loaded"],
            ["Mission", bundle.missions[0]?.id ?? "not loaded"],
            ["Mutation", "false"],
            ["Status", state.status],
            ["Error", state.error ?? "none"]
          ])}
          <form class="import-form interactive-certification-form" data-interactive-certification-form>
            <label>
              <span>Trace JSON</span>
              <textarea rows="16" spellcheck="false" data-interactive-trace-json ${disabled || !canRun ? "disabled" : ""}>${value(sampleTrace)}</textarea>
            </label>
            <label>
              <span>Upload trace</span>
              <input type="file" accept=".json,application/json" data-interactive-trace-file ${disabled || !canRun ? "disabled" : ""}>
            </label>
            <div class="interactive-agent-fields">
              <label>
                <span>Agent name</span>
                <input type="text" data-interactive-agent-name value="Interactive Uploaded Trace Agent" ${disabled || !canRun ? "disabled" : ""}>
              </label>
              <label>
                <span>Agent version</span>
                <input type="text" data-interactive-agent-version value="hosted-demo" ${disabled || !canRun ? "disabled" : ""}>
              </label>
            </div>
            <button class="replay-button" type="submit" ${disabled || !canRun ? "disabled" : ""}>Certify trace</button>
          </form>
        </section>
        <div class="interactive-results">
          <section class="panel interactive-result-panel">
            <h2>Result</h2>
            ${renderFactTable([
              ["Status", result?.status ?? state.status],
              ["Verdict", result?.receipt.verdict ?? "not run"],
              ["Score", result?.receipt.score ?? "not run"],
              ["Trace events", result?.traceEvents.length ?? "not run"],
              ["Violations", result?.violations.length ?? "not run"],
              ["Evidence refs", result?.receipt.evidenceRefs.length ? result.receipt.evidenceRefs.join(" / ") : "none"],
              ["Receipt hash", result?.receipt.receiptHash ?? "not recorded"],
              ["Mutation", result?.mutation === false ? "false" : "false"]
            ])}
          </section>
          ${renderReceiptPanel(result?.receipt, "Interactive Readiness Receipt")}
          <section class="panel interactive-result-panel">
            <h2>Deterministic violations</h2>
            ${renderInteractiveViolations(result)}
          </section>
          ${renderInteractivePatchHints(result)}
        </div>
      </div>
    </section>
  </main>`;
};
