import type { UiArtifactBundle, PlatformDevexProof, JudgeProofSummary, PublicProofExportManifest } from "../artifacts.js";
import type { RenderOptions } from "../render.js";
import type { WorkbenchRenderState } from "../workbenchTypes.js";
import { value, code, renderFactTable, renderProofAuditPanel } from "./helpers.js";
import { renderRunList, renderTracePreview, currentRunIdFromBundle } from "../runBrowser.js";
import { artifactUrl } from "../artifacts.js";

export const renderPublicProofExportPanel = (manifest: PublicProofExportManifest | undefined): string => {
  if (!manifest) {
    return "";
  }

  const schemaValidated = manifest.files.filter((file) => file.schemaValidated).length;

  return `<section class="panel public-proof-export-panel">
    <h2>Public proof export</h2>
    ${renderFactTable([
      ["Status", manifest.redactionStatus],
      ["Source run", manifest.sourceRunId],
      ["Source commit", manifest.sourceCommit],
      ["Files", manifest.files.length],
      ["Schema-validated files", schemaValidated],
      ["Aggregate hash", manifest.aggregateSha256],
      ["Redactions", Object.entries(manifest.redaction).map(([key, status]) => `${key}: ${status}`).join(" / ")],
      ["Boundary", "sanitized derivative bundle; not the unredacted source proof"]
    ])}
  </section>`;
};

export const renderJudgeProofPanel = (summary: JudgeProofSummary | undefined): string => {
  if (!summary) {
    return "";
  }

  const failingGates = summary.gates.filter((gate) => gate.status !== "PASS");

  return `<section class="panel judge-proof-panel">
    <h2>Judge proof</h2>
    ${renderFactTable([
      ["Status", summary.status],
      ["Mode", summary.mode],
      ["Mutation", summary.mutation ? "yes" : "no"],
      ["Suite proof", summary.proofDirs.suite],
      ["Firewall proof", summary.proofDirs.firewall],
      ["LLM evidence", summary.llmEvidence.status],
      ["LLM role", summary.llmEvidence.role],
      ["Pass/fail authority", summary.llmEvidence.passFailAuthority],
      ["LLM included", summary.llmActivation.included ? "yes" : "no"],
      ["LLM configured", summary.llmActivation.configured ? "yes" : "no"],
      ["Credential-free reason", summary.llmEvidence.reason ?? "n/a"],
      ["Gates", summary.gates.map((gate) => `${gate.id} / ${gate.status}`).join(" / ")],
      [
        "Warnings or failures",
        failingGates.length > 0 ? failingGates.map((gate) => `${gate.id}: ${gate.status}`).join(" / ") : "none"
      ],
      ["Next LLM command", summary.llmEvidence.nextCommand]
    ])}
  </section>`;
};

export const renderPlatformDevexProofPanel = (summary: PlatformDevexProof | undefined): string => {
  if (!summary) {
    return "";
  }

  return `<section class="panel platform-proof-panel">
    <h2>Platform proof</h2>
    ${renderFactTable([
      ["Status", summary.status],
      ["Mutation", summary.mutation ? "yes" : "no"],
      ["Deterministic authority", summary.deterministicAuthority ? "yes" : "no"],
      ["Fixture receipt", `${summary.receipts.fixtureBefore} -> ${summary.receipts.fixtureAfter}`],
      ["MCP transcript receipt", summary.receipts.transcript],
      ["Steps", summary.steps.map((step) => `${step.label}: ${step.command}`).join(" / ")],
      ["Fixture replay", summary.routes.fixtureReplay],
      ["Transcript receipt", summary.routes.transcriptReceipt]
    ])}
  </section>`;
};

export const renderReceiptComparison = (bundle: UiArtifactBundle): string => {
  const before = bundle.beforeReceipt;
  const after = bundle.afterReceipt;
  const current = bundle.receipt;
  const rows: Array<[string, unknown, unknown]> = [
    ["Verdict", before?.verdict ?? current?.verdict ?? "n/a", after?.verdict ?? current?.verdict ?? "n/a"],
    ["Score", before?.score ?? current?.score ?? "n/a", after?.score ?? current?.score ?? "n/a"],
    ["Violations", before?.violations.length ?? current?.violations.length ?? "n/a", after?.violations.length ?? current?.violations.length ?? "n/a"],
    ["Evidence refs", before?.evidenceRefs.length ?? current?.evidenceRefs.length ?? "n/a", after?.evidenceRefs.length ?? current?.evidenceRefs.length ?? "n/a"],
    [
      "Policy patch",
      bundle.policyPatch ? `${bundle.policyPatch.rules.length} rule(s)` : "not loaded",
      bundle.policyPatch ? bundle.policyPatch.status : "not loaded"
    ]
  ];

  return `<section class="panel receipt-comparison">
    <h2>Receipt comparison</h2>
    <table class="comparison-table">
      <thead><tr><th>Field</th><th>Before/current</th><th>After/current</th></tr></thead>
      <tbody>${rows.map(([label, left, right]) => `<tr><th>${value(label)}</th><td>${value(left)}</td><td>${value(right)}</td></tr>`).join("")}</tbody>
    </table>
    <div class="raw-links">
      <a href="${artifactUrl(bundle.artifactBase, "receipt-before-001.json")}">receipt-before-001.json</a>
      <a href="${artifactUrl(bundle.artifactBase, "receipt-after-001.json")}">receipt-after-001.json</a>
      <a href="${artifactUrl(bundle.artifactBase, "receipt-external-001.json")}">receipt-external-001.json</a>
    </div>
  </section>`;
};

export const renderManifestVerificationPanel = (
  bundle: UiArtifactBundle,
  workbench: WorkbenchRenderState | undefined
): string => {
  const runId = currentRunIdFromBundle(bundle);
  const manifestVerification = workbench?.manifestVerification;
  const report = bundle.proofManifestVerification ?? manifestVerification?.report;
  const activeVerification = manifestVerification?.runId === runId ? manifestVerification : undefined;
  const status = activeVerification?.status ?? report?.status ?? (bundle.missing.includes("proof-manifest.json") ? "MISSING" : "UNVERIFIED");

  return `<section class="panel manifest-panel">
    <div class="run-panel-header">
      <h2>Manifest verification</h2>
      <button class="replay-button" type="button" data-verify-manifest="${value(runId ?? "")}" ${
        !runId || status === "MISSING" ? "disabled" : ""
      }>Verify manifest</button>
    </div>
    ${renderFactTable([
      ["Run", runId ?? "not a managed workbench run"],
      ["Status", status],
      ["Expected files", report?.expectedFiles ?? "n/a"],
      ["Actual files", report?.actualFiles ?? "n/a"],
      ["Missing files", report && report.missingFiles.length > 0 ? report.missingFiles.join(" / ") : "none"],
      ["Unexpected files", report && report.unexpectedFiles.length > 0 ? report.unexpectedFiles.join(" / ") : "none"],
      ["Changed files", report && report.changedFiles.length > 0 ? report.changedFiles.map((file) => file.path).join(" / ") : "none"],
      ["Error", activeVerification?.message ?? "none"]
    ])}
  </section>`;
};

export const renderProofBrowser = (bundle: UiArtifactBundle, options: RenderOptions): string => {
  const runs = options.workbench?.runs ?? [];

  return `<main class="view" data-view="proof-browser">
    <section class="workbench">
      <div class="section-title">
        <h1>Proof bundle browser</h1>
      </div>
      <div class="run-browser-grid">
        ${renderRunList(bundle, runs, options.workbench)}
        <div class="run-browser-detail">
          ${renderReceiptComparison(bundle)}
          ${renderTracePreview(bundle)}
          ${renderPlatformDevexProofPanel(bundle.platformDevexProof)}
          ${renderJudgeProofPanel(bundle.judgeProofSummary)}
          ${renderPublicProofExportPanel(bundle.publicProofExport)}
          ${renderProofAuditPanel(bundle.proofAudit)}
          ${renderManifestVerificationPanel(bundle, options.workbench)}
        </div>
      </div>
    </section>
  </main>`;
};
