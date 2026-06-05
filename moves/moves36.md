# Move 36 - Local Artifact Base Guard

## Goal

Keep the Vite artifact UI on local artifact paths even when a query parameter or
artifact manifest supplies a URL-like artifact base.

## Scope

Expected files:

- `ui/src/artifacts.ts`
- `tests/ui/app.test.ts`
- `moves/README.md`
- logs

## Plan

1. Reject URL-scheme and protocol-relative artifact bases in
   `normalizeArtifactBase`.
2. Preserve existing local path behavior for managed workbench artifacts and
   checked-in artifact presets.
3. Add focused UI tests for the normalization helper and the browser location
   query-parameter entry point.

## Acceptance Criteria

- `artifacts/...`, `/api/artifacts/...`, and other local path bases keep working.
- `http:`, `https:`, `data:`, and `//host/...` bases fall back to
  `/__splunkready_artifacts/`.
- The UI does not attempt off-origin artifact fetches through
  `?artifacts=...`.
- No visible dashboard surface or submission/video workflow changes are added.

## Verification

```bash
npm test -- tests/ui/app.test.ts
npm run check
git diff --check
```

## Stop Conditions

- Stop before adding remote artifact loading support.
- Stop before changing workbench job execution or artifact-store filesystem
  behavior.
