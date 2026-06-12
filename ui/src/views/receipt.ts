import type { UiArtifactBundle } from "../artifacts.js";
import type { RenderOptions } from "../render.js";
import type { ReadinessReceipt, ReadinessProfile, Violation } from "../../../src/schemas/core.js";
import {
  value,
  renderFactTable,
  renderProofArtifactWarning,
  renderProofAuditSummaryRows,
  renderLiveProofSummaryTable,
  renderReceiptPanel
} from "./helpers.js";

export const severityDeductions: Record<Violation["severity"], number> = {
  Critical: 25,
  High: 15,
  Medium: 8,
  Low: 2
};

export const activeReceiptForSimulation = (
  bundle: UiArtifactBundle
): { receipt: ReadinessReceipt | undefined; violations: Violation[] } => {
  if (bundle.beforeReceipt && bundle.beforeViolations.length > 0) {
    return { receipt: bundle.beforeReceipt, violations: bundle.beforeViolations };
  }

  if (bundle.afterReceipt && bundle.afterViolations.length > 0) {
    return { receipt: bundle.afterReceipt, violations: bundle.afterViolations };
  }

  return {
    receipt: bundle.receipt,
    violations:
      bundle.afterViolations.length > 0
        ? bundle.afterViolations
        : bundle.beforeViolations.length > 0
          ? bundle.beforeViolations
          : bundle.externalViolations
  };
};

export const ruleBindingsForSimulator = (profile: ReadinessProfile | undefined): ReadinessProfile["ruleBindings"] => {
  if (!profile) {
    return [];
  }

  return [...profile.ruleBindings].sort((left, right) => left.ruleId.localeCompare(right.ruleId));
};

export const renderPolicySimulator = (bundle: UiArtifactBundle, options: RenderOptions): string => {
  const profile = bundle.readinessProfile;
  const bindings = ruleBindingsForSimulator(profile);
  const disabledRuleIds = options.disabledRuleIds ?? new Set<string>();
  const { receipt, violations } = activeReceiptForSimulation(bundle);
  const simulatedViolations = violations.filter((violation) => !disabledRuleIds.has(violation.ruleId));
  const score = Math.max(
    0,
    100 - simulatedViolations.reduce((total, violation) => total + severityDeductions[violation.severity], 0)
  );
  const criticalOrHighRemaining = simulatedViolations.some(
    (violation) => violation.severity === "Critical" || violation.severity === "High"
  );
  const verdict = score >= 75 && !criticalOrHighRemaining ? "READY (SIMULATED)" : "NOT READY (SIMULATED)";

  if (!profile) {
    return `<aside id="policy-simulator" class="panel policy-simulator">
      <h2>Policy simulator</h2>
      <p class="empty">Readiness profile artifact not loaded.</p>
    </aside>`;
  }

  return `<aside id="policy-simulator" class="panel policy-simulator">
    <h2>Policy simulator</h2>
    ${renderFactTable([
      ["Base receipt", receipt?.id ?? "not loaded"],
      ["Authority", profile.llmUsage.passFailAuthority],
      ["Simulated verdict", verdict],
      ["Simulated score", score],
      ["Remaining violations", simulatedViolations.length],
      ["Critical or High remain", criticalOrHighRemaining ? "yes" : "no"]
    ])}
    <div class="rule-switchboard" aria-label="Readiness profile rule simulator">
      ${bindings
        .map((binding) => {
          const enabled = !disabledRuleIds.has(binding.ruleId);
          const hits = violations.filter((violation) => violation.ruleId === binding.ruleId).length;

          return `<label class="rule-switch">
            <input type="checkbox" data-policy-rule="${value(binding.ruleId)}" ${enabled ? "checked" : ""}>
            <span>
              <strong>${value(binding.ruleId)}</strong>
              <em>${value(binding.severity)} / ${value(binding.source)} / ${hits} hit(s)</em>
            </span>
          </label>`;
        })
        .join("")}
    </div>
  </aside>`;
};

export const renderReceipt = (bundle: UiArtifactBundle, options: RenderOptions): string => {
  const receipt = bundle.receipt;
  const policyRows: Array<[string, unknown]> = receipt?.policy
    ? [["Policy", `${receipt.policy.name} ${receipt.policy.version} / ${receipt.policy.id}`]]
    : [];

  return `<main class="view" data-view="receipt">
    <section class="workbench">
      <div class="section-title">
        <h1>Readiness Receipt</h1>
      </div>
      ${renderProofArtifactWarning(bundle)}
      <div class="receipt-simulator-layout">
        <section class="panel receipt-book">
          <section class="receipt-book-section">
            <h2>Current receipt</h2>
            ${receipt ? renderFactTable([
              ["Receipt", receipt.id],
              ["Verdict", receipt.verdict],
              ["Score", receipt.score],
              ["Contract", `${receipt.environment.id} / ${receipt.contractVersion}`],
              ...policyRows,
              ["Trace refs", receipt.traceRefs.length],
              ["Evidence refs", receipt.evidenceRefs.length],
              ["Violations", receipt.violations.length]
            ]) : `<p class="empty">Receipt artifact not loaded.</p>`}
        </section>
        <section class="receipt-book-section">
          <h2>Rerun comparison</h2>
          ${renderFactTable([
            ["Before verdict", bundle.beforeReceipt?.verdict ?? "n/a"],
            ["After verdict", bundle.afterReceipt?.verdict ?? "n/a"],
            ["Before score", bundle.beforeReceipt?.score ?? "n/a"],
            ["After score", bundle.afterReceipt?.score ?? "n/a"],
            ["Resolved violations", receipt?.rerunComparison["resolvedViolations"] ?? []]
          ])}
        </section>
        ${
          bundle.externalReceipt
            ? `<section class="receipt-book-section">
                <h2>External agent receipt</h2>
                ${renderFactTable([
                  ["Receipt", bundle.externalReceipt.id],
                  ["Agent", `${bundle.externalReceipt.agent.name} ${bundle.externalReceipt.agent.version}`],
                  ["Verdict", bundle.externalReceipt.verdict],
                  ["Score", bundle.externalReceipt.score],
                  ["Trace refs", bundle.externalReceipt.traceRefs.length],
                  ["Violations", bundle.externalReceipt.violations.length],
                  ["Mode", bundle.externalReceipt.mode]
                ])}
              </section>`
            : ""
        }
        ${
          bundle.mcpTranscriptImport
            ? `<section class="receipt-book-section">
                <h2>MCP transcript import</h2>
                ${renderFactTable([
                  ["Mission", bundle.mcpTranscriptImport.missionId],
                  ["Strict import", bundle.mcpTranscriptImport.strictImport ? "yes" : "no"],
                  ["Imported events", bundle.mcpTranscriptImport.importedEvents],
                  ["Tool calls", bundle.mcpTranscriptImport.toolCalls],
                  ["Tool results", bundle.mcpTranscriptImport.toolResults],
                  ["Skipped records", bundle.mcpTranscriptImport.skippedRecords],
                  ["Unmatched tool calls", bundle.mcpTranscriptImport.unmatchedToolCalls ?? "not recorded"],
                  ["Tools", bundle.mcpTranscriptImport.toolNames.join(" / ") || "none"]
                ])}
              </section>`
            : ""
        }
        <section class="receipt-book-section">
          <h2>Evidence</h2>
          ${renderFactTable([
            ["Trace refs", receipt?.traceRefs.join(" / ") ?? "n/a"],
            ["Evidence refs", receipt?.evidenceRefs.join(" / ") ?? "n/a"],
            ["Readiness profile", bundle.readinessProfile?.id ?? "not loaded"],
            ["Policy patch", bundle.policyPatch?.id ?? "not loaded"]
          ])}
        </section>
        ${
          bundle.proofAudit
            ? `<section class="receipt-book-section">
                <h2>Proof audit</h2>
                ${renderFactTable(renderProofAuditSummaryRows(bundle.proofAudit))}
              </section>`
            : ""
        }
        ${
          bundle.firewallBlock
            ? `<section class="receipt-book-section">
                <h2>Firewall block</h2>
                ${renderFactTable([
                  ["Status", bundle.firewallBlock.status],
                  ["Phase", bundle.firewallBlock.phase],
                  ["Tool", bundle.firewallBlock.toolName],
                  ["Blocked before Splunk", bundle.firewallBlock.blockedBeforeSplunk ? "yes" : "no"],
                  ["Mutation", bundle.firewallBlock.mutation ? "yes" : "no"],
                  ["Rules", (bundle.firewallBlock.violations ?? []).map((item) => item.ruleId).join(" / ")],
                  ["Query", bundle.firewallBlock.query ?? "n/a"]
                ])}
              </section>`
            : ""
        }
        ${
          bundle.liveSecurityProofSummary
            ? `<section class="receipt-book-section">
                <h2>Flagship security proof</h2>
                ${renderFactTable([
                  ["Readiness", bundle.liveSecurityProofSummary.readinessStatus],
                  [
                    "Before",
                    `${bundle.liveSecurityProofSummary.before.verdict} / ${bundle.liveSecurityProofSummary.before.score}`
                  ],
                  [
                    "After",
                    `${bundle.liveSecurityProofSummary.after.verdict} / ${bundle.liveSecurityProofSummary.after.score}`
                  ],
                  ["Fail to pass", bundle.liveSecurityProofSummary.failToPass ? "yes" : "no"],
                  ["Ready after patch", bundle.liveSecurityProofSummary.readyAfterPatch ? "yes" : "no"]
                ])}
              </section>`
            : bundle.liveProofSummary
              ? `<section class="receipt-book-section">
                  <h2>Live proof summary</h2>
                  ${renderLiveProofSummaryTable(bundle)}
                </section>`
              : bundle.liveSecurityReadiness
                ? `<section class="receipt-book-section">
                    <h2>Flagship security readiness</h2>
                    ${renderFactTable([
                      ["Status", bundle.liveSecurityReadiness.status],
                      [
                        "Proof mode",
                        `${bundle.liveSecurityReadiness.proofMode.type} / fallback ${
                          bundle.liveSecurityReadiness.proofMode.fallbackAllowed ? "allowed" : "blocked"
                        }`
                      ],
                      ["Saved search", bundle.liveSecurityReadiness.requiredSavedSearch.ref],
                      [
                        "Saved-search run",
                        bundle.liveSecurityReadiness.requiredSavedSearch.run.attempted
                          ? `${bundle.liveSecurityReadiness.requiredSavedSearch.run.resultCount ?? "n/a"} row(s)`
                          : bundle.liveSecurityReadiness.requiredSavedSearch.run.reason
                      ],
                      [
                        "Blockers",
                        bundle.liveSecurityReadiness.blockers.length > 0
                          ? bundle.liveSecurityReadiness.blockers.join(" / ")
                          : "none"
                      ]
                    ])}
                  </section>`
                : ""
        }
        </section>
        ${renderPolicySimulator(bundle, options)}
      </div>
    </section>
  </main>`;
};
