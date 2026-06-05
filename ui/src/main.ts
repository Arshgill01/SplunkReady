import "@fontsource-variable/spline-sans";
import "@fontsource-variable/spline-sans-mono";
import "@fontsource-variable/geist-mono";
import "./styles.css";

import {
  artifactBaseFromLocation,
  defaultArtifactOptions,
  loadUiArtifactBundle,
  type ArtifactOption,
  type UiArtifactBundle
} from "./artifacts.js";
import {
  normalizeView,
  renderApp,
  renderError,
  type ViewId
} from "./render.js";
import type { ManifestVerificationState, WorkbenchRenderState, WorkbenchRunSummary } from "./workbenchTypes.js";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root.");
}

let bundle: UiArtifactBundle | undefined;
let artifactOptions: ArtifactOption[] = defaultArtifactOptions;
let workbench: WorkbenchRenderState = { available: false, healthStatus: "not connected" };
const disabledRuleIds = new Set<string>();

interface WorkbenchHealthResponse {
  capabilities?: {
    fixtureCertification?: boolean;
    live?: boolean;
    saia?: boolean;
  };
  live?: {
    available?: boolean;
    missing?: string[];
  };
}

interface WorkbenchRunsResponse {
  runs?: WorkbenchRunSummary[];
}

interface ManifestVerificationResponse {
  status: "PASS" | "FAIL";
  report?: ManifestVerificationState["report"];
}

const activeViewFromHash = (): ViewId => normalizeView(window.location.hash.replace(/^#/, ""));

const render = (): void => {
  if (!bundle) {
    return;
  }

  app.innerHTML = renderApp(bundle, activeViewFromHash(), { disabledRuleIds, artifactOptions, workbench });
  bindInteractions();
};

const markReplayRunning = (): void => {
  const frame = document.querySelector(".app-frame");

  if (!frame) {
    return;
  }

  frame.classList.remove("replay-running");
  void frame.getBoundingClientRect();
  frame.classList.add("replay-running");
};

const loadArtifactFromLocation = async (): Promise<void> => {
  try {
    bundle = await loadUiArtifactBundle(artifactBaseFromLocation(window.location));
    artifactOptions = bundle.artifactOptions ?? artifactOptions;
    disabledRuleIds.clear();
    render();

    if (activeViewFromHash() === "certification-replay") {
      markReplayRunning();
    }
  } catch (error) {
    app.innerHTML = renderError(error instanceof Error ? error.message : String(error));
  }
};

const loadWorkbenchHealth = async (): Promise<void> => {
  try {
    const [response, runsResponse] = await Promise.all([fetch("/api/health"), fetch("/api/artifacts")]);

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const health = (await response.json()) as WorkbenchHealthResponse;
    const runs = runsResponse.ok ? ((await runsResponse.json()) as WorkbenchRunsResponse).runs ?? [] : [];

    workbench = {
      ...workbench,
      available: true,
      healthStatus: "available",
      liveAvailable: health.live?.available ?? health.capabilities?.live ?? false,
      liveMissing: health.live?.missing ?? [],
      saiaAvailable: health.capabilities?.saia ?? false,
      runs
    };
  } catch {
    workbench = { available: false, healthStatus: "not connected" };
  }
};

const navigateToArtifact = async (artifactBase: string, view: ViewId): Promise<void> => {
  const nextUrl = new URL(window.location.href);

  nextUrl.searchParams.set("artifacts", artifactBase);
  nextUrl.hash = `#${view}`;
  window.history.pushState(null, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  await loadArtifactFromLocation();
};

const refreshWorkbenchRuns = async (): Promise<void> => {
  try {
    const response = await fetch("/api/artifacts");

    if (!response.ok) {
      return;
    }

    const runs = ((await response.json()) as WorkbenchRunsResponse).runs ?? [];

    workbench = { ...workbench, available: true, runs };
  } catch {
    // Keep the last run list visible if a refresh fails.
  }
};

interface WorkbenchJobResponse {
  job: NonNullable<WorkbenchRenderState["job"]>;
}

const fetchJob = async (jobId: string): Promise<NonNullable<WorkbenchRenderState["job"]>> => {
  const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`);

  if (!response.ok) {
    throw new Error(`Unable to load workbench job ${jobId}: ${response.status} ${response.statusText}`);
  }

  return ((await response.json()) as WorkbenchJobResponse).job;
};

const pollWorkbenchJob = async (jobId: string, successView: ViewId): Promise<void> => {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const job = await fetchJob(jobId);

    workbench = { ...workbench, job };
    render();

    if (job.state === "succeeded") {
      const nextUrl = new URL(window.location.href);

      nextUrl.searchParams.set("artifacts", job.artifactBase);
      nextUrl.hash = `#${successView}`;
      window.history.pushState(null, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
      bundle = await loadUiArtifactBundle(job.artifactBase);
      artifactOptions = [{ label: `Workbench ${job.runId}`, path: job.artifactBase }, ...artifactOptions];
      await refreshWorkbenchRuns();
      render();
      return;
    }

    if (job.state === "failed" || job.state === "cancelled") {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  workbench = {
    ...workbench,
    job: {
      ...(workbench.job ?? {
        id: jobId,
        workflow: "unknown",
        state: "failed",
        runId: "unknown",
        artifactBase: "",
        events: []
      }),
      state: "failed",
      error: `Timed out waiting for workbench job ${jobId}.`
    }
  };
  render();
};

const runWorkbenchWorkflow = async (workflow: string, successView: ViewId, payload?: unknown): Promise<void> => {
  try {
    const response = await fetch(`/api/jobs/${encodeURIComponent(workflow)}`, {
      method: "POST",
      headers: payload === undefined ? undefined : { "content-type": "application/json" },
      body: payload === undefined ? undefined : JSON.stringify(payload)
    });

    if (!response.ok) {
      const failure = await response.json().catch(() => undefined) as { error?: { message?: string } } | undefined;
      throw new Error(failure?.error?.message ?? `Unable to start ${workflow}: ${response.status} ${response.statusText}`);
    }

    const { job } = (await response.json()) as WorkbenchJobResponse;

    workbench = { ...workbench, available: true, job };
    render();
    await pollWorkbenchJob(job.id, successView);
  } catch (error) {
    workbench = {
      ...workbench,
      job: {
        id: "job-start-failed",
        workflow,
        state: "failed",
        runId: "not allocated",
        artifactBase: "",
        error: error instanceof Error ? error.message : String(error),
        events: []
      }
    };
    render();
  }
};

const runFixtureCertification = async (): Promise<void> => {
  await runWorkbenchWorkflow("fixture-certification", "certification-replay");
};

const successViewForWorkflow = (workflow: string): ViewId => {
  if (workflow === "fixture-certification") {
    return "certification-replay";
  }

  if (workflow === "certification-index") {
    return "agent-index";
  }

  if (workflow === "policy-backed-rerun" || workflow === "firewall-check") {
    return "policy-firewall";
  }

  if (workflow === "live-security-kit") {
    return "live-connect";
  }

  return "live-connect";
};

const selectedFileText = async (selector: string, label: string): Promise<string> => {
  const input = document.querySelector<HTMLInputElement>(selector);
  const file = input?.files?.[0];

  if (!file) {
    throw new Error(`${label} file is required.`);
  }

  return file.text();
};

const stringInput = (selector: string): string | undefined => {
  const value = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)?.value.trim();

  return value && value.length > 0 ? value : undefined;
};

const checked = (selector: string): boolean =>
  document.querySelector<HTMLInputElement>(selector)?.checked === true;

const runExternalTraceImport = async (): Promise<void> => {
  const traceText = await selectedFileText("[data-external-trace-file]", "External trace");
  const trace = JSON.parse(traceText) as unknown;

  await runWorkbenchWorkflow("external-trace-certification", "receipt", {
    trace,
    requirePass: checked("[data-external-trace-require-pass]"),
    agentName: stringInput("[data-external-trace-agent-name]"),
    agentVersion: stringInput("[data-external-trace-agent-version]")
  });
};

const runMcpTranscriptImport = async (): Promise<void> => {
  const transcript = await selectedFileText("[data-mcp-transcript-file]", "MCP transcript");

  await runWorkbenchWorkflow("mcp-transcript-certification", "receipt", {
    transcript,
    finalAnswer: stringInput("[data-mcp-transcript-final-answer]"),
    strictImport: checked("[data-mcp-transcript-strict-import]"),
    requirePass: checked("[data-mcp-transcript-require-pass]"),
    agentName: stringInput("[data-mcp-transcript-agent-name]"),
    agentVersion: stringInput("[data-mcp-transcript-agent-version]")
  });
};

const runCertificationIndex = async (): Promise<void> => {
  const runIds = [...document.querySelectorAll<HTMLInputElement>("[data-index-run]:checked")].map((input) => input.value);

  if (runIds.length < 2) {
    throw new Error("Select at least two managed proof runs.");
  }

  await runWorkbenchWorkflow("certification-index", "agent-index", { runIds });
};

const runPublicProofExport = async (sourceRunId: string): Promise<void> => {
  await runWorkbenchWorkflow("public-proof-export", "proof-browser", { sourceRunId });
};

const showStartFailure = (workflow: string, error: unknown): void => {
  workbench = {
    ...workbench,
    job: {
      id: "job-start-failed",
      workflow,
      state: "failed",
      runId: "not allocated",
      artifactBase: "",
      error: error instanceof Error ? error.message : String(error),
      events: []
    }
  };
  render();
};

const setRunFilters = (): void => {
  workbench = {
    ...workbench,
    runFilter: document.querySelector<HTMLInputElement>("[data-run-filter]")?.value ?? "",
    runStatusFilter: document.querySelector<HTMLSelectElement>("[data-run-status-filter]")?.value ?? "all",
    runWorkflowFilter: document.querySelector<HTMLSelectElement>("[data-run-workflow-filter]")?.value ?? "all"
  };
  render();
};

const verifyManifest = async (runId: string): Promise<void> => {
  try {
    const response = await fetch(`/api/artifacts/${encodeURIComponent(runId)}/verify-manifest`, { method: "POST" });

    if (!response.ok) {
      const failure = await response.json().catch(() => undefined) as { error?: { message?: string } } | undefined;
      throw new Error(failure?.error?.message ?? `Unable to verify manifest: ${response.status} ${response.statusText}`);
    }

    const result = (await response.json()) as ManifestVerificationResponse;

    workbench = {
      ...workbench,
      manifestVerification: { runId, status: result.status, report: result.report }
    };
    await refreshWorkbenchRuns();
    if (bundle) {
      bundle = await loadUiArtifactBundle(bundle.artifactBase);
    }
    render();
  } catch (error) {
    workbench = {
      ...workbench,
      manifestVerification: {
        runId,
        status: "ERROR",
        message: error instanceof Error ? error.message : String(error)
      }
    };
    render();
  }
};

const bindInteractions = (): void => {
  for (const link of document.querySelectorAll<HTMLAnchorElement>("[data-view-link]")) {
    link.addEventListener("click", () => {
      requestAnimationFrame(() => {
        if (!bundle) {
          return;
        }

        app.innerHTML = renderApp(bundle, activeViewFromHash(), {
          disabledRuleIds,
          artifactOptions,
          workbench
        });
        bindInteractions();
      });
    });
  }

  document.querySelector("[data-run-replay]")?.addEventListener("click", markReplayRunning);
  document.querySelector("[data-run-fixture-certification]")?.addEventListener("click", () => {
    markReplayRunning();
    void runFixtureCertification();
  });

  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-run-workflow]")) {
    button.addEventListener("click", () => {
      const workflow = button.dataset.runWorkflow;

      if (!workflow) {
        return;
      }

      void runWorkbenchWorkflow(workflow, successViewForWorkflow(workflow));
    });
  }

  document.querySelector<HTMLFormElement>("[data-external-trace-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void runExternalTraceImport().catch((error: unknown) => showStartFailure("external-trace-certification", error));
  });

  document.querySelector<HTMLFormElement>("[data-mcp-transcript-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void runMcpTranscriptImport().catch((error: unknown) => showStartFailure("mcp-transcript-certification", error));
  });

  document.querySelector<HTMLFormElement>("[data-certification-index-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void runCertificationIndex().catch((error: unknown) => showStartFailure("certification-index", error));
  });

  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-public-proof-export]")) {
    button.addEventListener("click", () => {
      const sourceRunId = button.dataset.publicProofExport;

      if (!sourceRunId) {
        return;
      }

      void runPublicProofExport(sourceRunId).catch((error: unknown) => showStartFailure("public-proof-export", error));
    });
  }

  for (const link of document.querySelectorAll<HTMLAnchorElement>("[data-proof-artifact]")) {
    link.addEventListener("click", (event) => {
      const artifactBase = link.dataset.proofArtifact;
      const view = normalizeView(link.dataset.proofView ?? "receipt");

      if (!artifactBase) {
        return;
      }

      event.preventDefault();
      void navigateToArtifact(artifactBase, view);
    });
  }

  const artifactSelector = document.querySelector<HTMLSelectElement>("[data-artifact-selector]");
  artifactSelector?.addEventListener("change", () => {
    void navigateToArtifact(artifactSelector.value, activeViewFromHash());
  });

  document.querySelector<HTMLInputElement>("[data-run-filter]")?.addEventListener("input", setRunFilters);
  document.querySelector<HTMLSelectElement>("[data-run-status-filter]")?.addEventListener("change", setRunFilters);
  document.querySelector<HTMLSelectElement>("[data-run-workflow-filter]")?.addEventListener("change", setRunFilters);

  document.querySelector<HTMLButtonElement>("[data-verify-manifest]")?.addEventListener("click", (event) => {
    const runId = (event.currentTarget as HTMLButtonElement).dataset.verifyManifest;

    if (!runId) {
      return;
    }

    void verifyManifest(runId);
  });

  for (const input of document.querySelectorAll<HTMLInputElement>("[data-policy-rule]")) {
    input.addEventListener("change", () => {
      const ruleId = input.dataset.policyRule;

      if (!ruleId || !bundle) {
        return;
      }

      if (input.checked) {
        disabledRuleIds.delete(ruleId);
      } else {
        disabledRuleIds.add(ruleId);
      }

      app.innerHTML = renderApp(bundle, activeViewFromHash(), {
        disabledRuleIds,
        artifactOptions,
        workbench
      });
      bindInteractions();
    });
  }
};

window.addEventListener("hashchange", render);
window.addEventListener("popstate", () => {
  void loadArtifactFromLocation();
});

await loadWorkbenchHealth();
await loadArtifactFromLocation();
