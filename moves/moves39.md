# Move 39 - Atomic Workbench Job Limit

## Goal

Make the workbench job concurrency limit apply while a new job is still
allocating its managed artifact run directory.

## Scope

Expected files:

- `src/workbench/jobs.ts`
- `tests/workbench/workbench.test.ts`
- `moves/README.md`
- logs

## Plan

1. Reserve a pending job-start slot before awaiting run-directory allocation.
2. Include pending starts in the active job limit check.
3. Release the pending slot after allocation succeeds or fails.
4. Add a focused race regression for two concurrent `createJob()` calls when
   `maxConcurrentJobs` is `1`.

## Acceptance Criteria

- A second concurrent job start is rejected while the first job is allocating
  its run directory.
- Failed allocation does not permanently consume a job slot.
- Existing queued/running/succeeded job behavior remains unchanged.
- No UI, live-mode, Splunk mutation, or submission/video workflow changes are
  introduced.

## Verification

```bash
npm test -- tests/workbench/workbench.test.ts
npm run check
git diff --check
```

## Stop Conditions

- Stop before adding a persistent queue or changing job retention behavior.
- Stop before introducing cancellation semantics.
