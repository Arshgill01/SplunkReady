# Wave 52 - Remote Cleanroom After Audit

## Goal

Verify the latest pushed `splunkready-build` branch from a fresh remote clone after the completion-audit and handoff documentation updates.

## Scope

- Clone `origin/splunkready-build` into a temporary directory.
- Install dependencies without lifecycle scripts.
- Run core checks, submission-copy audit, reviewer audit, build, and fixture demo from the clone.
- Record exact commit and artifact evidence.

## Files Owned

- remote cleanroom after-audit report.
- wave index docs.
- execution and verification logs.
- reviewer inbox files if new findings arrive.

## Acceptance Criteria

- Fresh clone checks out the latest pushed Wave 51 commit.
- Fixture checks and demo require no live Splunk credentials.
- Demo produces fail -> patch -> rerun -> pass artifacts.
- Reviewer audit passes from the clean clone.

## Verification

- remote clone command from `origin/splunkready-build`
- `npm ci --ignore-scripts`
- `npm run check`
- `npm run audit:submission-copy`
- `npm run audit:reviewers`
- fixture demo command with live Splunk env vars unset

## Reviewer Checklist

- Does the cleanroom test use the pushed branch, not local dirty state?
- Does it verify the completion-audit documentation changes are present remotely?
- Does fixture mode remain credential-free?

## Stop Conditions

- Remote clone does not contain the latest intended commit.
- Fixture demo requires live Splunk credentials.
