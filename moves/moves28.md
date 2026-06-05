# Move 28 - Browser Health Path Privacy

## Goal

Keep workbench health useful to the browser without exposing absolute local
filesystem paths or secret-derived live configuration values.

## Scope

Expected files:

- `src/workbench/config.ts`
- `tests/workbench/workbench.test.ts`
- `tests/workbench/server.test.ts`
- `moves/README.md`
- logs

## Plan

1. Remove the absolute artifact root from the `/api/health` response.
2. Preserve browser-needed readiness facts:
   - fixture workflow availability;
   - live availability;
   - missing live env variable names;
   - request/job limits.
3. Add regression coverage proving the health payload does not expose the local
   artifact root, current working directory, live token, or live endpoint URL.

## Acceptance Criteria

- `/api/health` no longer returns `artifactRoot`.
- Health still reports live availability and missing env variable names.
- Existing workbench startup may still log the artifact root to the local
  operator terminal.
- Tests prove browser-visible health does not leak local paths or live secrets.
- No secret env file is read, sourced, printed, or committed.

## Verification

```bash
npm test -- tests/workbench/workbench.test.ts tests/workbench/server.test.ts
npm run check
git diff --check
```

## Stop Conditions

- Stop before removing server-side artifact-root configuration needed by the
  workbench artifact store.
- Stop before hiding live-mode missing env names that the browser needs to
  explain disabled live actions.
- Stop before reading `.splunkready*`, `.env`, or other secret-bearing files.
