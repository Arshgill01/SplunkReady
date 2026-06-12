import type { UiArtifactBundle } from "../artifacts.js";
import type { RenderOptions, WorkbenchRenderState } from "../render.js";
import type { PolicyPatch, Violation } from "../../../src/schemas/core.js";
import {
  value,
  renderFactTable,
  stringListFromUnknown,
  violationsById,
  splAssistanceByViolation,
  renderFirewallBlock,
  renderProofAuditPanel
} from "./helpers.js";

export const policyActionRows = [
  ["policy-backed-rerun", "Run policy-backed rerun", "Generate NOT READY, export policy additions, rerun under compiled policy."],
  ["firewall-check", "Run firewall check", "Compile policy and block unsafe SPL before any Splunk execution."]
] as const;

export const renderPolicyWorkbenchPanel = (workbench: WorkbenchRenderState | undefined): string => {
  const job = workbench?.job;
  const running = job?.state === "queued" || job?.state === "running";
  const disabled = !workbench?.available || running;

  return `<section class="panel policy-action-panel">
    <h2>Policy workbench</h2>
    ${renderFactTable([
      ["Backend", workbench?.available ? (workbench.healthStatus ?? "available") : "not connected"],
      ["Patch semantics", "exported additions for human review"],
      ["Firewall scope", "pre-execution Splunk tool gate"],
      ["Mutation", "false"],
      ["Pass/fail authority", "deterministic-rule-engine"]
    ])}
    <div class="live-action-list policy-action-list">
      ${policyActionRows
        .map(
          ([workflow, label, detail]) => `<button class="replay-button live-action-button" type="button" data-run-workflow="${workflow}" ${disabled ? "disabled" : ""}>
            <strong>${value(label)}</strong>
            <span>${value(detail)}</span>
          </button>`
        )
        .join("")}
    </div>
    ${
      job
        ? `<div class="job-status">
            ${renderFactTable([
              ["Job", `${job.id} / ${job.workflow ?? "unknown"} / ${job.state}`],
              ["Run", job.runId],
              ["Artifacts", job.artifactBase || "not allocated"],
              ["Error", job.error ?? "none"]
            ])}
            <ol class="job-events" aria-label="Policy workbench job events">
              ${job.events
                .map((event) => `<li data-job-event="${value(event.type)}"><strong>${value(event.type)}</strong><span>${value(event.message)}</span></li>`)
                .join("")}
            </ol>
          </div>`
        : `<p class="empty">${value(
            workbench?.available
              ? "Run a server-owned policy action to produce fresh review artifacts."
              : "Start the local workbench backend to execute policy actions from this screen."
          )}</p>`
    }
  </section>`;
};

export const renderPolicyPatchSummary = (
  policyPatch: PolicyPatch | undefined,
  emptyMessage = "Policy patch artifact not loaded."
): string => {
  if (!policyPatch) {
    return `<p class="empty">${value(emptyMessage)}</p>`;
  }

  const assistance = policyPatch.splAssistance ?? [];

  return `<div class="patch-grid">
    ${renderFactTable([
      ["Patch", policyPatch.id],
      ["Status", policyPatch.status],
      ["Source receipt", policyPatch.sourceReceiptId],
      ["Rules", policyPatch.rules.length],
      ["SAIA items", assistance.length]
    ])}
    <div class="patch-rules">
      ${policyPatch.rules.map((rule) => `<article><strong>${value(rule.id)}</strong><p>${value(rule.text)}</p></article>`).join("")}
      ${assistance
        .map(
          (item) => `<article>
            <strong>${value(item.ruleId)} / SAIA</strong>
            <p>SAIA Explanation: ${value(item.explanation)}</p>
            <p>SAIA Optimized Query: ${value(item.optimizedQuery)}</p>
          </article>`
        )
        .join("")}
    </div>
  </div>`;
};

export const renderPatchViolationMap = (policyPatch: PolicyPatch | undefined, violations: Violation[]): string => {
  if (!policyPatch) {
    return `<p class="empty">Policy patch artifact not loaded.</p>`;
  }

  const byId = violationsById(violations);
  const assistance = splAssistanceByViolation(policyPatch);

  return `<div class="patch-map">
    ${policyPatch.violationRefs
      .map((violationRef) => {
        const violation = byId.get(violationRef);
        const item = assistance.get(violationRef);

        return `<article>
          <strong>${value(violationRef)}</strong>
          ${renderFactTable([
            ["Rule", violation?.ruleId ?? item?.ruleId ?? "n/a"],
            ["Severity", violation?.severity ?? "n/a"],
            ["Trace event", violation?.traceEventId ?? "n/a"],
            ["Deterministic reason", violation?.reason ?? "violation artifact not loaded"],
            ["Suggested policy", violation?.suggestedPolicyPatch ?? "n/a"],
            ["SAIA role", item ? "advisory generate/explain/optimize/ask" : "not invoked"],
            ["SAIA optimized SPL", item?.optimizedQuery ?? "n/a"]
          ])}
        </article>`;
      })
      .join("")}
  </div>`;
};

export const renderPolicyFirewall = (bundle: UiArtifactBundle, options: RenderOptions): string => {
  const before = bundle.beforeReceipt;
  const after = bundle.afterReceipt;
  const patch = bundle.policyPatch;
  const resolvedViolations = stringListFromUnknown(after?.rerunComparison["resolvedViolations"]);

  return `<main class="view policy-firewall-view" data-view="policy-firewall">
    <section class="workbench">
      <div class="section-title">
        <h1>Policy and firewall</h1>
      </div>
      <div class="receipt-ledger">
        ${renderPolicyWorkbenchPanel(options.workbench)}
        <section class="panel">
          <h2>Readiness transition</h2>
          ${renderFactTable([
            ["Before", before ? `${before.verdict} / ${before.score}` : "not loaded"],
            ["After", after ? `${after.verdict} / ${after.score}` : "not loaded"],
            ["Resolved violations", resolvedViolations.length > 0 ? resolvedViolations.join(" / ") : "n/a"],
            ["Receipt authority", "receipt artifacts"],
            ["UI recalculation", "none"]
          ])}
        </section>
        <section class="panel patch-panel policy-patch-panel">
          <h2>Exported policy additions</h2>
          ${renderFactTable([
            ["Patch", patch?.id ?? "not loaded"],
            ["Status", patch?.status ?? "not loaded"],
            ["Source receipt", patch?.sourceReceiptId ?? "not loaded"],
            ["Violation refs", patch?.violationRefs.join(" / ") ?? "n/a"],
            ["Mutation", "false"],
            ["Splunk apply action", "none"]
          ])}
          ${renderPolicyPatchSummary(patch)}
        </section>
        <section class="panel">
          <h2>Violation mapping</h2>
          ${renderPatchViolationMap(patch, bundle.beforeViolations)}
        </section>
        ${renderFirewallBlock(bundle.firewallBlock)}
        ${renderProofAuditPanel(bundle.proofAudit)}
      </div>
    </section>
  </main>`;
};
