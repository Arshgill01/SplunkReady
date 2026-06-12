import type { UiArtifactBundle } from "../artifacts.js";
import type { RenderOptions, WorkbenchRenderState } from "../render.js";
import { value, renderFactTable, renderProofAuditPanel, renderReceiptPanel } from "./helpers.js";
import { renderMcpTranscriptImport } from "./mcp.js";

export const renderImportJobStatus = (workbench: WorkbenchRenderState | undefined): string => {
  const job = workbench?.job;

  if (!job) {
    return "";
  }

  return `<section class="panel">
    <h2>Import job</h2>
    ${renderFactTable([
      ["Job", `${job.id} / ${job.workflow ?? "unknown"} / ${job.state}`],
      ["Run", job.runId],
      ["Input", job.inputSummary ?? "not recorded"],
      ["Artifacts", job.artifactBase || "not allocated"],
      ["Error", job.error ?? "none"]
    ])}
    ${
      job.events.length > 0
        ? `<ol class="job-events" aria-label="Import certification job events">
            ${job.events
              .map((event) => `<li data-job-event="${value(event.type)}"><strong>${value(event.type)}</strong><span>${value(event.message)}</span></li>`)
              .join("")}
          </ol>`
        : ""
    }
  </section>`;
};

export const renderImportCertification = (bundle: UiArtifactBundle, options: RenderOptions): string => {
  const running = options.workbench?.job?.state === "queued" || options.workbench?.job?.state === "running";
  const disabled = !options.workbench?.available || running;

  return `<main class="view" data-view="import-certification">
    <section class="workbench">
      <div class="section-title">
        <h1>External certification import</h1>
      </div>
      <div class="receipt-ledger">
        <section class="panel import-panel">
          <h2>External trace</h2>
          ${renderFactTable([
            ["Boundary", "producer-supplied canonical TraceEvent array"],
            ["Certification", "server compiles contract, grades trace, writes receipt and proof audit"],
            ["Mutation", "false"]
          ])}
          <form class="import-form" data-external-trace-form>
            <label>
              <span>Trace JSON</span>
              <input type="file" accept=".json,application/json" data-external-trace-file ${disabled ? "disabled" : ""}>
            </label>
            <label>
              <span>Agent name</span>
              <input type="text" data-external-trace-agent-name value="External Splunk MCP Agent" ${disabled ? "disabled" : ""}>
            </label>
            <label>
              <span>Agent version</span>
              <input type="text" data-external-trace-agent-version value="uploaded-trace" ${disabled ? "disabled" : ""}>
            </label>
            <label class="check-row">
              <input type="checkbox" data-external-trace-require-pass ${disabled ? "disabled" : ""}>
              <span>Require READY receipt</span>
            </label>
            <button class="replay-button" type="submit" ${disabled ? "disabled" : ""}>Certify trace</button>
          </form>
        </section>
        <section class="panel import-panel">
          <h2>MCP transcript</h2>
          ${renderFactTable([
            ["Boundary", "read-only Splunk MCP JSON-RPC transcript"],
            ["Strict import", "checks transcript structure, not independent readiness"],
            ["Final answer", "producer-provided and appended server-side"],
            ["Mutation", "false"]
          ])}
          <form class="import-form" data-mcp-transcript-form>
            <label>
              <span>Transcript JSONL</span>
              <input type="file" accept=".jsonl,.json,application/json,text/plain" data-mcp-transcript-file ${disabled ? "disabled" : ""}>
            </label>
            <label>
              <span>Final answer</span>
              <textarea rows="5" data-mcp-transcript-final-answer ${disabled ? "disabled" : ""}>Evidence supports suspicious lateral movement. Provenance saved-search-lateral-movement returned 3 rows for the -24h to now window with evidence evt-102, evt-118, and evt-141.</textarea>
            </label>
            <label>
              <span>Agent name</span>
              <input type="text" data-mcp-transcript-agent-name value="External MCP Transcript Agent" ${disabled ? "disabled" : ""}>
            </label>
            <label>
              <span>Agent version</span>
              <input type="text" data-mcp-transcript-agent-version value="uploaded-jsonrpc-transcript" ${disabled ? "disabled" : ""}>
            </label>
            <label class="check-row">
              <input type="checkbox" data-mcp-transcript-strict-import checked ${disabled ? "disabled" : ""}>
              <span>Strict import</span>
            </label>
            <label class="check-row">
              <input type="checkbox" data-mcp-transcript-require-pass ${disabled ? "disabled" : ""}>
              <span>Require READY receipt</span>
            </label>
            <button class="replay-button" type="submit" ${disabled ? "disabled" : ""}>Certify transcript</button>
          </form>
        </section>
        <section class="panel">
          <h2>Current artifact</h2>
          ${renderFactTable([
            ["Artifact base", bundle.artifactBase],
            ["External trace events", bundle.externalTrace.length],
            ["Imported transcript events", bundle.importedTrace.length],
            ["Receipt", bundle.receipt?.id ?? "not loaded"],
            ["Proof audit", bundle.proofAudit?.status ?? "not loaded"],
            ["Manifest", "written with proof audit artifacts"]
          ])}
        </section>
        ${renderImportJobStatus(options.workbench)}
        ${renderReceiptPanel(bundle.receipt, "External receipt")}
        ${renderProofAuditPanel(bundle.proofAudit)}
        ${renderMcpTranscriptImport(bundle.mcpTranscriptImport)}
      </div>
    </section>
  </main>`;
};
