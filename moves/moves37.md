# Move 37 - Workbench Cross-Site API Guard

## Goal

Reject browser-marked cross-site requests before they can call the local
workbench API or start server-owned workflows.

## Scope

Expected files:

- `src/workbench/routes.ts`
- `tests/workbench/workbench.test.ts`
- `moves/README.md`
- logs

## Plan

1. Keep the existing localhost `Origin` guard.
2. Add a conservative `Sec-Fetch-Site` guard that rejects `cross-site`
   browser requests.
3. Preserve local CLI/test clients that do not send fetch metadata.
4. Add focused backend tests for rejected cross-site metadata and allowed
   same-origin metadata.

## Acceptance Criteria

- Requests with non-local `Origin` remain rejected.
- Requests with `Sec-Fetch-Site: cross-site` are rejected with
  `WORKBENCH_ORIGIN_FORBIDDEN`.
- Same-origin browser requests and non-browser local clients remain allowed.
- No workflow allowlist, live-mode, Splunk mutation, or UI behavior changes are
  introduced.

## Verification

```bash
npm test -- tests/workbench/workbench.test.ts
npm run check
git diff --check
```

## Stop Conditions

- Stop before requiring auth or adding a dependency.
- Stop before blocking local non-browser clients that omit fetch metadata.
