import type { UiArtifactBundle, ProofAudit, FirewallBlock } from "../artifacts.js";
import type { PolicyPatch, Violation, ReadinessReceipt } from "../../../src/schemas/core.js";

export const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const value = (input: unknown): string => escapeHtml(String(input ?? "n/a"));

export const code = (input: unknown): string => `<code>${value(input)}</code>`;

export const stringListFromUnknown = (input: unknown): string[] =>
  Array.isArray(input) ? input.map((item) => String(item)) : [];

export const violationByEvent = (violations: Violation[]): Map<string, Violation[]> => {
  const grouped = new Map<string, Violation[]>();
  for (const violation of violations) {
    grouped.set(violation.traceEventId, [...(grouped.get(violation.traceEventId) ?? []), violation]);
  }
  return grouped;
};

export const splAssistanceByViolation = (
  policyPatch: PolicyPatch | undefined
): Map<string, NonNullable<PolicyPatch["splAssistance"]>[number]> => {
  const grouped = new Map<string, NonNullable<PolicyPatch["splAssistance"]>[number]>();
  for (const assistance of policyPatch?.splAssistance ?? []) {
    grouped.set(assistance.violationRef, assistance);
  }
  return grouped;
};

export const violationsById = (violations: Violation[]): Map<string, Violation> => {
  const grouped = new Map<string, Violation>();
  for (const violation of violations) {
    grouped.set(violation.id, violation);
  }
  return grouped;
};

export const renderFactTable = (rows: Array<[string, unknown]>): string =>
  `<table class="fact-table"><tbody>${rows
    .map(([label, rowValue]) => `<tr><th>${value(label)}</th><td>${value(rowValue)}</td></tr>`)
    .join("")}</tbody></table>`;

export const renderPlainList = (items: readonly string[], className: string): string =>
  `<ul class="${value(className)}">${items.map((item) => `<li>${value(item)}</li>`).join("")}</ul>`;

export const renderProofArtifactWarning = (bundle: UiArtifactBundle): string => {
  const hasReceipt = Boolean(bundle.receipt);
  const hasTrace =
    bundle.beforeTrace.length > 0 ||
    bundle.afterTrace.length > 0 ||
    bundle.externalTrace.length > 0 ||
    bundle.importedTrace.length > 0;
  const hasFirewallBlock = Boolean(bundle.firewallBlock);

  if ((hasReceipt && hasTrace) || hasFirewallBlock) {
    return "";
  }

  return `<section class="panel artifact-warning">
    <h2>Artifact bundle incomplete</h2>
    ${renderFactTable([
      ["Artifact base", bundle.artifactBase],
      ["Receipt loaded", hasReceipt ? "yes" : "no"],
      ["Trace loaded", hasTrace ? "yes" : "no"],
      ["Security readiness", bundle.liveSecurityReadiness ? bundle.liveSecurityReadiness.status : "not loaded"],
      [
        "Bundle command",
        "npm run splunkready -- live-security-ui-bundle --proof-dir artifacts/live-proof --security-check-dir artifacts/live-security-check --security-kit-dir artifacts/live-security-kit --out artifacts/live-security-ui --json"
      ]
    ])}
  </section>`;
};

export const renderProofAuditSummaryRows = (audit: ProofAudit): Array<[string, unknown]> => [
  ["Status", audit.status],
  ["Proof type", audit.proofType],
  ["Mode", audit.mode ?? "n/a"],
  ["Fail to pass", audit.failToPass === undefined ? "n/a" : audit.failToPass ? "yes" : "no"],
  ["Ready after patch", audit.readyAfterPatch === undefined ? "n/a" : audit.readyAfterPatch ? "yes" : "no"],
  ["Proof loop", audit.proofLoop ?? "n/a"],
  ["Mutation", audit.mutation === undefined ? "n/a" : audit.mutation ? "yes" : "no"],
  ["Hosted models", audit.hostedModelStatus ?? "not loaded"]
];

export const renderProofAuditPanel = (audit: ProofAudit | undefined): string => {
  if (!audit) {
    return "";
  }

  const failingChecks = audit.checks.filter((check) => check.status !== "PASS");

  return `<section class="panel proof-audit-panel">
    <h2>Proof audit</h2>
    ${renderFactTable([
      ...renderProofAuditSummaryRows(audit),
      ["Checks", audit.checks.map((check) => `${check.id} / ${check.status}`).join(" / ")],
      [
        "Warnings or failures",
        failingChecks.length > 0 ? failingChecks.map((check) => `${check.id}: ${check.detail}`).join(" / ") : "none"
      ]
    ])}
  </section>`;
};

export const renderFirewallBlock = (block: FirewallBlock | undefined): string => {
  if (!block) {
    return "";
  }

  return `<section class="panel firewall-block-panel">
    <h2>Firewall block</h2>
    ${renderFactTable([
      ["Status", block.status],
      ["Code", block.code],
      ["Phase", block.phase],
      ["Tool", block.toolName],
      ["Request", block.requestId],
      ["Mission", block.missionId ?? "n/a"],
      ["Blocked before Splunk", block.blockedBeforeSplunk ? "yes" : "no"],
      ["Mutation", block.mutation ? "yes" : "no"],
      ["Query", block.query ?? "n/a"],
      ["Rules", (block.violations ?? []).map((violation) => `${violation.ruleId}: ${violation.reason}`).join(" / ")],
      ["Message", block.message]
    ])}
  </section>`;
};

export const renderLiveProofSummaryTable = (bundle: UiArtifactBundle): string => {
  const summary = bundle.liveProofSummary;

  if (!summary) {
    return `<p class="empty">Live proof summary artifact not loaded.</p>`;
  }

  return renderFactTable([
    ["Derived mission", summary.derivedMission.missionId ?? "n/a"],
    ["Strategy", summary.derivedMission.strategy],
    ["Before", `${summary.before.verdict} / ${summary.before.score}`],
    ["After", `${summary.after.verdict} / ${summary.after.score}`],
    ["Proof loop", summary.proofLoop],
    ["Fail to pass", summary.failToPass ? "yes" : "no"],
    ["Ready without patch", summary.readyWithoutPatch ? "yes" : "no"],
    ["Mutation", summary.mutation ? "yes" : "no"],
    ["Notes", summary.notes]
  ]);
};

export const renderLiveProofSummary = (bundle: UiArtifactBundle): string => {
  const summary = bundle.liveProofSummary;

  if (!summary) {
    return "";
  }

  return `<section class="panel live-proof-panel">
    <h2>Live proof summary</h2>
    ${renderLiveProofSummaryTable(bundle)}
  </section>`;
};

export const renderLiveSecurityProofSummary = (bundle: UiArtifactBundle): string => {
  const summary = bundle.liveSecurityProofSummary;

  if (!summary) {
    return "";
  }

  return `<section class="panel live-security-proof-panel">
    <h2>Flagship security proof</h2>
    ${renderFactTable([
      ["Status", summary.status],
      ["Readiness", summary.readinessStatus],
      ["Mission", summary.mission],
      ["Before", `${summary.before.verdict} / ${summary.before.score} / ${summary.before.violations} violation(s)`],
      ["After", `${summary.after.verdict} / ${summary.after.score} / ${summary.after.violations} violation(s)`],
      ["Proof loop", summary.proofLoop],
      ["Fail to pass", summary.failToPass ? "yes" : "no"],
      ["Ready after patch", summary.readyAfterPatch ? "yes" : "no"],
      ["Evidence refs", summary.after.evidenceRefs.join(" / ")],
      ["Mutation", summary.mutation ? "yes" : "no"],
      ["Notes", summary.notes]
    ])}
  </section>`;
};

export const renderReceiptPanel = (receipt: ReadinessReceipt | undefined, title: string): string => {
  if (!receipt) {
    return `<section class="panel"><h2>${value(title)}</h2><p class="empty">Receipt artifact not loaded.</p></section>`;
  }

  const policyRows: Array<[string, unknown]> = receipt.policy
    ? [["Policy", `${receipt.policy.name} ${receipt.policy.version} / ${receipt.policy.id}`]]
    : [];

  return `<section class="panel">
    <h2>${value(title)}</h2>
    ${renderFactTable([
      ["Receipt", receipt.id],
      ["Verdict", receipt.verdict],
      ["Score", receipt.score],
      ["Contract", `${receipt.environment.id} / ${receipt.contractVersion}`],
      ...policyRows,
      ["Trace refs", receipt.traceRefs.length],
      ["Evidence refs", receipt.evidenceRefs.length],
      ["Violations", receipt.violations.length]
    ])}
  </section>`;
};
