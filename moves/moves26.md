# Move 26 - Remote Clean-Room Gate And Cleanup Backlog

## Goal

Verify that the pushed `splunkready-build` branch works from a fresh remote
clone, then record the remaining cleanup and efficiency work without removing
testing/debug affordances before the final submission pass.

## Scope

Expected files:

- move index
- clean-room report or submission-gate docs if remote evidence changes
- logs

## Plan

1. Confirm `origin/splunkready-build` resolves to the latest local commit.
2. Clone the pushed branch into a fresh temporary directory.
3. Run the canonical gate from the clone.
4. Record exact commit, clone path, and command results.
5. Keep current testing/debug UI affordances in place.
6. Add any final cleanup backlog items discovered during verification.

## Acceptance Criteria

- The remote branch contains the latest committed move.
- A fresh clone can install dependencies and pass the canonical gate.
- Public-remote proof is no longer blocked only by unpushed local commits.
- Cleanup work is explicit and deferred until after final evidence capture.
- No secrets or `.splunkready*` env files are read, printed, or committed.

## Verification

```bash
git ls-remote origin splunkready-build
npm ci
npm run check
git diff --check
```

Run the clean-room commands inside the fresh clone, then rerun local whitespace
validation after updating logs.

## Stop Conditions

- Stop before reading or sourcing secret env files.
- Stop before deleting testing/debug UI that is still needed for final video or
  submission proof capture.
- Stop before changing product scope or any Splunk mutation boundary.
