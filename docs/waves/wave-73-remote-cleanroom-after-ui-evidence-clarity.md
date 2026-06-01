# Wave 73 - Remote Cleanroom After UI Evidence Clarity

## Goal

Verify the pushed `splunkready-build` branch from a fresh remote clone after the Wave 72 UI evidence-clarity patch.

## Scope

- Clone the pushed `splunkready-build` branch into a temporary cleanroom.
- Confirm the cleanroom resolves to the expected Wave 72 commit.
- Install dependencies without requiring live Splunk credentials.
- Run remote reviewer audit and full project check.
- Run a targeted UI shell test in the cleanroom to prove the evidence-clarity UI tests are present remotely.
- Confirm no tracked sidecar artifacts were pushed.
- Do not mutate Splunk.
- Do not call `update_goal`.

## Files Owned

- `docs/remote-cleanroom-after-ui-evidence-clarity-report.md`
- `docs/waves/README.md`
- `docs/waves/wave-73-remote-cleanroom-after-ui-evidence-clarity.md`
- `MANIFEST.md`
- `PLAN.md`
- `docs/implementation-handoff.md`
- `logs/execution-log.md`
- `logs/verification-log.md`
- relevant `logs/reviewer-inbox/wave-73-*` files if reviewer findings arrive

## Acceptance Criteria

- Remote clone checks out the expected Wave 72 commit.
- Remote dependency install passes.
- Remote `npm run audit:reviewers` passes.
- Remote `npm run check` passes.
- Remote targeted UI shell test passes with the Wave 72 evidence-clarity coverage.
- Tracked `.antigravitycli`, `.playwright-cli`, or `artifacts` paths are absent.
- Goal remains open pending explicit user approval.

## Verification

- Remote cleanroom command that clones, installs, audits reviewers, runs checks, runs the UI test, and scans tracked artifacts.
- Local `npm run audit:reviewers`
- Local `bash scripts/verify-scaffold.sh && git diff --check`

## Reviewer Checklist

- Does the cleanroom verify the pushed branch rather than local-only files?
- Does it target the Wave 72 UI evidence-clarity behavior?
- Does it avoid live Splunk credentials?
- Are sidecar artifacts absent from tracked files?
- Does the wave avoid claiming final completion?

## Stop Conditions

- Remote clone does not match the expected commit.
- Remote verification requires live Splunk credentials.
- Remote tests fail.
- Sidecar artifacts are tracked in the pushed branch.
