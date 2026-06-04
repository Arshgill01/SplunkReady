# Move 08 - Add Live Readiness And Proof Actions

## Goal

Let the workbench run live read-only checks from server-side environment
configuration, so the UI can show real Splunk MCP connectivity and flagship
security readiness without browser-entered secrets.

## Scope

Expected files:

- workflow modules for live smoke, live security readiness, live security proof
- workbench routes/jobs for live actions
- UI live view updates
- live adapter tests where payload behavior changes
- docs for server env setup, not submission copy
- logs

## Plan

1. Add server capability detection for live env vars.
2. Add disabled live UI state when env is absent.
3. Add backend jobs for:
   - live smoke;
   - live saved-search candidates;
   - live security readiness;
   - strict live security proof.
4. Use existing read-only adapter paths.
5. Redact endpoint and token-bearing errors.
6. Clearly show mutation false.
7. Keep fixture and live artifacts under separate run types.
8. Do not allow the browser to choose live host, token, app, or arbitrary query.

## Acceptance Criteria

- With no live env, the UI says live mode is unavailable and why.
- With live env, the UI can run smoke/readiness/proof jobs.
- Live proof artifacts are browsable like fixture artifacts.
- No Splunk write operation is introduced.

## Verification

```bash
npx vitest run tests/adapters/live.test.ts tests/adapters/live.integration.test.ts tests/workbench
npm run build
npm run check
git diff --check
```

Run live jobs manually only from an operator-owned environment.

## Stop Conditions

- Stop before browser credential forms.
- Stop before arbitrary SPL execution from the UI.
- Stop before any Splunk mutation.
