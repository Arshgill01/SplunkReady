# Wave 79 - Remote Cleanroom After Demo Route

## Goal

Verify the pushed `splunkready-build` branch from a fresh remote clone after Wave 78 changed the primary fixture demo route to the certification replay.

## Scope

- Clone `origin/splunkready-build` into a clean temp directory.
- Confirm the clone resolves to the pushed Wave 78 commit.
- Run install, reviewer audit, full project check, and fixture demo route inspection in the clone.
- Confirm generated demo metadata points at `#certification-replay` and the shell still contains both replay and rerun receipt anchors.
- Confirm tracked sidecar/browser artifacts are absent from the remote clone.

## Files Owned

- `docs/remote-cleanroom-after-demo-route-report.md`
- `docs/waves/README.md`
- `docs/waves/wave-79-remote-cleanroom-after-demo-route.md`
- `MANIFEST.md`
- `PLAN.md`
- `docs/implementation-handoff.md`
- `logs/execution-log.md`
- `logs/verification-log.md`
- reviewer inbox files if new Wave 79 findings arrive.

## Acceptance Criteria

- Remote clone checks out the expected pushed Wave 78 commit.
- Remote `npm ci --ignore-scripts` succeeds.
- Remote `npm run audit:reviewers` succeeds.
- Remote `npm run check` succeeds.
- Remote fixture demo inspection reports a `#certification-replay` `uiRoute`, replay anchor present, rerun receipt anchor present, and 18 expected artifacts.
- Remote tracked artifact scan reports no `.antigravitycli`, `.playwright-cli`, or `artifacts/` entries.

## Verification

- Remote cleanroom command captured in `docs/remote-cleanroom-after-demo-route-report.md`
- Local `npm run audit:reviewers`
- Local `bash scripts/verify-scaffold.sh && git diff --check`

## Reviewer Checklist

- Does the cleanroom clone prove the pushed branch, not local state?
- Does the demo route inspection directly check the certification replay route?
- Are no live Splunk credentials required?
- Are sidecar/browser artifacts absent from tracked files?

## Stop Conditions

- The cleanroom needs local uncommitted files.
- The cleanroom needs live Splunk credentials.
- The demo route points back to the old rerun receipt route.
- Tracked sidecar artifacts are present.
