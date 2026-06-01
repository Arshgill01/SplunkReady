# Wave 46 - Remote Cleanroom QA

## Goal

Verify the pushed GitHub branch from a clean working directory and catch judge-facing regressions that local state could hide.

## Scope

- Clone or fetch the pushed `splunkready-build` branch into a fresh temp directory.
- Run dependency install from the lockfile.
- Run the project check command.
- Run the fixture demo from the judge instructions.
- Audit generated artifacts and reviewer inbox state.

## Files Owned

- cleanroom QA report.
- execution and verification logs.
- reviewer inbox files if new findings arrive.
- wave index docs if needed.

## Acceptance Criteria

- Remote branch checkout can install dependencies, build, run checks, and run the fixture demo.
- Demo receipts still show fail -> patch -> rerun -> pass.
- No live Splunk credentials are required.
- No generated artifacts are committed.
- Reviewer Critical and High findings are resolved or explicitly waived.

## Verification

- remote cleanroom checkout command.
- `npm ci --ignore-scripts`
- `npm run check`
- `npm run build`
- fixture demo command and artifact inspection.
- reviewer inbox audit.

## Reviewer Checklist

- Is this actually testing the pushed branch rather than local uncommitted state?
- Would a judge following the README hit any missing dependency, stale build, or hidden local artifact?

## Stop Conditions

- The remote branch does not reproduce the local judge demo.
