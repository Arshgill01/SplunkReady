import { type PolicyPatch, type ReadinessReceipt, type Violation } from "../../schemas/core.js";
import { type UiArtifacts, type UiArtifactPaths } from "../shell.js";
import { escapeHtml, escapeValue } from "./helpers.js";

export const receiptSummaryRows = (receipt: ReadinessReceipt): string =>
  `<table>
    <tbody>
      <tr><th>Receipt</th><td><code>${escapeHtml(receipt.id)}</code></td></tr>
      <tr><th>Verdict</th><td>${escapeHtml(receipt.verdict)}</td></tr>
      <tr><th>Score</th><td>${escapeValue(receipt.score)}</td></tr>
      <tr><th>Violations</th><td>${escapeValue(receipt.violations.length)}</td></tr>
      <tr><th>Critical</th><td>${escapeValue(receipt.criticalViolations.length)}</td></tr>
    </tbody>
  </table>`;

export const renderScoreComparison = (beforeReceipt: ReadinessReceipt | undefined, afterReceipt: ReadinessReceipt | undefined): string => {
  if (!beforeReceipt || !afterReceipt) {
    return `<p class="empty">Before and after receipts are both required for score comparison.</p>`;
  }

  const resolvedViolations = Array.isArray(afterReceipt.rerunComparison.resolvedViolations)
    ? afterReceipt.rerunComparison.resolvedViolations.map((value) => String(value))
    : beforeReceipt.violations.filter((violationId) => !afterReceipt.violations.includes(violationId));
  const uniqueResolvedViolations = [...new Set(resolvedViolations)];

  return `<table>
    <thead><tr><th>Before score</th><th>After score</th><th>Before verdict</th><th>After verdict</th><th>Resolved violations</th></tr></thead>
    <tbody>
      <tr>
        <td>${escapeValue(beforeReceipt.score)}</td>
        <td>${escapeValue(afterReceipt.score)}</td>
        <td>${escapeHtml(beforeReceipt.verdict)}</td>
        <td>${escapeHtml(afterReceipt.verdict)}</td>
        <td>${uniqueResolvedViolations.length > 0 ? uniqueResolvedViolations.map((id) => `<code>${escapeHtml(id)}</code>`).join(" ") : "None"}</td>
      </tr>
    </tbody>
  </table>`;
};

export const renderPolicyPatch = (policyPatch: PolicyPatch | undefined): string => {
  if (!policyPatch) {
    return `<p class="empty">No policy-patch.json artifact loaded.</p>`;
  }

  const rules = policyPatch.rules
    .map(
      (rule) => `<tr>
        <td><code>${escapeHtml(rule.id)}</code></td>
        <td>${escapeHtml(rule.text)}</td>
      </tr>`
    )
    .join("");

  return `<table>
    <thead><tr><th>Patch rule</th><th>Text</th></tr></thead>
    <tbody>
      <tr><th>Patch</th><td><code>${escapeHtml(policyPatch.id)}</code></td></tr>
      <tr><th>Source receipt</th><td><code>${escapeHtml(policyPatch.sourceReceiptId)}</code></td></tr>
      <tr><th>Status</th><td>${escapeHtml(policyPatch.status)}</td></tr>
      ${rules}
    </tbody>
  </table>`;
};

export const renderCriticalIssueFixPairs = (
  beforeReceipt: ReadinessReceipt | undefined,
  beforeViolations: Violation[],
  policyPatch: PolicyPatch | undefined
): string => {
  if (!beforeReceipt || beforeReceipt.criticalViolations.length === 0) {
    return `<p class="empty">No critical issues in the failed receipt.</p>`;
  }

  const violationById = new Map(beforeViolations.map((violation) => [violation.id, violation]));
  const patchRules = policyPatch?.rules ?? [];
  const criticalViolationIds = [...new Set(beforeReceipt.criticalViolations)];
  const matchingPatchRule = (violation: Violation | undefined, index: number): PolicyPatch["rules"][number] | undefined => {
    if (!violation) {
      return patchRules[index];
    }

    if (violation.ruleId.startsWith("EVD") || violation.ruleId.startsWith("ANS")) {
      return patchRules.find((rule) => rule.id.includes("evidence") || rule.text.toLowerCase().includes("evidence"));
    }

    if (violation.ruleId.startsWith("KO") || violation.ruleId === "SPL-003") {
      return patchRules.find((rule) => rule.id.includes("saved-search") || rule.text.toLowerCase().includes("saved search"));
    }

    if (violation.ruleId === "SPL-001" || violation.ruleId.startsWith("SAF")) {
      return patchRules.find((rule) => rule.id.includes("contract") || rule.text.toLowerCase().includes("contract"));
    }

    return patchRules[index];
  };

  const rows = criticalViolationIds
    .map((violationId, index) => {
      const violation = violationById.get(violationId);
      const patchRule = matchingPatchRule(violation, index);
      const fallbackFix = violation?.suggestedPolicyPatch;

      return `<tr>
        <td><code>${escapeHtml(violationId)}</code>${violation ? `<br><code>${escapeHtml(violation.ruleId)}</code> ${escapeHtml(violation.reason)}` : ""}</td>
        <td>${patchRule ? `<code>${escapeHtml(patchRule.id)}</code><br>${escapeHtml(patchRule.text)}` : escapeHtml(fallbackFix ?? "No patch rule mapped.")}</td>
      </tr>`;
    })
    .join("");

  return `<table>
    <thead><tr><th>Critical issue</th><th>Policy patch or fix</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
};

export const renderReceiptRerunView = (artifacts: UiArtifacts): string => {
  const beforeReceipt = artifacts.beforeReceipt ?? (artifacts.phase === "before" ? artifacts.receipt : undefined);
  const afterReceipt = artifacts.afterReceipt ?? (artifacts.phase === "after" ? artifacts.receipt : undefined);
  const failComplete = Boolean(beforeReceipt) || artifacts.receipt.verdict === "NOT READY";
  const patchComplete = Boolean(artifacts.policyPatch);
  const rerunComplete = Boolean(artifacts.afterReceipt) || artifacts.phase === "after";
  const passComplete = afterReceipt?.verdict === "READY";
  const stepClass = (complete: boolean): string => (complete ? "readiness-step readiness-step-complete" : "readiness-step");
  const stepState = (complete: boolean): string => (complete ? "complete" : "pending");

  return `<section id="rerun-receipts" class="shell-section" data-route-panel="rerun-receipts" aria-label="Readiness receipt rerun comparison">
    <h2>Receipts and rerun</h2>
    <div class="readiness-flow" aria-label="Readiness lifecycle">
      <div class="${stepClass(failComplete)}">
        <div class="step-index">1</div>
        <div><strong>Fail</strong><span>${stepState(failComplete)}</span></div>
      </div>
      <div class="${stepClass(patchComplete)}">
        <div class="step-index">2</div>
        <div><strong>Patch</strong><span>${stepState(patchComplete)}</span></div>
      </div>
      <div class="${stepClass(rerunComplete)}">
        <div class="step-index">3</div>
        <div><strong>Rerun</strong><span>${stepState(rerunComplete)}</span></div>
      </div>
      <div class="${stepClass(passComplete)}">
        <div class="step-index">4</div>
        <div><strong>Pass</strong><span>${stepState(passComplete)}</span></div>
      </div>
    </div>
    <div class="receipt-comparison">
      <div>
        <h3>Failed receipt</h3>
        ${beforeReceipt ? receiptSummaryRows(beforeReceipt) : `<p class="empty">No receipt-before-001.json artifact loaded.</p>`}
      </div>
      <div>
        <h3>Rerun receipt</h3>
        ${afterReceipt ? receiptSummaryRows(afterReceipt) : `<p class="empty">No receipt-after-001.json artifact loaded.</p>`}
      </div>
    </div>
    <div class="trace-phases">
      <div>
        <h3>Score comparison</h3>
        ${renderScoreComparison(beforeReceipt, afterReceipt)}
      </div>
      <div>
        <h3>Policy patch</h3>
        ${renderPolicyPatch(artifacts.policyPatch)}
      </div>
      <div>
        <h3>Critical issues and fixes</h3>
        ${renderCriticalIssueFixPairs(beforeReceipt, artifacts.beforeViolations ?? [], artifacts.policyPatch)}
      </div>
    </div>
  </section>`;
};

export const renderArtifactPaths = (paths: UiArtifactPaths): string =>
  `<dl class="artifact-paths">
    ${paths.contract ? `<div><dt>Contract</dt><dd><code>${escapeHtml(paths.contract)}</code></dd></div>` : ""}
    ${paths.missions ? `<div><dt>Missions</dt><dd><code>${escapeHtml(paths.missions)}</code></dd></div>` : ""}
    ${paths.beforeTrace ? `<div><dt>Before trace</dt><dd><code>${escapeHtml(paths.beforeTrace)}</code></dd></div>` : ""}
    ${paths.beforeViolations ? `<div><dt>Before violations</dt><dd><code>${escapeHtml(paths.beforeViolations)}</code></dd></div>` : ""}
    ${paths.afterTrace ? `<div><dt>After trace</dt><dd><code>${escapeHtml(paths.afterTrace)}</code></dd></div>` : ""}
    ${paths.afterViolations ? `<div><dt>After violations</dt><dd><code>${escapeHtml(paths.afterViolations)}</code></dd></div>` : ""}
    ${paths.beforeReceipt ? `<div><dt>Before receipt</dt><dd><code>${escapeHtml(paths.beforeReceipt)}</code></dd></div>` : ""}
    ${paths.afterReceipt ? `<div><dt>After receipt</dt><dd><code>${escapeHtml(paths.afterReceipt)}</code></dd></div>` : ""}
    ${paths.policyPatchJson ? `<div><dt>Policy patch JSON</dt><dd><code>${escapeHtml(paths.policyPatchJson)}</code></dd></div>` : ""}
    ${paths.policyPatchMarkdown ? `<div><dt>Policy patch Markdown</dt><dd><code>${escapeHtml(paths.policyPatchMarkdown)}</code></dd></div>` : ""}
    ${paths.readinessProfile ? `<div><dt>Readiness profile</dt><dd><code>${escapeHtml(paths.readinessProfile)}</code></dd></div>` : ""}
    <div><dt>Receipt</dt><dd><code>${escapeHtml(paths.receipt)}</code></dd></div>
    <div><dt>Trace</dt><dd><code>${escapeHtml(paths.trace)}</code></dd></div>
    <div><dt>Violations</dt><dd><code>${escapeHtml(paths.violations)}</code></dd></div>
  </dl>`;
