# Move 11 - Build Proof Bundle Browser And Comparison

## Goal

Turn generated artifacts into a usable workbench: browse runs, compare before
and after receipts, inspect traces, and verify manifests without leaving the UI.

## Scope

Expected files:

- artifact-store backend routes
- UI run list, receipt diff, trace timeline, proof audit panel
- static shell only if shared renderers are reused
- tests
- logs

## Plan

1. Add run list grouped by workflow type and status.
2. Add receipt before/after comparison:
   - verdict;
   - score;
   - violations;
   - evidence refs;
   - policy patch summary.
3. Add trace timeline with tool calls and tool results.
4. Add proof audit panel showing pass/fail/manifest status.
5. Add manifest verification action for a selected run.
6. Add search/filter by mission, verdict, rule ID, and run status.
7. Keep dense operational layout. No landing-page hero.

## Acceptance Criteria

- A user can inspect why a run failed and why a rerun passed.
- Manifest verification result is visible in UI.
- The UI can browse multiple runs without reload.
- The view remains usable on laptop-width screens.

## Verification

```bash
npx vitest run tests/ui/app.test.ts tests/ui/shell.test.ts tests/workbench
npm run ui:build
npm run check
git diff --check
```

Run browser screenshots for at least 1440px and mobile widths.

## Stop Conditions

- Stop before rendering untrusted artifact HTML.
- Stop if comparison hides raw receipt links.
- Stop if the UI invents conclusions not present in artifacts.
