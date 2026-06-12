import type { UiArtifactBundle, CertificationIndex } from "../artifacts.js";
import type { RenderOptions, ViewId, WorkbenchRenderState } from "../render.js";
import { value, code, renderFactTable } from "./helpers.js";
import { sortRunsByCreatedAt, isIndexableRun } from "../runBrowser.js";

export const indexEntryHref = (proofDir: string, view: ViewId): string =>
  `?artifacts=${encodeURIComponent(proofDir)}#${view}`;

export const renderCertificationIndexRows = (index: CertificationIndex): string =>
  index.entries
    .map((entry) => {
      const receipt = entry.receipt;
      const receiptHref = entry.href || indexEntryHref(entry.proofDir, "receipt");
      const traceHref = indexEntryHref(entry.proofDir, "trace-timeline");

      return `<tr>
        <td data-label="Agent">${value(entry.label)}<span>${value(entry.agent.version)}</span></td>
        <td data-label="Domain / mission">${value(entry.domains.length > 0 ? entry.domains.join(" / ") : "n/a")}<span>${value(
          entry.missions.length > 0 ? entry.missions.join(" / ") : "no missions"
        )}</span></td>
        <td data-label="Audit">${value(entry.status)}<span>${value(entry.proofType)}</span></td>
        <td data-label="Receipt">${value(receipt?.verdict ?? "NO RECEIPT")}<span>${value(receipt ? `${receipt.score}/100` : "--")}</span></td>
        <td data-label="Loop / mutation">${value(entry.proofLoop ?? "n/a")}<span>${value(entry.mutation === null ? "mutation unknown" : entry.mutation ? "mutation yes" : "mutation no")}</span></td>
        <td data-label="Manifest">${value(entry.manifestStatus)}<span>${value(
          entry.manifest ? `${entry.manifest.files} files / ${entry.manifest.aggregateSha256.slice(0, 12)}` : "no manifest"
        )}</span></td>
        <td data-label="Proof links">
          <a href="${value(receiptHref)}" data-proof-artifact="${value(entry.proofDir)}" data-proof-view="receipt">Receipt</a>
          <a href="${value(traceHref)}" data-proof-artifact="${value(entry.proofDir)}" data-proof-view="trace-timeline">Trace</a>
          <span>${value(receipt ? `${receipt.violations} violation(s) / ${receipt.evidenceRefs} ref(s)` : "no receipt")}</span>
        </td>
      </tr>`;
    })
    .join("");

export const renderCertificationIndexJobStatus = (workbench: WorkbenchRenderState | undefined): string => {
  const job = workbench?.job?.workflow === "certification-index" ? workbench.job : undefined;

  if (!job) {
    return "";
  }

  return `<section class="panel">
    <h2>Index job</h2>
    ${renderFactTable([
      ["Job", `${job.id} / ${job.state}`],
      ["Run", job.runId],
      ["Input", job.inputSummary ?? "not recorded"],
      ["Artifacts", job.artifactBase || "not allocated"],
      ["Error", job.error ?? "none"]
    ])}
    ${
      job.events.length > 0
        ? `<ol class="job-events" aria-label="Certification index job events">
            ${job.events
              .map((event) => `<li data-job-event="${value(event.type)}"><strong>${value(event.type)}</strong><span>${value(event.message)}</span></li>`)
              .join("")}
          </ol>`
        : ""
    }
  </section>`;
};

export const renderCertificationIndexWorkbench = (workbench: WorkbenchRenderState | undefined): string => {
  const running = workbench?.job?.state === "queued" || workbench?.job?.state === "running";
  const runs = sortRunsByCreatedAt((workbench?.runs ?? []).filter(isIndexableRun));
  const disabled = !workbench?.available || running || runs.length < 2;
  const selected = new Set(runs.slice(0, 2).map((run) => run.runId));

  return `<section class="panel certification-index-builder">
    <h2>Generate from managed runs</h2>
    ${renderFactTable([
      ["Backend", workbench?.available ? (workbench.healthStatus ?? "available") : "not connected"],
      ["Selectable proofs", runs.length],
      ["Boundary", "managed artifact run IDs only"],
      ["Verification", "server verifies every proof manifest before indexing"],
      ["Mutation", "false"]
    ])}
    <form class="index-run-form" data-certification-index-form>
      ${
        runs.length === 0
          ? `<p class="empty">No managed proof runs with proof audit and manifest artifacts are available.</p>`
          : `<div class="index-run-list">
              ${runs
                .map(
                  (run) => `<label class="index-run-row">
                    <input type="checkbox" value="${value(run.runId)}" data-index-run ${selected.has(run.runId) ? "checked" : ""} ${
                      disabled ? "disabled" : ""
                    }>
                    <span>
                      ${code(run.runId)}
                      <em>${value(run.workflow)} / ${value(run.verdict)} / audit ${value(run.proofAuditStatus)} / manifest ${value(run.manifestStatus)}</em>
                    </span>
                  </label>`
                )
                .join("")}
            </div>`
      }
      <button class="replay-button" type="submit" ${disabled ? "disabled" : ""}>Generate certification index</button>
    </form>
  </section>`;
};

export const renderCertificationIndex = (bundle: UiArtifactBundle, options: RenderOptions): string => {
  const index = bundle.certificationIndex;

  if (!index) {
    return `<main class="view" data-view="agent-index">
      <section class="workbench">
        <div class="section-title"><h1>Agent certification index</h1></div>
        <div class="receipt-ledger">
          ${renderCertificationIndexWorkbench(options.workbench)}
          ${renderCertificationIndexJobStatus(options.workbench)}
          <section class="panel">
            <h2>Index artifact not loaded</h2>
            ${renderFactTable([
              ["Expected artifact", "certification-index.json"],
              [
                "Command",
                "npm run splunkready -- certification-index --proof-dirs artifacts/live-security-ui,artifacts/mcp-transcript --out artifacts/certification-index --json"
              ]
            ])}
          </section>
        </div>
      </section>
    </main>`;
  }

  return `<main class="view" data-view="agent-index">
    <section class="workbench">
      <div class="section-title"><h1>Agent certification index</h1></div>
      <div class="receipt-ledger">
        ${renderCertificationIndexWorkbench(options.workbench)}
        ${renderCertificationIndexJobStatus(options.workbench)}
        <section class="panel">
          <h2>Index summary</h2>
          ${renderFactTable([
            ["Status", index.status],
            ["Proofs", index.totals.proofs],
            ["Ready receipts", index.totals.ready],
            ["Not ready receipts", index.totals.notReady],
            ["Audit pass / warn / fail", `${index.totals.pass} / ${index.totals.warn} / ${index.totals.fail}`],
            ["Mutation", index.mutation ? "yes" : "no"],
            ["Generated", index.generatedAt]
          ])}
        </section>
        <section class="panel">
          <h2>Agent proofs</h2>
          <table class="index-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Domain / mission</th>
                <th>Audit</th>
                <th>Receipt</th>
                <th>Loop / mutation</th>
                <th>Manifest</th>
                <th>Proof links</th>
              </tr>
            </thead>
            <tbody>${renderCertificationIndexRows(index)}</tbody>
          </table>
        </section>
      </div>
    </section>
  </main>`;
};
