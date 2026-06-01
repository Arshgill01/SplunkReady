# Wave 76 - Remote Cleanroom After UI Deterministic Checks

## Goal

Verify the pushed `splunkready-build` branch after the Wave 75 deterministic-check UI patch from a fresh remote clone.

## Scope

- Clone `origin/splunkready-build` into a clean temporary directory.
- Confirm the cleanroom checkout matches the expected Wave 75 commit.
- Run fresh install, reviewer audit, full project check, focused UI shell test, and tracked sidecar artifact scan.
- Update cleanroom report, current-state docs, wave index, and logs.
- Do not change implementation behavior.

## Files Owned

- `docs/remote-cleanroom-after-ui-deterministic-checks-report.md`
- `docs/waves/README.md`
- `docs/waves/wave-76-remote-cleanroom-after-ui-deterministic-checks.md`
- `MANIFEST.md`
- `PLAN.md`
- `docs/implementation-handoff.md`
- `logs/execution-log.md`
- `logs/verification-log.md`
- reviewer inbox files if new Wave 76 findings arrive.

## Acceptance Criteria

- Remote clone checks out the expected pushed Wave 75 commit.
- `npm ci --ignore-scripts` completes in the remote clone.
- Remote `npm run audit:reviewers` passes.
- Remote `npm run check` passes.
- Remote `npx vitest run tests/ui/shell.test.ts` passes.
- Tracked sidecar artifact scan reports no `.antigravitycli/`, `.playwright-cli/`, or generated artifact directories.

## Verification

- remote cleanroom command captured in `docs/remote-cleanroom-after-ui-deterministic-checks-report.md`.
- `npm run audit:reviewers`
- `bash scripts/verify-scaffold.sh && git diff --check`

## Reviewer Checklist

- Does the report cite the actual remote commit and match it to the expected pushed branch head?
- Did the remote clone run install, reviewer audit, full tests, focused UI tests, and sidecar artifact scan?
- Are npm audit warnings documented without mutating dependencies?
- Does the wave avoid changing implementation behavior?

## Stop Conditions

- Remote checkout does not match the expected commit.
- Remote cleanroom verification fails.
- The wave tracks sidecar runtime artifacts.
- The wave changes implementation behavior.
