import { summarizeBundle, type UiArtifactBundle } from "./artifacts.js";
import type { PolicyPatch, ReadinessReceipt, TraceEvent, Violation } from "../../src/schemas/core.js";

export type ViewId = "certification-replay" | "receipt" | "trace-timeline" | "live-connect";

export const views: Array<{ id: ViewId; label: string }> = [
  { id: "certification-replay", label: "Replay" },
  { id: "receipt", label: "Receipt" },
  { id: "trace-timeline", label: "Trace" },
  { id: "live-connect", label: "Live connect" }
];

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
  const hasTrace = bundle.beforeTrace.length > 0 || bundle.afterTrace.length > 0;

  if (hasReceipt && hasTrace) {
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
    ["Fail to pass", summary.failToPass ? "yes" : "no"],
    ["Ready without patch", summary.readyWithoutPatch ? "yes" : "no"],
    ["Mutation", summary.mutation ? "yes" : "no"],
    ["Notes", summary.notes]
  ]);
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

const renderReceipt = (bundle: UiArtifactBundle): string => {
  const receipt = bundle.receipt;

  return `<main class="view" data-view="receipt">
    <section class="workbench">
      <div class="section-title">
        <h1>Readiness Receipt</h1>
      </div>
      ${renderProofArtifactWarning(bundle)}
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
        <section class="receipt-book-section">
          <h2>Evidence</h2>
          ${renderFactTable([
            ["Trace refs", receipt?.traceRefs.join(" / ") ?? "n/a"],
            ["Evidence refs", receipt?.evidenceRefs.join(" / ") ?? "n/a"],
            ["Readiness profile", bundle.readinessProfile?.id ?? "not loaded"],
            ["Policy patch", bundle.policyPatch?.id ?? "not loaded"]
          ])}
        </section>
        <section class="receipt-book-section">
          <h2>Live proof summary</h2>
          ${renderLiveProofSummaryTable(bundle)}
        </section>
      </section>
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

const renderTraceTimeline = (bundle: UiArtifactBundle): string =>
  `<main class="view" data-view="trace-timeline">
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
      </div>
    </section>
  </main>`;

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
        ${renderLiveProofSummary(bundle)}
        ${renderLiveSecurityReadiness(bundle)}
        ${renderLiveSecurityKit(bundle)}
      </div>
    </section>
  </main>`;
};

const renderSidebar = (bundle: UiArtifactBundle, activeView: ViewId): string => {
  const summary = summarizeBundle(bundle);

  return `<aside class="side-rail">
    <div class="brand">
      <h1>SplunkReady</h1>
      <p>Certify AI agents before they touch production Splunk.</p>
    </div>
    <nav aria-label="Views">
      ${views
        .map(
          (view) =>
            `<a href="#${view.id}" data-view-link="${view.id}" class="${view.id === activeView ? "active" : ""}">${view.label}</a>`
        )
        .join("")}
    </nav>
    <div class="rail-receipt">
      <strong>${value(summary.verdict)} / ${value(summary.score)}</strong>
      <span>${value(summary.mode)} / ${value(summary.contract)}</span>
      <span>${summary.beforeViolations} before / ${summary.afterViolations} after</span>
      <span>${value(summary.proofStory)}</span>
      <span>${value(summary.securityStory)}</span>
      <span>${value(summary.kitStory)}</span>
    </div>
  </aside>`;
};

const renderActiveView = (bundle: UiArtifactBundle, activeView: ViewId): string => {
  if (activeView === "receipt") {
    return renderReceipt(bundle);
  }

  if (activeView === "trace-timeline") {
    return renderTraceTimeline(bundle);
  }

  if (activeView === "live-connect") {
    return renderLiveConnect(bundle);
  }

  return renderReplay(bundle);
};

export const renderApp = (bundle: UiArtifactBundle, activeView: ViewId): string =>
  `<div class="app-frame">
    ${renderSidebar(bundle, activeView)}
    ${renderActiveView(bundle, activeView)}
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
