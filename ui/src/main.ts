import "@fontsource-variable/spline-sans";
import "@fontsource-variable/spline-sans-mono";
import "@fontsource-variable/geist-mono";
import "./styles.css";

import { artifactBaseFromLocation, loadUiArtifactBundle, type UiArtifactBundle } from "./artifacts.js";
import { normalizeView, renderApp, renderError, type ViewId } from "./render.js";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root.");
}

let bundle: UiArtifactBundle | undefined;
const disabledRuleIds = new Set<string>();

const activeViewFromHash = (): ViewId => normalizeView(window.location.hash.replace(/^#/, ""));

const markReplayRunning = (): void => {
  const frame = document.querySelector(".app-frame");

  if (!frame) {
    return;
  }

  frame.classList.remove("replay-running");
  void frame.getBoundingClientRect();
  frame.classList.add("replay-running");
};

const bindInteractions = (): void => {
  for (const link of document.querySelectorAll<HTMLAnchorElement>("[data-view-link]")) {
    link.addEventListener("click", () => {
      requestAnimationFrame(() => {
        if (!bundle) {
          return;
        }

        app.innerHTML = renderApp(bundle, activeViewFromHash(), { disabledRuleIds });
        bindInteractions();
      });
    });
  }

  document.querySelector("[data-run-replay]")?.addEventListener("click", markReplayRunning);

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

      app.innerHTML = renderApp(bundle, activeViewFromHash(), { disabledRuleIds });
      bindInteractions();
    });
  }
};

const render = (): void => {
  if (!bundle) {
    return;
  }

  app.innerHTML = renderApp(bundle, activeViewFromHash(), { disabledRuleIds });
  bindInteractions();
};

window.addEventListener("hashchange", render);

try {
  bundle = await loadUiArtifactBundle(artifactBaseFromLocation(window.location));
  render();
  markReplayRunning();
} catch (error) {
  app.innerHTML = renderError(error instanceof Error ? error.message : String(error));
}
