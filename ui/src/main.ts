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
import { normalizeView, renderApp, renderError, type ViewId, type WorkbenchRenderState } from "./render.js";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root.");
}

let bundle: UiArtifactBundle | undefined;
let artifactOptions: ArtifactOption[] = defaultArtifactOptions;
let workbench: WorkbenchRenderState = { available: false, healthStatus: "not connected" };
const disabledRuleIds = new Set<string>();

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
    const response = await fetch("/api/health");

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    workbench = { ...workbench, available: true, healthStatus: "available" };
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

const pollFixtureJob = async (jobId: string): Promise<void> => {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const job = await fetchJob(jobId);

    workbench = { ...workbench, job };
    render();

    if (job.state === "succeeded") {
      const nextUrl = new URL(window.location.href);

      nextUrl.searchParams.set("artifacts", job.artifactBase);
      nextUrl.hash = "#certification-replay";
      window.history.pushState(null, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
      bundle = await loadUiArtifactBundle(job.artifactBase);
      artifactOptions = [{ label: `Workbench ${job.runId}`, path: job.artifactBase }, ...artifactOptions];
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
        state: "failed",
        runId: "unknown",
        artifactBase: "",
        events: []
      }),
      state: "failed",
      error: "Timed out waiting for fixture certification job."
    }
  };
  render();
};

const runFixtureCertification = async (): Promise<void> => {
  try {
    const response = await fetch("/api/jobs/fixture-certification", { method: "POST" });

    if (!response.ok) {
      throw new Error(`Unable to start fixture certification: ${response.status} ${response.statusText}`);
    }

    const { job } = (await response.json()) as WorkbenchJobResponse;

    workbench = { ...workbench, available: true, job };
    render();
    await pollFixtureJob(job.id);
  } catch (error) {
    workbench = {
      ...workbench,
      job: {
        id: "job-start-failed",
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
