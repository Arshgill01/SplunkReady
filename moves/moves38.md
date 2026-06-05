# Move 38 - Isolated Workbench Job Snapshots

## Goal

Keep workbench job state encapsulated inside `WorkbenchJobRunner` by returning
isolated snapshots from public read APIs.

## Scope

Expected files:

- `src/workbench/jobs.ts`
- `tests/workbench/workbench.test.ts`
- `moves/README.md`
- logs

## Plan

1. Make `listJobs()` return snapshots instead of internal job objects.
2. Make `getJob()` return a snapshot instead of the internal job object.
3. Preserve the existing asynchronous job execution path.
4. Add focused regression coverage proving caller-side mutation does not corrupt
   stored job state.

## Acceptance Criteria

- `createJob()`, `listJobs()`, and `getJob()` expose consistent snapshot
  behavior.
- Mutating a returned job, artifact list, or event list does not change the
  runner's stored job.
- Existing API routes and tests continue to work without behavior changes.
- No UI, live-mode, Splunk mutation, or submission/video workflow changes are
  introduced.

## Verification

```bash
npm test -- tests/workbench/workbench.test.ts
npm run check
git diff --check
```

## Stop Conditions

- Stop before changing job persistence, cancellation, or retention policy.
- Stop before introducing deep-freezing or a dependency.
