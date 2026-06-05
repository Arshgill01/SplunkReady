# Move 27 - Run Browser Module Boundary

## Goal

Make the Runs proof-browser surface easier to maintain without changing the
judge-facing workflow or adding new UI features.

## Scope

Expected files:

- `ui/src/render.ts`
- `ui/src/runBrowser.ts`
- `ui/src/workbenchTypes.ts`
- `ui/src/main.ts`
- `moves/README.md`
- logs

## Plan

1. Move the run-list filtering, run ordering, active-run matching, and
   phase-level trace preview rendering out of the global app renderer.
2. Keep shared workbench render-state types in a small dedicated type module so
   app state does not depend on the full renderer module.
3. Preserve the existing HTML contract, `data-*` hooks, and visible proof
   browser behavior.
4. Verify with focused UI tests, build, and Playwright against the packaged
   workbench.

## Acceptance Criteria

- `ui/src/render.ts` no longer owns the run-browser list and trace-preview
  implementation details.
- The Runs view still renders managed runs, filters, export controls, receipt
  comparison, manifest verification, and phase-level trace preview.
- A fresh fixture certification run remains executable from the local workbench.
- Playwright verifies the Runs trace preview after the refactor on desktop and
  mobile viewport widths.
- No secret env file is read, sourced, printed, or committed.

## Verification

```bash
npm test -- tests/ui/app.test.ts
npm run ui:build
SPLUNKREADY_WORKBENCH_PORT=4344 npm run workbench
bash "$HOME/.codex/skills/playwright/scripts/playwright_cli.sh" open "http://127.0.0.1:4344/#certification-replay"
bash "$HOME/.codex/skills/playwright/scripts/playwright_cli.sh" run-code "<fixture-run-and-runs-view-check>"
bash "$HOME/.codex/skills/playwright/scripts/playwright_cli.sh" resize 390 844
bash "$HOME/.codex/skills/playwright/scripts/playwright_cli.sh" run-code "<mobile-overflow-check>"
npm run check
git diff --check
```

## Stop Conditions

- Stop before hiding receipt, trace, violation, manifest, redaction, or export
  evidence behind a less verifiable dashboard abstraction.
- Stop before adding a new runtime dependency.
- Stop before reading `.splunkready*`, `.env`, or other secret-bearing files.
