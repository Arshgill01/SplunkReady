import {
  type EnvironmentContract,
  type PolicyPatch,
  type ReadinessProfile,
  type ReadinessReceipt,
  type TraceEvent,
  type Violation
} from "../../schemas/core.js";
import { type MissionDefinition } from "../../missions/dsl.js";
import { type UiArtifacts, type UiArtifactPaths } from "../shell.js";
import { escapeHtml, truncate } from "./helpers.js";
import { preferredSavedSearchRefs } from "./contractView.js";
import { toolInputSummary } from "./traceView.js";

export const uniqueStrings = (values: string[]): string[] => [...new Set(values.filter((value) => value.length > 0))];

export const renderReplayCell = (label: string, value: string, options: { code?: boolean; className?: string } = {}): string =>
  `<div class="${options.className ? `cell ${escapeHtml(options.className)}` : "cell"}">
    <b>${escapeHtml(label)}</b>
    ${options.code ? `<code>${escapeHtml(value)}</code>` : `<span>${escapeHtml(value)}</span>`}
  </div>`;

export const renderReplayTable = (rows: string, className = ""): string =>
  `<div class="tbl${className ? ` ${escapeHtml(className)}` : ""}">${rows}</div>`;

export const contractBudgetSummary = (contract: EnvironmentContract | undefined): string => {
  if (!contract) {
    return "contract not loaded";
  }

  return `${contract.queryBudgets.maxToolCalls} calls / ${contract.queryBudgets.maxResultRows} rows / ${contract.queryBudgets.timeoutSeconds}s`;
};

export const contractSavedSearchSummary = (contract: EnvironmentContract | undefined, missions: MissionDefinition[]): string => {
  if (!contract) {
    return "contract not loaded";
  }

  const preferredRefs = preferredSavedSearchRefs(missions);
  const preferred = contract.savedSearches
    .map((savedSearch) => `${savedSearch.app}::${savedSearch.name}`)
    .find((ref) => preferredRefs.has(ref));

  return preferred ?? `${contract.savedSearches.length} saved search(es) compiled`;
};

export const contractIndexSummary = (contract: EnvironmentContract | undefined, mission: MissionDefinition | undefined): string => {
  if (!contract) {
    return "contract not loaded";
  }

  const authorized = mission?.authorizedIndexes ?? contract.indexes.filter((index) => !index.sensitive).map((index) => index.name);
  const restricted = contract.restrictedIndexes;

  return `allow ${authorized.join(", ") || "none"} / restrict ${restricted.join(", ") || "none"}`;
};

export const renderContractReplayTable = (
  contract: EnvironmentContract | undefined,
  missions: MissionDefinition[],
  mission: MissionDefinition | undefined
): string =>
  renderReplayTable(
    [
      renderReplayCell("contract", contract ? `${contract.name} / ${contract.version}` : "environment-contract.json missing", {
        code: Boolean(contract)
      }),
      renderReplayCell("mission", mission?.title ?? "missions.json missing"),
      renderReplayCell("adapter mode", contract?.mode ?? "unknown"),
      renderReplayCell("budget", contractBudgetSummary(contract)),
      renderReplayCell("indexes", contractIndexSummary(contract, mission)),
      renderReplayCell("saved search", contractSavedSearchSummary(contract, missions), { code: Boolean(contract) })
    ].join(""),
    "col-3"
  );

export const traceEvidenceSummary = (event: TraceEvent): string =>
  event.evidenceRefs.length > 0 ? event.evidenceRefs.join(", ") : "refs (none)";

export const renderTraceReplayTable = (events: TraceEvent[], emptyMessage: string): string => {
  if (events.length === 0) {
    return `<p class="empty">${escapeHtml(emptyMessage)}</p>`;
  }

  return renderReplayTable(
    events
      .map((event, index) => {
        const step = event.step ?? index + 1;
        const tool = event.toolName ?? event.type;
        const summary = toolInputSummary(event) || event.toolOutputSummary || event.id;
        const results = event.resultCount === null ? "results n/a" : `results ${event.resultCount}`;

        return [
          renderReplayCell(String(step).padStart(2, "0"), event.type, { className: "step" }),
          renderReplayCell(tool, `${event.id} / ${summary}`, { code: Boolean(event.toolName) }),
          renderReplayCell(results, traceEvidenceSummary(event))
        ].join("");
      })
      .join(""),
    "col-3"
  );
};

export const renderRuleReplayTable = (
  violations: Violation[],
  mission: MissionDefinition | undefined,
  readinessProfile: ReadinessProfile | undefined
): string => {
  const profileSummary = readinessProfile
    ? `${readinessProfile.ruleBindings.length} deployment-bound rules`
    : mission
      ? `${mission.checks.length} deterministic checks loaded`
      : "deterministic checks loaded";
  const sourceSummary = readinessProfile
    ? `${readinessProfile.deploymentSignals.savedSearchCount} saved searches / ${readinessProfile.deploymentSignals.restrictedIndexCount} restricted indexes`
    : "contract profile missing";

  if (violations.length === 0) {
    return renderReplayTable(
      [
        renderReplayCell("rules", profileSummary),
        renderReplayCell("profile source", sourceSummary),
        renderReplayCell("violations", "0 active violations in this trace"),
        renderReplayCell("judge", "deterministic rule engine")
      ].join(""),
      "col-3"
    );
  }

  return renderReplayTable(
    [
      renderReplayCell("profile", profileSummary),
      renderReplayCell("source", sourceSummary),
      renderReplayCell("judge", "deterministic rule engine"),
      ...violations.map((violation) =>
        [
          renderReplayCell(violation.ruleId, violation.severity),
          renderReplayCell(violation.traceEventId, violation.reason),
          renderReplayCell("patch hint", violation.suggestedPolicyPatch)
        ].join("")
      )
    ].join(""),
    "col-3"
  );
};

export const renderPatchReplayTable = (policyPatch: PolicyPatch | undefined): string => {
  if (!policyPatch) {
    return `<p class="empty">No policy-patch.json artifact loaded.</p>`;
  }

  const rows = [
    renderReplayCell("patch", `${policyPatch.id} / ${policyPatch.status}`, { code: true }),
    renderReplayCell("source receipt", policyPatch.sourceReceiptId, { code: true }),
    ...policyPatch.rules.map((rule, index) =>
      [
        renderReplayCell(`+${index + 1}`, rule.id, { code: true }),
        renderReplayCell("rule text", rule.text),
        renderReplayCell("handling", "exported for review / no auto-apply")
      ].join("")
    )
  ];

  return renderReplayTable(rows.join(""), "col-patch");
};

export const renderReceiptReplayTable = (
  beforeReceipt: ReadinessReceipt | undefined,
  afterReceipt: ReadinessReceipt | undefined,
  afterViolations: Violation[],
  afterTraceEvents: TraceEvent[]
): string => {
  const afterEvidenceRefs = uniqueStrings(afterTraceEvents.flatMap((event) => event.evidenceRefs));
  const resolvedViolations = uniqueStrings(
    afterReceipt && Array.isArray(afterReceipt.rerunComparison.resolvedViolations)
      ? afterReceipt.rerunComparison.resolvedViolations.map((value) => String(value))
      : []
  );

  return renderReplayTable(
    [
      renderReplayCell("readiness", afterReceipt ? `${afterReceipt.verdict} / ${afterReceipt.score}/100` : "rerun receipt missing"),
      renderReplayCell(
        "before",
        beforeReceipt ? `${beforeReceipt.verdict} / ${beforeReceipt.score}/100 / ${beforeReceipt.criticalViolations.length} critical` : "failed receipt missing"
      ),
      renderReplayCell(
        "after",
        afterReceipt ? `${afterViolations.length} violation(s) / ${afterReceipt.criticalViolations.length} critical` : "rerun receipt missing"
      ),
      renderReplayCell("resolved", resolvedViolations.length > 0 ? resolvedViolations.join(", ") : "none recorded"),
      renderReplayCell("evidence", afterEvidenceRefs.length > 0 ? afterEvidenceRefs.join(", ") : "refs (none)"),
      renderReplayCell("receipt", afterReceipt?.id ?? "missing", { code: Boolean(afterReceipt) })
    ].join(""),
    "col-3"
  );
};

export const artifactFileList = (paths: UiArtifactPaths): string[] =>
  [
    paths.contract,
    paths.missions,
    paths.beforeTrace,
    paths.beforeViolations,
    paths.policyPatchJson,
    paths.readinessProfile,
    paths.afterTrace,
    paths.afterViolations,
    paths.afterReceipt
  ].filter((path): path is string => Boolean(path));

export const renderReplaySection = (id: string, mark: string, title: string, body: string, active = false): string => `<section
  id="${escapeHtml(id)}"
  class="replay-card-section"
  data-replay-section
  aria-labelledby="${escapeHtml(id)}-title"
  ${active ? "" : "hidden"}
>
  <div class="replay-section-title">
    <span>${escapeHtml(mark)}</span>
    <h3 id="${escapeHtml(id)}-title">${escapeHtml(title)}</h3>
  </div>
  ${body}
</section>`;

export const renderCertificationReplay = (artifacts: UiArtifacts): string => {
  const beforeReceipt = artifacts.beforeReceipt ?? (artifacts.phase === "before" ? artifacts.receipt : undefined);
  const afterReceipt = artifacts.afterReceipt ?? (artifacts.phase === "after" ? artifacts.receipt : undefined);
  const beforeTraceEvents = artifacts.beforeTraceEvents ?? (artifacts.phase === "before" ? artifacts.traceEvents : []);
  const afterTraceEvents = artifacts.afterTraceEvents ?? (artifacts.phase === "after" ? artifacts.traceEvents : []);
  const beforeViolations = artifacts.beforeViolations ?? (artifacts.phase === "before" ? artifacts.violations : []);
  const afterViolations = artifacts.afterViolations ?? (artifacts.phase === "after" ? artifacts.violations : []);
  const mission = artifacts.missions[0];
  const readinessState = afterReceipt ? `${afterReceipt.verdict} / ${afterReceipt.score}/100` : "rerun receipt missing";
  const mutationText =
    artifacts.receipt.mode === "fixture"
      ? "fixture mode / no live Splunk mutation"
      : "live mode / read-only inventory / no Splunk mutation";
  const artifactsText = artifactFileList(artifacts.paths)
    .map((path) => path.split("/").at(-1) ?? path)
    .join(" / ");

  return `<section id="certification-replay" class="shell-section" data-route-panel="certification-replay" aria-label="Certification replay">
    <p class="replay-invocation"><code>$ splc verify --replay --mode=${escapeHtml(artifacts.receipt.mode)} --out=${escapeHtml(artifacts.outDir)}</code></p>
    <article class="replay-card" data-replay aria-label="Readiness Pre-Flight Card">
      <header class="replay-card-header">
        <div>
          <p>SplunkReady / Agent Readiness Compiler</p>
          <h2>Readiness Pre-Flight Card</h2>
          <span>${escapeHtml(artifacts.receipt.agent.name)} ${escapeHtml(artifacts.receipt.agent.version)} against ${escapeHtml(artifacts.receipt.environment.name)}</span>
        </div>
        <strong>${escapeHtml(readinessState)}</strong>
      </header>
      <nav class="replay-card-rail" aria-label="Pre-flight card sections">
        <button type="button" data-replay-target="sec-a" aria-current="true" aria-selected="true" aria-controls="sec-a"><span>A</span>Contract</button>
        <button type="button" data-replay-target="sec-b" aria-selected="false" aria-controls="sec-b"><span>B</span>Trace A</button>
        <button type="button" data-replay-target="sec-c" aria-selected="false" aria-controls="sec-c"><span>C</span>Rules</button>
        <button type="button" data-replay-target="sec-d" aria-selected="false" aria-controls="sec-d"><span>D</span>Patch</button>
        <button type="button" data-replay-target="sec-e" aria-selected="false" aria-controls="sec-e"><span>E</span>Trace B</button>
      </nav>
      <div class="replay-card-body">
        ${renderReplaySection("sec-a", "A", "Contract", renderContractReplayTable(artifacts.contract, artifacts.missions, mission), true)}
        ${renderReplaySection("sec-b", "B", "Trace A - before patch", renderTraceReplayTable(beforeTraceEvents, "No trace-before.json artifact loaded."))}
        ${renderReplaySection("sec-c", "C", "Deterministic rules", renderRuleReplayTable(beforeViolations, mission, artifacts.readinessProfile))}
        ${renderReplaySection("sec-d", "D", "Policy patch", renderPatchReplayTable(artifacts.policyPatch))}
        ${renderReplaySection(
          "sec-e",
          "E",
          "Trace B - after patch",
          `${renderTraceReplayTable(afterTraceEvents, "No trace-after.json artifact loaded.")}${renderReceiptReplayTable(
            beforeReceipt,
            afterReceipt,
            afterViolations,
            afterTraceEvents
          )}`
        )}
      </div>
      <footer class="replay-compile">
        <span>compiled by Agent Readiness Compiler</span>
        <span>${escapeHtml(mutationText)}</span>
        <code>${escapeHtml(artifactsText)}</code>
      </footer>
    </article>
  </section>`;
};
