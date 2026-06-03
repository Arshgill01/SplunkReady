import "@fontsource-variable/spline-sans";
import "@fontsource-variable/spline-sans-mono";
import "@fontsource-variable/geist-mono";
import "./styles.css";

import { artifactBaseFromLocation, defaultArtifactOptions, loadUiArtifactBundle, type UiArtifactBundle } from "./artifacts.js";
import { normalizeView, renderApp, renderError, type ViewId } from "./render.js";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root.");
}

let bundle: UiArtifactBundle | undefined;
const disabledRuleIds = new Set<string>();

const activeViewFromHash = (): ViewId => normalizeView(window.location.hash.replace(/^#/, ""));

const render = (): void => {
  if (!bundle) {
    return;
  }

  app.innerHTML = renderApp(bundle, activeViewFromHash(), { disabledRuleIds, artifactOptions: defaultArtifactOptions });
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
    disabledRuleIds.clear();
    render();

    if (activeViewFromHash() === "certification-replay") {
      markReplayRunning();
    }
  } catch (error) {
    app.innerHTML = renderError(error instanceof Error ? error.message : String(error));
  }
};

const navigateToArtifact = async (artifactBase: string, view: ViewId): Promise<void> => {
  const nextUrl = new URL(window.location.href);

  nextUrl.searchParams.set("artifacts", artifactBase);
  nextUrl.hash = `#${view}`;
  window.history.pushState(null, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  await loadArtifactFromLocation();
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
          artifactOptions: defaultArtifactOptions
        });
        bindInteractions();
      });
    });
  }

  document.querySelector("[data-run-replay]")?.addEventListener("click", markReplayRunning);

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
        artifactOptions: defaultArtifactOptions
      });
      bindInteractions();
    });
  }
};

window.addEventListener("hashchange", render);
window.addEventListener("popstate", () => {
  void loadArtifactFromLocation();
});

await loadArtifactFromLocation();
