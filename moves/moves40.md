# Move 40 - Artifact Symlink Read Guard

## Goal

Prevent the local workbench artifact API from following symlinks when reading
managed run artifacts.

## Scope

Expected files:

- `src/workbench/artifacts.ts`
- `tests/workbench/workbench.test.ts`
- `moves/README.md`
- logs

## Plan

1. Use path-local file metadata for artifact reads so symlinks are not treated
   as regular files.
2. Preserve existing path traversal checks and regular-file behavior.
3. Add a focused regression with a symlink inside a managed run pointing outside
   the run.

## Acceptance Criteria

- Regular artifact files remain readable.
- Symlinked artifact paths return `undefined` and are not served.
- Symlinks remain absent from `listRunFiles()`.
- No UI, live-mode, Splunk mutation, or submission/video workflow changes are
  introduced.

## Verification

```bash
npm test -- tests/workbench/workbench.test.ts
npm run check
git diff --check
```

## Stop Conditions

- Stop before following or resolving symlink targets.
- Stop before changing artifact root configuration behavior.
