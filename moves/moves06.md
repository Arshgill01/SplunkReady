# Move 06 - Add Job Runner And Artifact Store

## Goal

Make backend executions observable, cancellable, and safe through a job runner
and server-owned artifact store.

## Scope

Expected files:

- `src/workbench/jobs.ts`
- `src/workbench/artifacts.ts`
- `src/workbench/events.ts`
- tests for job lifecycle and artifact path containment
- UI API client types if shared locally
- logs

## Plan

1. Define job states: queued, running, succeeded, failed, cancelled.
2. Define event types: phase, artifact, warning, error, complete.
3. Allocate run directories server-side using stable run IDs.
4. Enforce path containment for all artifact reads and writes.
5. Keep a lightweight in-memory job index for current-session runs.
6. Add endpoints:
   - `POST /api/jobs/:workflow`
   - `GET /api/jobs/:id`
   - `GET /api/jobs/:id/events`
   - `GET /api/artifacts`
   - `GET /api/artifacts/:runId/:file`
7. Use SSE for events if it stays simple; otherwise poll job state. Do not
   stream raw CLI stdout.
8. Redact errors before storing or returning them.

## Acceptance Criteria

- Jobs produce structured progress the UI can render.
- Failed jobs preserve diagnostics without corrupting previous runs.
- Artifact reads cannot escape the managed root.
- Multiple runs can coexist and be browsed.

## Verification

```bash
npx vitest run tests/workbench
npm run build
npm run check
git diff --check
```

Add manual browser verification for a running, successful, and failed job.

## Stop Conditions

- Stop before exposing raw stdout containing secrets.
- Stop before accepting output paths from the browser.
- Stop if concurrency can interleave artifacts from different runs.
