# Move 07 - Ship Executable Fixture Certification UI

## Goal

Give SplunkReady a real front-end execution path: click a button, run
certification, watch NOT READY become READY, inspect the trace, receipt, policy
patch, proof audit, and manifest.

## Scope

Expected files:

- `ui/src/main.ts`
- `ui/src/render.ts`
- `ui/src/artifacts.ts`
- `ui/src/styles.css`
- shared API client/types if needed
- UI and browser tests
- logs

## Plan

1. Add a Workbench landing view focused on the current run.
2. Add **Run fixture certification** action connected to the backend job runner.
3. Render phases from structured events.
4. Refresh artifacts when the job completes.
5. Show before and after verdicts side by side.
6. Make violations expandable with trace/evidence references.
7. Show policy patch as proposed additions and the policy-backed rerun path.
8. Show proof audit and manifest status.
9. Preserve the existing design language. No generic hero page, no decorative
   animation, no marketing filler.
10. Add empty, loading, failed, cancelled, and success states.

## Acceptance Criteria

- The UI can start and complete a fixture certification run.
- The UI displays live progress from the backend.
- The UI updates to the new artifacts without page reload.
- No receipt, score, or violation is modified client-side.
- The run is convincing enough to record as the primary demo flow.

## Verification

```bash
npx vitest run tests/ui/app.test.ts tests/ui/shell.test.ts tests/workbench
npm run ui:build
npm run check
git diff --check
```

Use browser automation to record desktop and mobile screenshots of the workflow.

## Stop Conditions

- Stop before adding waiver or score override UI.
- Stop if the UI only simulates progress.
- Stop if failures are hidden behind generic toast text.
