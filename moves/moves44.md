# Move 44: Runs Trace Preview Ordering

## Status

Implemented.

## Problem

The Runs trace preview could look scrambled when trace artifacts were not already
stored in display order. That made call/result/final-answer timelines hard to
trust and weakened the Readiness Receipt evidence story in the workbench.

## Scope

- Sort trace preview events deterministically before rendering.
- Prefer direct parent before child, then explicit `step`, then timestamp, event
  type, and original input order.
- Show phase-local sequence numbers instead of raw trace step values.
- Show timestamps and parent references in each preview row.
- Keep long metadata and findings from forcing horizontal overflow.
- Add UI regression coverage using intentionally scrambled trace input.

## Boundaries

- UI-only presentation change.
- No grading, receipt, or trace schema changes.
- No new dependency.
- No Splunk mutation.
- No secret env file read.

## Verification

- `npm test -- tests/ui/app.test.ts -t "proof bundle browser"`
- `npm run build`
- `npm run ui:build`
- Playwright against local workbench:
  - desktop snapshot and screenshots;
  - trace preview element screenshot;
  - mobile snapshot and screenshot.
- `npm run check`
- `git diff --check`
