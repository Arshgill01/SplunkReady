# Wave 70 - Remote Cleanroom After UI Semantic Patch

## Goal

Verify the pushed `splunkready-build` branch from a fresh remote clone after the Wave 69 UI semantic patch.

## Scope

- Clone the pushed `splunkready-build` branch into a temporary cleanroom.
- Confirm the cleanroom resolves to the expected Wave 69 commit.
- Install dependencies without requiring live Splunk credentials.
- Run remote reviewer audit and full project check.
- Run a targeted UI shell test in the cleanroom to prove the before-phase receipt semantics are present remotely.
- Confirm no tracked sidecar artifacts were pushed.
- Do not mutate Splunk.
- Do not call `update_goal`.

## Files Owned

- remote cleanroom report.
- wave index docs.
- current-state handoff docs.
- execution and verification logs.
- reviewer inbox files if new findings arrive.

## Acceptance Criteria

- Remote clone checks out the expected Wave 69 commit.
- Remote dependency install passes.
- Remote `npm run audit:reviewers` passes.
- Remote `npm run check` passes.
- Remote targeted UI shell test passes.
- Tracked `.antigravitycli`, `.playwright-cli`, or `artifacts` paths are absent.
- Goal remains open pending explicit user approval.

## Verification

- Remote cleanroom command that clones, installs, audits reviewers, runs checks, runs the UI test, and scans tracked artifacts.
- Local `npm run audit:reviewers`
- Local `bash scripts/verify-scaffold.sh && git diff --check`

## Reviewer Checklist

- Does the cleanroom verify the pushed branch rather than local-only files?
- Does it target the Wave 69 UI semantics?
- Does it avoid live Splunk credentials?
- Are sidecar artifacts absent from tracked files?
- Does the wave avoid claiming final completion?

## Stop Conditions

- Remote clone does not match the expected commit.
- Remote verification requires live Splunk credentials.
- Remote tests fail.
- Sidecar artifacts are tracked in the pushed branch.
