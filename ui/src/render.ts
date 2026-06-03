import {
  normalizeArtifactBase,
  summarizeBundle,
  type ArtifactOption,
  type CertificationIndex,
  type FirewallBlock,
  type HostedModelDiagnostic,
  type HostedModelProof,
  type HostedModelSummary,
  type McpTranscriptImport,
  type ProofAudit,
  type SuiteProofSummary,
  type UiArtifactBundle
} from "./artifacts.js";
import type { PolicyPatch, ReadinessReceipt, ReadinessProfile, TraceEvent, Violation } from "../../src/schemas/core.js";

export type ViewId = "certification-replay" | "receipt" | "trace-timeline" | "suite-proof" | "agent-index" | "live-connect";

export const views: Array<{ id: ViewId; label: string }> = [
  { id: "certification-replay", label: "Replay" },
  { id: "receipt", label: "Receipt" },
  { id: "trace-timeline", label: "Trace" },
  { id: "suite-proof", label: "Suite" },
  { id: "agent-index", label: "Agents" },
  { id: "live-connect", label: "Live connect" }
];

export interface RenderOptions {
  disabledRuleIds?: ReadonlySet<string>;
  artifactOptions?: ArtifactOption[];
}

export const normalizeView = (value: string | undefined): ViewId =>
  views.some((view) => view.id === value) ? (value as ViewId) : "certification-replay";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const value = (input: unknown): string => escapeHtml(String(input ?? "n/a"));

const code = (input: unknown): string => `<code>${value(input)}</code>`;

const violationByEvent = (violations: Violation[]): Map<string, Violation[]> => {
  const grouped = new Map<string, Violation[]>();

  for (const violation of violations) {
    grouped.set(violation.traceEventId, [...(grouped.get(violation.traceEventId) ?? []), violation]);
  }

  return grouped;
};

const splAssistanceByViolation = (
  policyPatch: PolicyPatch | undefined
): Map<string, NonNullable<PolicyPatch["splAssistance"]>[number]> => {
  const grouped = new Map<string, NonNullable<PolicyPatch["splAssistance"]>[number]>();

  for (const assistance of policyPatch?.splAssistance ?? []) {
    grouped.set(assistance.violationRef, assistance);
  }

  return grouped;
};

const renderFactTable = (rows: Array<[string, unknown]>): string =>
  `<table class="fact-table"><tbody>${rows
    .map(([label, rowValue]) => `<tr><th>${value(label)}</th><td>${value(rowValue)}</td></tr>`)
    .join("")}</tbody></table>`;

const renderProofArtifactWarning = (bundle: UiArtifactBundle): string => {
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

const renderMcpTranscriptImport = (summary: McpTranscriptImport | undefined): string => {
  if (!summary) {
    return "";
  }

  return `<section class="panel mcp-transcript-panel">
    <h2>MCP transcript import</h2>
    ${renderFactTable([
      ["Status", summary.status],
      ["Source", summary.source],
      ["Mission", summary.missionId],
      ["Strict import", summary.strictImport ? "yes" : "no"],
      ["Imported events", summary.importedEvents],
      ["Tool calls", summary.toolCalls],
      ["Tool results", summary.toolResults],
      ["Final answers", summary.finalAnswers],
      ["Errors", summary.errors],
      ["Skipped records", summary.skippedRecords],
      ["Unmatched tool calls", summary.unmatchedToolCalls ?? "not recorded"],
      ["Tools", summary.toolNames.length > 0 ? summary.toolNames.join(" / ") : "none"],
      ["Transcript", summary.transcriptPath ?? "not recorded"],
      ["Trace", summary.outputTracePath ?? "not recorded"],
      ["Mutation", summary.mutation ? "yes" : "no"],
      ["Next command", summary.nextCommand ?? "grade-trace"]
    ])}
  </section>`;
};

const renderReceiptPanel = (receipt: ReadinessReceipt | undefined, title: string): string => {
  if (!receipt) {
    return `<section class="panel"><h2>${value(title)}</h2><p class="empty">Receipt artifact not loaded.</p></section>`;
  }

  return `<section class="panel">
    <h2>${value(title)}</h2>
    ${renderFactTable([
      ["Receipt", receipt.id],
      ["Verdict", receipt.verdict],
      ["Score", receipt.score],
      ["Contract", `${receipt.environment.id} / ${receipt.contractVersion}`],
      ["Trace refs", receipt.traceRefs.length],
      ["Evidence refs", receipt.evidenceRefs.length],
      ["Violations", receipt.violations.length]
    ])}
  </section>`;
};

const severityDeductions: Record<Violation["severity"], number> = {
  Critical: 25,
  High: 15,
  Medium: 8,
  Low: 2
};

const activeReceiptForSimulation = (
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

const ruleBindingsForSimulator = (profile: ReadinessProfile | undefined): ReadinessProfile["ruleBindings"] => {
  if (!profile) {
    return [];
  }

  return [...profile.ruleBindings].sort((left, right) => left.ruleId.localeCompare(right.ruleId));
};

const renderPolicySimulator = (bundle: UiArtifactBundle, options: RenderOptions): string => {
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

const renderStage = (index: number, title: string, status: string, detail: string): string =>
  `<li class="stage" style="--stage-index: ${index}">
    <span>${index}</span>
    <strong>${value(title)}</strong>
    <em>${value(status)}</em>
    <p>${value(detail)}</p>
  </li>`;

const renderPolicyPatchSummary = (policyPatch: PolicyPatch | undefined, emptyMessage = "Policy patch artifact not loaded."): string => {
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

const renderLiveProofSummary = (bundle: UiArtifactBundle): string => {
  const summary = bundle.liveProofSummary;

  if (!summary) {
    return "";
  }

  return `<section class="panel live-proof-panel">
    <h2>Live proof summary</h2>
    ${renderLiveProofSummaryTable(bundle)}
  </section>`;
};

const renderLiveProofSummaryTable = (bundle: UiArtifactBundle): string => {
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

const renderLiveSecurityProofSummary = (bundle: UiArtifactBundle): string => {
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

const renderHostedModelSummary = (summary: HostedModelSummary | undefined): string => {
  if (!summary) {
    return "";
  }

  return `<section class="panel hosted-model-panel">
    <h2>Hosted model assistance</h2>
    ${renderFactTable([
      ["Status", summary.status],
      ["Available tools", summary.availableTools.length > 0 ? summary.availableTools.join(" / ") : "none"],
      ["Missing tools", summary.missingTools.length > 0 ? summary.missingTools.join(" / ") : "none"],
      ["SAIA items", summary.assistanceItems],
      ["Role", "advisory only; deterministic grader decides pass/fail"],
      ["Notes", summary.notes]
    ])}
  </section>`;
};

const renderHostedModelProof = (proof: HostedModelProof | undefined): string => {
  if (!proof) {
    return "";
  }

  return `<section class="panel hosted-model-proof-panel">
    <h2>Hosted model proof</h2>
    ${renderFactTable([
      ["Status", proof.status],
      ["Mode", proof.mode],
      ["Contract", proof.contract.id],
      ["Tool calls", proof.toolCalls.join(" / ")],
      ["Rule context", proof.deterministicContext.ruleIds.join(" / ")],
      ["Pass/fail authority", proof.deterministicContext.passFailAuthority],
      ["Mutation", proof.mutation ? "yes" : "no"],
      ["Error", proof.error ?? "none"],
      ["Notes", proof.notes]
    ])}
    ${
      proof.assistance
        ? `<div class="saia-compare hosted-model-proof-compare">
            <div>
              <b>Before SPL</b>
              ${code(proof.query)}
            </div>
            <div>
              <b>SAIA recommended SPL</b>
              ${code(proof.assistance.optimizedQuery || "n/a")}
            </div>
          </div>
          <p>${value(proof.assistance.explanation)}</p>
          <p>${value(proof.assistance.rationale)}</p>`
        : `<p class="empty">${value(proof.error ?? "Hosted-model assistance was not returned.")}</p>`
    }
  </section>`;
};

const renderHostedModelDiagnostic = (diagnostic: HostedModelDiagnostic | undefined): string => {
  if (!diagnostic) {
    return "";
  }

  return `<section class="panel hosted-model-diagnostic-panel">
    <h2>Hosted model diagnostic</h2>
    ${renderFactTable([
      ["Status", diagnostic.status],
      ["Mode", diagnostic.mode],
      ["Contract", diagnostic.contract.id],
      ["Required tools", diagnostic.requiredTools.join(" / ")],
      ["Available tools", diagnostic.availableTools.length > 0 ? diagnostic.availableTools.join(" / ") : "none"],
      ["Missing tools", diagnostic.missingTools.length > 0 ? diagnostic.missingTools.join(" / ") : "none"],
      ["Permission", diagnostic.permission.status],
      ["Error", diagnostic.permission.error ?? "none"],
      ["Required actions", diagnostic.permission.requiredActions?.join(" / ") ?? "none"],
      ["Mutation", diagnostic.mutation ? "yes" : "no"],
      ["Authority", diagnostic.deterministicAuthority],
      ["Notes", diagnostic.notes]
    ])}
  </section>`;
};

const renderProofAuditSummaryRows = (audit: ProofAudit): Array<[string, unknown]> => [
  ["Status", audit.status],
  ["Proof type", audit.proofType],
  ["Mode", audit.mode ?? "n/a"],
  ["Fail to pass", audit.failToPass === undefined ? "n/a" : audit.failToPass ? "yes" : "no"],
  ["Ready after patch", audit.readyAfterPatch === undefined ? "n/a" : audit.readyAfterPatch ? "yes" : "no"],
  ["Proof loop", audit.proofLoop ?? "n/a"],
  ["Mutation", audit.mutation === undefined ? "n/a" : audit.mutation ? "yes" : "no"],
  ["Hosted models", audit.hostedModelStatus ?? "not loaded"]
];

const renderProofAuditPanel = (audit: ProofAudit | undefined): string => {
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

const renderSuiteMissionRows = (summary: SuiteProofSummary): string =>
  summary.missions
    .map(
      (mission) => `<tr>
        <td>${code(mission.missionId)}<span>${value(mission.title)}</span></td>
        <td>${value(mission.domain)}</td>
        <td>${value(mission.proofLoop)}</td>
        <td>${value(`${mission.before.verdict} / ${mission.before.score} / ${mission.before.violations} violation(s)`)}</td>
        <td>${value(`${mission.after.verdict} / ${mission.after.score} / ${mission.after.violations} violation(s)`)}</td>
        <td>${value(mission.after.evidenceRefs.length)}</td>
        <td>${code(mission.artifactDir)}</td>
      </tr>`
    )
    .join("");

const renderSuiteProof = (bundle: UiArtifactBundle): string => {
  const summary = bundle.suiteProofSummary;

  return `<main class="view" data-view="suite-proof">
    <section class="workbench">
      <div class="section-title">
        <h1>Suite proof</h1>
      </div>
      ${
        summary
          ? `<section class="panel">
              <h2>Suite summary</h2>
              ${renderFactTable([
                ["Status", summary.status],
                ["Mode", summary.mode],
                ["Suite", summary.suiteId],
                ["Title", summary.suiteTitle ?? "not recorded"],
                ["Manifest", summary.suitePath ?? "not recorded"],
                ["Missions", summary.missionCount],
                ["Domains", summary.domains.join(" / ")],
                ["Fail-to-pass missions", summary.totals.failToPass],
                ["READY after patch", summary.totals.readyAfterPatch],
                ["Evidence refs", summary.totals.evidenceRefs],
                ["Mutation", summary.mutation ? "yes" : "no"]
              ])}
            </section>
            ${renderProofAuditPanel(bundle.proofAudit)}
            <section class="panel suite-proof-panel">
              <h2>Mission ledger</h2>
              <table class="suite-table">
                <thead>
                  <tr>
                    <th>Mission</th>
                    <th>Domain</th>
                    <th>Proof loop</th>
                    <th>Before</th>
                    <th>After</th>
                    <th>Evidence</th>
                    <th>Artifacts</th>
                  </tr>
                </thead>
                <tbody>${renderSuiteMissionRows(summary)}</tbody>
              </table>
            </section>`
          : `<section class="panel">
              <h2>Suite summary</h2>
              <p class="empty">Suite proof artifact not loaded.</p>
            </section>`
      }
    </section>
  </main>`;
};

const renderCertificationIndexRows = (index: CertificationIndex): string =>
  index.entries
    .map((entry) => {
      const receipt = entry.receipt;

      return `<tr>
        <td><a href="${value(entry.href)}" data-proof-artifact="${value(entry.proofDir)}" data-proof-view="receipt">${value(entry.label)}</a><span>${value(entry.agent.version)}</span></td>
        <td>${value(entry.status)}<span>${value(entry.proofType)}</span></td>
        <td>${value(receipt?.verdict ?? "NO RECEIPT")}<span>${value(receipt ? `${receipt.score}/100` : "--")}</span></td>
        <td>${value(receipt?.violations ?? "n/a")}<span>${value(receipt ? `${receipt.evidenceRefs} evidence refs` : "no receipt")}</span></td>
        <td>${value(entry.proofLoop ?? "n/a")}<span>${value(entry.mode ?? "unknown")}</span></td>
        <td>${value(entry.manifest ? `${entry.manifest.files} files` : "n/a")}<span>${value(entry.manifest?.aggregateSha256.slice(0, 12) ?? "no manifest")}</span></td>
        <td>${code(entry.proofDir)}</td>
      </tr>`;
    })
    .join("");

const renderCertificationIndex = (bundle: UiArtifactBundle): string => {
  const index = bundle.certificationIndex;

  if (!index) {
    return `<main class="view" data-view="agent-index">
      <section class="workbench">
        <div class="section-title"><h1>Agent certification index</h1></div>
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
      </section>
    </main>`;
  }

  return `<main class="view" data-view="agent-index">
    <section class="workbench">
      <div class="section-title"><h1>Agent certification index</h1></div>
      <div class="receipt-ledger">
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
                <th>Audit</th>
                <th>Receipt</th>
                <th>Evidence</th>
                <th>Loop</th>
                <th>Manifest</th>
                <th>Proof dir</th>
              </tr>
            </thead>
            <tbody>${renderCertificationIndexRows(index)}</tbody>
          </table>
        </section>
      </div>
    </section>
  </main>`;
};

const renderFirewallBlock = (block: FirewallBlock | undefined): string => {
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

const renderLiveSecurityReadiness = (bundle: UiArtifactBundle): string => {
  const readiness = bundle.liveSecurityReadiness;

  if (!readiness) {
    return "";
  }

  const run = readiness.requiredSavedSearch.run;
  const runSummary = run.attempted
    ? `${run.resultCount ?? "n/a"} row(s), ${run.evidenceRefs.length} evidence ref(s)${
        run.error ? `, ${run.error}` : ""
      }`
    : run.reason;

  return `<section class="panel live-security-panel">
    <h2>Flagship security readiness</h2>
    ${renderFactTable([
      ["Status", readiness.status],
      ["Mission", `${readiness.mission.id} / ${readiness.mission.story}`],
      ["Contract", `${readiness.contract.id} / ${readiness.contract.name}`],
      ["Saved search", `${readiness.requiredSavedSearch.ref} / ${readiness.requiredSavedSearch.present ? "present" : "missing"}`],
      ["Saved-search run", runSummary],
      ["Preferred index", `${readiness.preferredIndex.name} / ${readiness.preferredIndex.present ? "present" : "missing"}`],
      ["Missing tools", readiness.requiredTools.missing.length > 0 ? readiness.requiredTools.missing.join(" / ") : "none"],
      ["Blockers", readiness.blockers.length > 0 ? readiness.blockers.join(" / ") : "none"],
      ["Next actions", readiness.nextActions.join(" / ")]
    ])}
  </section>`;
};

const renderLiveSecurityKit = (bundle: UiArtifactBundle): string => {
  const kit = bundle.liveSecurityKit;

  if (!kit) {
    return "";
  }

  return `<section class="panel live-security-kit-panel">
    <h2>Operator security kit</h2>
    ${renderFactTable([
      ["Status", kit.status],
      ["Mission", kit.mission],
      ["Saved search", kit.savedSearch.ref],
      ["Preferred index", kit.preferredIndex],
      ["Sourcetype", kit.sourcetype],
      ["Sample events", kit.sampleEvents],
      ["Operator action", kit.operatorActionRequired ? "required" : "not required"],
      ["Mutation", kit.mutation ? "yes" : "no"],
      ["Generated", kit.generatedAt],
      ["Artifacts", kit.artifacts.join(" / ")]
    ])}
  </section>`;
};

const renderReplay = (bundle: UiArtifactBundle): string => {
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
        <button class="replay-button" type="button" data-run-replay>Run replay</button>
      </div>
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
    </section>
  </main>`;
};

const renderReceipt = (bundle: UiArtifactBundle, options: RenderOptions): string => {
  const receipt = bundle.receipt;

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

const eventSummary = (event: TraceEvent): string => {
  if (event.toolInput && typeof event.toolInput["query"] === "string") {
    return event.toolInput["query"];
  }

  if (event.toolInput && typeof event.toolInput["name"] === "string") {
    return `${event.toolInput["app"] ?? "search"}::${event.toolInput["name"]}`;
  }

  return event.toolOutputSummary ?? event.type;
};

const renderFindings = (
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

const renderTraceRows = (events: TraceEvent[], violations: Violation[], policyPatch: PolicyPatch | undefined): string => {
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

const externalTraceForDisplay = (bundle: UiArtifactBundle): TraceEvent[] =>
  bundle.externalTrace.length > 0 ? bundle.externalTrace : bundle.importedTrace;

const renderTraceTimeline = (bundle: UiArtifactBundle): string => {
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

const renderLiveConnect = (bundle: UiArtifactBundle): string => {
  const contract = bundle.liveSmokeContract ?? bundle.contract;
  const liveLoaded = Boolean(bundle.liveSmokeContract || contract?.mode === "live");

  return `<main class="view" data-view="live-connect">
    <section class="workbench">
      <div class="section-title">
        <h1>Live connect</h1>
      </div>
      <div class="receipt-ledger">
        <section class="panel">
          <h2>MCP status</h2>
          ${renderFactTable([
            ["Status", liveLoaded ? "live artifact loaded" : "no live-smoke artifact loaded"],
            ["Mode", contract?.mode ?? "unknown"],
            ["Contract", contract?.id ?? "not loaded"],
            ["Deployment", contract?.name ?? "not loaded"],
            ["Indexes", contract?.indexes.map((index) => index.name).join(" / ") ?? "n/a"],
            ["Read-only tools", contract?.mcpTools.join(" / ") ?? "n/a"]
          ])}
        </section>
        <section class="panel">
          <h2>Artifact source</h2>
          ${renderFactTable([
            ["Base URL", bundle.artifactBase],
            ["Missing optional files", bundle.missing.length > 0 ? bundle.missing.join(" / ") : "none"],
            ["Mutation posture", "read-only adapter calls only"]
          ])}
        </section>
        ${renderProofAuditPanel(bundle.proofAudit)}
        ${renderFirewallBlock(bundle.firewallBlock)}
        ${renderMcpTranscriptImport(bundle.mcpTranscriptImport)}
        ${renderLiveProofSummary(bundle)}
        ${renderLiveSecurityProofSummary(bundle)}
        ${renderHostedModelSummary(bundle.liveSecurityProofSummary?.hostedModels ?? bundle.liveProofSummary?.hostedModels)}
        ${renderHostedModelDiagnostic(bundle.hostedModelDiagnostic)}
        ${renderHostedModelProof(bundle.hostedModelProof)}
        ${renderLiveSecurityReadiness(bundle)}
        ${renderLiveSecurityKit(bundle)}
      </div>
    </section>
  </main>`;
};

const renderArtifactSelector = (bundle: UiArtifactBundle, artifactOptions: ArtifactOption[] | undefined): string => {
  if (!artifactOptions || artifactOptions.length === 0) {
    return "";
  }

  const currentBase = normalizeArtifactBase(bundle.artifactBase);
  const options = artifactOptions
    .map((option) => {
      const optionBase = normalizeArtifactBase(option.path);
      const selected = optionBase === currentBase ? " selected" : "";

      return `<option value="${value(option.path)}"${selected}>${value(option.label)}</option>`;
    })
    .join("");

  return `<label class="artifact-picker">
    <span>Artifact source</span>
    <select data-artifact-selector>
      ${options}
    </select>
  </label>`;
};

const optionalRailStories = (summary: ReturnType<typeof summarizeBundle>): string[] =>
  [
    summary.proofStory,
    summary.securityStory,
    summary.kitStory,
    summary.hostedModelStory,
    summary.auditStory,
    summary.firewallStory,
    summary.suiteStory,
    summary.indexStory,
    summary.transcriptStory
  ].filter((story) => !story.includes("not loaded"));

const renderSidebar = (bundle: UiArtifactBundle, activeView: ViewId, options: RenderOptions): string => {
  const summary = summarizeBundle(bundle);
  const railStory = optionalRailStories(summary)[0];

  return `<aside class="side-rail">
    <div class="brand">
      <h1>SplunkReady</h1>
      <p>Certify AI agents before they touch production Splunk.</p>
    </div>
    <div class="rail-body">
      <nav aria-label="Views">
        ${views
          .map(
            (view) =>
              `<a href="#${view.id}" data-view-link="${view.id}" class="${view.id === activeView ? "active" : ""}">${view.label}</a>`
          )
          .join("")}
      </nav>
      ${renderArtifactSelector(bundle, options.artifactOptions)}
    </div>
    <div class="rail-footer">
      <div class="rail-receipt">
        <strong>${value(summary.verdict)} / ${value(summary.score)}</strong>
        <span>${value(summary.mode)} / ${value(summary.contract)}</span>
        <span>${summary.beforeViolations} before / ${summary.afterViolations} after</span>
        ${railStory ? `<span>${value(railStory)}</span>` : ""}
      </div>
    </div>
  </aside>`;
};

const renderActiveView = (bundle: UiArtifactBundle, activeView: ViewId, options: RenderOptions): string => {
  if (activeView === "receipt") {
    return renderReceipt(bundle, options);
  }

  if (activeView === "trace-timeline") {
    return renderTraceTimeline(bundle);
  }

  if (activeView === "suite-proof") {
    return renderSuiteProof(bundle);
  }

  if (activeView === "agent-index") {
    return renderCertificationIndex(bundle);
  }

  if (activeView === "live-connect") {
    return renderLiveConnect(bundle);
  }

  return renderReplay(bundle);
};

export const renderApp = (bundle: UiArtifactBundle, activeView: ViewId, options: RenderOptions = {}): string =>
  `<div class="app-frame">
    ${renderSidebar(bundle, activeView, options)}
    ${renderActiveView(bundle, activeView, options)}
  </div>`;

export const renderError = (message: string): string =>
  `<div class="app-frame">
    <aside class="side-rail">
      <div class="brand">
        <h1>SplunkReady</h1>
        <p>Certify AI agents before they touch production Splunk.</p>
      </div>
    </aside>
    <main class="view">
      <section class="workbench">
        <div class="section-title"><h1>Artifact load failed</h1></div>
        <section class="panel"><p class="empty">${value(message)}</p></section>
      </section>
    </main>
  </div>`;
