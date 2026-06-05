# Move 33 - Runs Trace Preview Timeline

## Goal

Fix the Runs section trace preview so it reads as a compact ordered trace
timeline instead of summary-only phase cards.

## Scope

Expected files:

- `ui/src/runBrowser.ts`
- `ui/src/styles.css`
- `tests/ui/app.test.ts`
- `moves/README.md`
- logs

## Plan

1. Reproduce the populated Runs route in the packaged workbench with Playwright.
2. Render ordered trace events inside each visible phase card while keeping the
   detailed event table in the Trace view.
3. Keep the visual change small and consistent with the existing workbench UI.
4. Add focused render assertions and verify the packaged browser route after the
   patch with Playwright.

## Acceptance Criteria

- The Runs trace panel shows before/after event rows in order.
- Event rows include type/tool, short trace id, result/evidence counts when
  available, and finding count.
- The panel remains compact and does not add new workflow controls.
- Browser verification proves the packaged workbench route renders the updated
  trace preview without visible overlap on desktop and mobile widths.
- No secret env file is read, sourced, printed, or committed.

## Verification

```bash
npm test -- tests/ui/app.test.ts
npm run check
git diff --check
```

Playwright verification is required before commit because this is a UI change.

## Stop Conditions

- Stop before adding a new dependency.
- Stop before changing workbench workflow semantics or artifact schemas.
- Stop before reading `.splunkready*`, `.env`, or other secret-bearing files.
