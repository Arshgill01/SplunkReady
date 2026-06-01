# Wave 65 - Remote Cleanroom After 1830 Sidecar Triage

## Goal

Verify the pushed `splunkready-build` branch after Wave 64 from a fresh remote clone, with emphasis on proving the fresh Antigravity 1830 sidecar artifacts did not enter the tracked project.

## Scope

- Clone `origin/splunkready-build` into a temporary cleanroom directory.
- Verify the clone resolves to the expected Wave 64 commit.
- Run fresh install, reviewer audit, and full project check.
- Confirm tracked files do not include `.antigravitycli/`, `.playwright-cli/`, or `artifacts/` sidecar outputs.
- Do not change implementation behavior.

## Files Owned

- remote cleanroom report.
- wave index docs.
- current-state handoff docs.
- execution and verification logs.
- reviewer inbox files if new findings arrive.

## Acceptance Criteria

- Remote clone checks out the pushed Wave 64 commit.
- `npm ci --ignore-scripts` passes.
- `npm run audit:reviewers` passes.
- `npm run check` passes.
- Sidecar artifact directory scan returns absent for tracked files.
- Goal remains open pending explicit user approval.

## Verification

- remote cleanroom command recorded in the report.
- `npm run audit:reviewers`
- `bash scripts/verify-scaffold.sh && git diff --check`

## Reviewer Checklist

- Does the report prove the remote branch, not just the local worktree, was tested?
- Does the sidecar artifact scan cover the known generated sidecar directories?
- Are verification results recorded exactly?
- Does the wave avoid claiming final completion?

## Stop Conditions

- Remote clone checks out a different commit than expected.
- Sidecar artifacts are tracked on the pushed branch.
- Fresh install, reviewer audit, or full check fails.
