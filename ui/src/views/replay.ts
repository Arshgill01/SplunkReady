import type { UiArtifactBundle } from "../artifacts.js";
import type { RenderOptions, WorkbenchRenderState } from "../render.js";
import {
  value,
  renderFactTable,
  renderProofArtifactWarning,
  renderReceiptPanel,
  renderLiveProofSummary
} from "./helpers.js";
import { renderPolicyPatchSummary } from "./policy.js";

export const renderStage = (index: number, title: string, status: string, detail: string): string =>
  `<li class="stage" style="--stage-index: ${index}">
    <span>${index}</span>
    <strong>${value(title)}</strong>
    <em>${value(status)}</em>
    <p>${value(detail)}</p>
  </li>`;

export const renderWorkbenchRunPanel = (workbench: WorkbenchRenderState | undefined): string => {
  const job = workbench?.job;
  const events = job?.events ?? [];
  const disabled = !workbench?.available || job?.state === "queued" || job?.state === "running";

  return `<section class="panel workbench-run-panel">
    <div class="run-panel-header">
      <h2>Fixture certification run</h2>
      <button class="replay-button" type="button" data-run-fixture-certification ${disabled ? "disabled" : ""}>
        Run fixture certification
      </button>
    </div>
    ${renderFactTable([
      ["Backend", workbench?.available ? (workbench.healthStatus ?? "available") : "not connected"],
      ["Job", job ? `${job.id} / ${job.state}` : "none"],
      ["Run", job ? job.runId : "server-owned run directory allocated after start"],
      ["Artifact base", job ? job.artifactBase : "n/a"],
      ["Error", job?.error ?? "none"]
    ])}
    ${
      events.length > 0
        ? `<ol class="job-events" aria-label="Workbench job events">
            ${events
              .map((event) => `<li data-job-event="${value(event.type)}"><strong>${value(event.type)}</strong><span>${value(event.message)}</span></li>`)
              .join("")}
          </ol>`
        : `<p class="empty">${value(
            workbench?.available
              ? "Start a server-owned fixture certification to produce fresh artifacts."
              : "Start the local workbench backend to execute runs from this screen."
          )}</p>`
    }
  </section>`;
};

export const renderReplay = (bundle: UiArtifactBundle, options: RenderOptions): string => {
  const before = bundle.beforeReceipt;
  const after = bundle.afterReceipt;
  const patch = bundle.policyPatch;
  const proof = bundle.liveProofSummary;
  const resolved = before && after ? Math.max(0, before.violations.length - after.violations.length) : 0;
  const stages = proof?.readyWithoutPatch
    ? [
        ["Certify", before?.verdict ?? "missing", `${bundle.beforeTrace.length} trace event(s)`],
        ["Patch", "not needed", "before receipt was READY"],
        ["Rerun", after ? "complete" : "missing", `${bundle.afterTrace.length} trace event(s)`],
        ["Ready", after?.verdict ?? "missing", `${after?.violations.length ?? 0} violation(s)`]
      ]
    : [
        ["Fail", before?.verdict ?? "missing", `${bundle.beforeViolations.length} deterministic violation(s)`],
        ["Patch", patch?.status ?? "missing", `${patch?.rules.length ?? 0} rule(s), ${patch?.splAssistance?.length ?? 0} SAIA item(s)`],
        ["Rerun", after ? "complete" : "missing", `${bundle.afterTrace.length} trace event(s)`],
        ["Pass", after?.verdict ?? "missing", `${resolved} resolved violation(s)`]
      ];
  const patchEmptyMessage = proof?.readyWithoutPatch
    ? "No policy patch was exported because the live-derived mission was READY before policy injection."
    : "Policy patch artifact not loaded.";

  return `<main class="view replay-view" data-view="certification-replay">
    <section class="workbench">
      <div class="section-title">
        <h1>Certification replay</h1>
      </div>
      ${renderWorkbenchRunPanel(options.workbench)}
      ${renderProofArtifactWarning(bundle)}
      <ol class="stage-line" aria-label="Certification replay stages">
        ${stages.map(([title, status, detail], index) => renderStage(index + 1, title, status, detail)).join("")}
      </ol>
      <div class="replay-grid">
        ${renderReceiptPanel(before, "Before")}
        ${renderReceiptPanel(after, "After")}
      </div>
      ${renderLiveProofSummary(bundle)}
      <section class="panel patch-panel">
        <h2>Patch evidence</h2>
        ${renderPolicyPatchSummary(patch, patchEmptyMessage)}
      </section>
    </main>`;
};
