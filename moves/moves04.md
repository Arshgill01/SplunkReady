# Move 04 - Extract Reusable Certification Workflows

## Goal

Pull the core certification orchestration out of the CLI monolith so both the
CLI and the workbench backend can call it without shelling out or importing a
module that immediately runs `main()`.

## Scope

Expected files:

- new workflow modules under `src/workflows/`
- `src/cli.ts` call sites for demo, rerun, proof audit, and live proof where
  extraction is needed
- workflow tests under `tests/workflows/`
- affected CLI flow tests
- logs

## Plan

1. Extract a `runFixtureCertification` workflow for compile -> evaluate ->
   receipt -> rerun -> receipt -> proof audit -> manifest.
2. Return structured metadata: run ID, output dir, artifact paths, before/after
   verdicts, fail-to-pass status, mutation status, and errors.
3. Add a progress callback with stable phase names.
4. Extract only what the backend needs first. Do not attempt full CLI
   decomposition in this move.
5. Keep CLI output and file contracts stable.
6. Add workflow tests that call the module directly, then CLI tests proving the
   wrapper still behaves the same.

## Acceptance Criteria

- CLI `demo` behavior is unchanged.
- A backend can call the workflow directly.
- Workflow phases are structured and stable for UI rendering.
- Errors are structured and redacted.

## Verification

```bash
npx vitest run tests/workflows tests/cli/flow.test.ts
npm run build
npm run check
git diff --check
```

## Stop Conditions

- Stop if this becomes a full 3,400-line CLI rewrite.
- Stop before changing artifact schemas without a compatibility plan.
- Stop before shelling out to the CLI from the backend as the final design.
