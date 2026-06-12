import type { UiArtifactBundle, HostedModelProof, HostedModelDiagnostic } from "../artifacts.js";
import type { RenderOptions, WorkbenchRenderState } from "../render.js";
import {
  value,
  code,
  renderFactTable,
  renderPlainList,
  renderProofAuditPanel,
  renderFirewallBlock,
  renderLiveProofSummary,
  renderLiveSecurityProofSummary
} from "./helpers.js";
import { renderMcpTranscriptImport } from "./mcp.js";

export const renderLiveSecurityReadiness = (bundle: UiArtifactBundle): string => {
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
  const setupSummary = readiness.setupRequirements
    .map((requirement) => `${requirement.id}: ${requirement.satisfied ? "ready" : "missing"}`)
    .join(" / ");
  const setupSummaryLabel = setupSummary.length > 0 ? setupSummary : "not recorded (legacy readiness artifact)";

  return `<section class="panel live-security-panel">
    <h2>Flagship security readiness</h2>
    ${renderFactTable([
      ["Status", readiness.status],
      ["Proof mode", `${readiness.proofMode.type} / fallback ${readiness.proofMode.fallbackAllowed ? "allowed" : "blocked"}`],
      ["Mission", `${readiness.mission.id} / ${readiness.mission.story}`],
      ["Contract", `${readiness.contract.id} / ${readiness.contract.name}`],
      ["Saved search", `${readiness.requiredSavedSearch.ref} / ${readiness.requiredSavedSearch.present ? "present" : "missing"}`],
      ["Saved-search run", runSummary],
      ["Preferred index", `${readiness.preferredIndex.name} / ${readiness.preferredIndex.present ? "present" : "missing"}`],
      ["Setup requirements", setupSummaryLabel],
      ["Generic fallback", `${readiness.fallbackPolicy.genericLiveCommand} / ${readiness.fallbackPolicy.genericLiveDescription}`],
      ["Missing tools", readiness.requiredTools.missing.length > 0 ? readiness.requiredTools.missing.join(" / ") : "none"],
      ["Blockers", readiness.blockers.length > 0 ? readiness.blockers.join(" / ") : "none"],
      ["Next actions", readiness.nextActions.join(" / ")]
    ])}
  </section>`;
};

export const renderLiveSecurityKit = (bundle: UiArtifactBundle): string => {
  const kit = bundle.liveSecurityKit;

  if (!kit) {
    return "";
  }

  const validation = kit.validation;
  const failedChecks = validation?.checks.filter((check) => check.status === "FAIL") ?? [];

  return `<section class="panel live-security-kit-panel">
    <h2>Operator security kit</h2>
    ${renderFactTable([
      ["Status", kit.status],
      ["Validation", validation ? `${validation.status} / ${failedChecks.length} failed check(s)` : "not recorded"],
      ["Mission", kit.mission],
      ["Saved search", kit.savedSearch.ref],
      ["Preferred index", kit.preferredIndex],
      ["Sourcetype", kit.sourcetype],
      ["Sample events", kit.sampleEvents],
      ["Operator action", kit.operatorActionRequired ? "required" : "not required"],
      ["Mutation", kit.mutation ? "yes" : "no"],
      ["SplunkReady write operations", "none"],
      ["Generated", kit.generatedAt]
    ])}
    <div class="kit-detail-grid">
      <section class="kit-detail">
        <h3>Generated files</h3>
        ${renderPlainList(kit.artifacts, "kit-file-list")}
      </section>
      <section class="kit-detail">
        <h3>Validation checks</h3>
        ${
          validation
            ? `<table class="kit-validation-table">
                <thead><tr><th>Check</th><th>Status</th><th>Evidence</th></tr></thead>
                <tbody>${validation.checks
                  .map((check) => `<tr><td>${code(check.id)}<span>${value(check.path)}</span></td><td>${value(check.status)}</td><td>${value(check.detail)}</td></tr>`)
                  .join("")}</tbody>
              </table>`
            : `<p class="empty">Validation artifact not recorded.</p>`
        }
      </section>
      <section class="kit-detail">
        <h3>Operator warnings</h3>
        ${renderPlainList(kit.operatorWarnings ?? ["Operator-owned install/import only; SplunkReady performs no Splunk write operation."], "kit-note-list")}
      </section>
      <section class="kit-detail">
        <h3>Cleanup guidance</h3>
        ${renderPlainList(kit.cleanupGuidance ?? ["Cleanup is operator-owned and outside SplunkReady."], "kit-note-list")}
      </section>
    </div>
  </section>`;
};

export const renderHostedModelSetupRows = (
  setup:
    | {
        configured: boolean;
        requiredEnvironment: Array<{ name: string; status: string }>;
        optionalEnvironment: Array<{ name: string; status: string }>;
        operatorCommand: string;
        secretHandling: string;
      }
    | undefined
): Array<[string, unknown]> => {
  if (!setup) {
    return [];
  }

  return [
    ["Live setup", setup.configured ? "configured" : "blocked"],
    ["Required env", setup.requiredEnvironment.map((item) => `${item.name}:${item.status}`).join(" / ")],
    ["Optional env", setup.optionalEnvironment.map((item) => `${item.name}:${item.status}`).join(" / ")],
    ["Operator command", setup.operatorCommand],
    ["Secret handling", setup.secretHandling]
  ];
};

export const renderHostedModelProof = (proof: HostedModelProof | undefined): string => {
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
      ["Passed tools", proof.passedTools?.join(" / ") || "none"],
      ["Blocked tools", proof.blockedTools?.join(" / ") || "none"],
      [
        "Tool results",
        proof.toolResults?.map((result) => `${result.toolName}:${result.status}`).join(" / ") || "not recorded"
      ],
      ["Rule context", proof.deterministicContext.ruleIds.join(" / ")],
      ["Pass/fail authority", proof.deterministicContext.passFailAuthority],
      ...renderHostedModelSetupRows(proof.setup),
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

export const renderHostedModelDiagnostic = (diagnostic: HostedModelDiagnostic | undefined): string => {
  if (!diagnostic) {
    return "";
  }

  return `<section class="panel hosted-model-diagnostic-panel">
    <h2>Hosted model diagnostic</h2>
    ${renderFactTable([
      ["Status", diagnostic.status],
      ["Blocker", diagnostic.blockerClass],
      ["Mode", diagnostic.mode],
      ["Contract", diagnostic.contract.id],
      ["Required tools", diagnostic.requiredTools.join(" / ")],
      ["Available tools", diagnostic.availableTools.length > 0 ? diagnostic.availableTools.join(" / ") : "none"],
      ["Missing tools", diagnostic.missingTools.length > 0 ? diagnostic.missingTools.join(" / ") : "none"],
      ["Passed tools", diagnostic.passedTools?.join(" / ") || "none"],
      ["Blocked tools", diagnostic.blockedTools?.join(" / ") || "none"],
      [
        "Tool results",
        diagnostic.toolResults?.map((result) => `${result.toolName}:${result.status}`).join(" / ") || "not recorded"
      ],
      ["Permission", diagnostic.permission.status],
      ["Permission blocker", diagnostic.permission.blockerClass],
      ["Error", diagnostic.permission.error ?? "none"],
      ["Required actions", diagnostic.permission.requiredActions?.join(" / ") ?? "none"],
      ["Remediation", diagnostic.remediation?.status ?? "not recorded"],
      ["Remediation summary", diagnostic.remediation?.summary ?? "not recorded"],
      ["Operator checks", diagnostic.remediation?.operatorChecks.join(" / ") ?? "not recorded"],
      ["Rerun", diagnostic.remediation?.rerunCommand ?? "not recorded"],
      ...renderHostedModelSetupRows(diagnostic.setup),
      ["Mutation", diagnostic.mutation ? "yes" : "no"],
      ["Authority", diagnostic.deterministicAuthority],
      ["Notes", diagnostic.notes]
    ])}
  </section>`;
};

export const renderHostedModelSummary = (summary: any): string => {
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

export const liveActionRows = [
  ["live-smoke", "Run live smoke", "Compile read-only MCP inventory and readiness profile."],
  ["live-candidates", "Scan saved searches", "Run bounded saved-search candidates from the compiled live contract."],
  ["live-security-readiness", "Check security readiness", "Verify flagship saved-search evidence without mutating Splunk."],
  ["live-security-proof", "Run security proof", "Execute the strict LLM fail-to-pass proof only when readiness is green."]
] as const;

export const liveKitActionRows = [
  ["live-security-kit", "Generate operator kit", "Write local app, saved search, sample CSV, README, and validation manifest."]
] as const;

export const hostedModelActionRows = [
  ["hosted-model-diagnostic", "Check SAIA entitlement", "Call hosted-model helper tools only; report PASS or BLOCKED."],
  ["hosted-model-proof", "Run hosted-model proof", "Collect advisory generate/explain/optimize/ask output without executing SPL."]
] as const;

export const renderLiveActionPanel = (workbench: WorkbenchRenderState | undefined): string => {
  const job = workbench?.job;
  const running = job?.state === "queued" || job?.state === "running";
  const liveAvailable = workbench?.liveAvailable === true;
  const disabled = !workbench?.available || !liveAvailable || running;
  const kitDisabled = !workbench?.available || running;
  const missing = workbench?.liveMissing ?? [];
  const status = !workbench?.available
    ? "workbench backend not connected"
    : liveAvailable
      ? "available from server env"
      : `unavailable: ${missing.join(" / ") || "live env not configured"}`;

  return `<section class="panel live-action-panel">
    <h2>Live workbench actions</h2>
    ${renderFactTable([
      ["Backend", workbench?.available ? (workbench.healthStatus ?? "available") : "not connected"],
      ["Live mode", status],
      [
        "SAIA",
        workbench?.saiaAvailable
          ? "available"
          : liveAvailable
            ? "not confirmed; diagnostic may return BLOCKED"
            : "not available"
      ],
      ["SAIA authority", "advisory only"],
      ["Browser credentials", "not accepted"],
      ["Operator kit", "local generation; no live credentials required"],
      ["Mutation", "false"]
    ])}
    <div class="live-action-list kit-action-list">
      ${liveKitActionRows
        .map(
          ([workflow, label, detail]) => `<button class="replay-button live-action-button" type="button" data-run-workflow="${workflow}" ${kitDisabled ? "disabled" : ""}>
            <strong>${value(label)}</strong>
            <span>${value(detail)}</span>
          </button>`
        )
        .join("")}
    </div>
    <div class="live-action-list">
      ${liveActionRows
        .map(
          ([workflow, label, detail]) => `<button class="replay-button live-action-button" type="button" data-run-workflow="${workflow}" ${disabled ? "disabled" : ""}>
            <strong>${value(label)}</strong>
            <span>${value(detail)}</span>
          </button>`
        )
        .join("")}
    </div>
    <div class="live-action-list hosted-model-action-list">
      ${hostedModelActionRows
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
            <ol class="job-events" aria-label="Live workbench job events">
              ${job.events
                .map((event) => `<li data-job-event="${value(event.type)}"><strong>${value(event.type)}</strong><span>${value(event.message)}</span></li>`)
                .join("")}
            </ol>
          </div>`
        : `<p class="empty">${value(
            liveAvailable
              ? "Run a server-owned live action to produce fresh live artifacts."
              : `Live mode unavailable for live checks. The local operator kit can still be generated without credentials. Missing server env: ${missing.join(", ") || "SPLUNKREADY_LIVE_ENABLED=true, SPLUNKREADY_SPLUNK_MCP_URL, SPLUNKREADY_SPLUNK_MCP_TOKEN"}.`
          )}</p>`
    }
  </section>`;
};

export const renderLiveConnect = (bundle: UiArtifactBundle, options: RenderOptions): string => {
  const contract = bundle.liveSmokeContract ?? bundle.contract;
  const liveLoaded = Boolean(bundle.liveSmokeContract || contract?.mode === "live");

  return `<main class="view" data-view="live-connect">
    <section class="workbench">
      <div class="section-title">
        <h1>Live connect</h1>
      </div>
      <div class="receipt-ledger">
        ${renderLiveActionPanel(options.workbench)}
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
