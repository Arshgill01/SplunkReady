import {
  artifactUrl,
  normalizeArtifactBase,
  summarizeBundle,
  type ArtifactOption,
  type UiArtifactBundle
} from "./artifacts.js";
import type { InteractiveCertificationResult } from "./interactiveCertifier.js";
import { currentRunIdFromBundle } from "./runBrowser.js";
import type { WorkbenchRenderState } from "./workbenchTypes.js";

import { value } from "./views/helpers.js";
import { renderMcpProof } from "./views/mcp.js";
import { renderLlmDeliberation } from "./views/llm.js";
import { renderReceipt } from "./views/receipt.js";
import { renderTraceTimeline } from "./views/timeline.js";
import { renderPolicyFirewall } from "./views/policy.js";
import { renderProofBrowser } from "./views/runs.js";
import { renderSuiteProof } from "./views/suite.js";
import { renderCertificationIndex } from "./views/agentIndex.js";
import { renderImportCertification } from "./views/importCert.js";
import { renderInteractiveCertification } from "./views/interactiveCert.js";
import { renderLiveConnect } from "./views/liveConnect.js";
import { renderReplay } from "./views/replay.js";

export type ViewId =
  | "certification-replay"
  | "receipt"
  | "trace-timeline"
  | "policy-firewall"
  | "suite-proof"
  | "mcp-proof"
  | "llm-deliberation"
  | "agent-index"
  | "proof-browser"
  | "import-certification"
  | "interactive-certification"
  | "live-connect";

export const views: Array<{ id: ViewId; label: string }> = [
  { id: "certification-replay", label: "Replay" },
  { id: "receipt", label: "Receipt" },
  { id: "trace-timeline", label: "Trace" },
  { id: "policy-firewall", label: "Policy" },
  { id: "suite-proof", label: "Suite" },
  { id: "mcp-proof", label: "MCP" },
  { id: "llm-deliberation", label: "LLM" },
  { id: "agent-index", label: "Agents" },
  { id: "proof-browser", label: "Runs" },
  { id: "import-certification", label: "Import" },
  { id: "interactive-certification", label: "Certify" },
  { id: "live-connect", label: "Live connect" }
];

export interface InteractiveCertificationState {
  status: "idle" | "running" | "succeeded" | "failed";
  result?: InteractiveCertificationResult;
  error?: string;
}

export interface RenderOptions {
  disabledRuleIds?: ReadonlySet<string>;
  artifactOptions?: ArtifactOption[];
  workbench?: WorkbenchRenderState;
  interactiveCertification?: InteractiveCertificationState;
}

export const normalizeView = (valueStr: string | undefined): ViewId =>
  views.some((view) => view.id === valueStr) ? (valueStr as ViewId) : "certification-replay";

export const renderArtifactSelector = (bundle: UiArtifactBundle, artifactOptions: ArtifactOption[] | undefined): string => {
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

export const optionalRailStories = (summary: ReturnType<typeof summarizeBundle>): string[] =>
  [
    summary.proofStory,
    summary.securityStory,
    summary.kitStory,
    summary.hostedModelStory,
    summary.auditStory,
    summary.firewallStory,
    summary.suiteStory,
    summary.indexStory,
    summary.mcpProofStory,
    summary.transcriptStory,
    summary.platformProofStory,
    summary.judgeProofStory
  ].filter((story) => !story.includes("not loaded"));

export const renderSidebar = (bundle: UiArtifactBundle, activeView: ViewId, options: RenderOptions): string => {
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

export const renderActiveView = (bundle: UiArtifactBundle, activeView: ViewId, options: RenderOptions): string => {
  if (activeView === "receipt") {
    return renderReceipt(bundle, options);
  }

  if (activeView === "trace-timeline") {
    return renderTraceTimeline(bundle);
  }

  if (activeView === "policy-firewall") {
    return renderPolicyFirewall(bundle, options);
  }

  if (activeView === "suite-proof") {
    return renderSuiteProof(bundle);
  }

  if (activeView === "mcp-proof") {
    return renderMcpProof(bundle);
  }

  if (activeView === "llm-deliberation") {
    return renderLlmDeliberation(bundle);
  }

  if (activeView === "agent-index") {
    return renderCertificationIndex(bundle, options);
  }

  if (activeView === "proof-browser") {
    return renderProofBrowser(bundle, options);
  }

  if (activeView === "import-certification") {
    return renderImportCertification(bundle, options);
  }

  if (activeView === "interactive-certification") {
    return renderInteractiveCertification(bundle, options);
  }

  if (activeView === "live-connect") {
    return renderLiveConnect(bundle, options);
  }

  return renderReplay(bundle, options);
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
export { WorkbenchRenderState };
