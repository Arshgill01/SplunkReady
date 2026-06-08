# ExecPlan: Setup SplunkReady Standalone Action

Created: 2026-06-08

## Objective

Add a GitHub Action subpath that installs the public standalone SplunkReady
binary from GitHub Releases, verifies its checksum, adds it to `PATH`, and lets
CI callers run `splunkready` without setting up Node, npm, or a repository-local
build.

This complements the repository-root certification gate action. The root action
builds from source and runs certification modes; the setup action is the
zero-to-verdict installer for non-Node CI jobs.

## Success Criteria

- New `setup-splunkready/action.yml` composite action exists.
- The action maps supported GitHub runner platforms to public release targets:
  Linux x64, macOS arm64, and Windows x64.
- The action downloads `splunkready-<target>.tar.gz` and its `.sha256` file
  from the configured release tag.
- The action verifies the checksum before adding the binary directory to PATH.
- The repository CI has a separate smoke job that does not call
  `actions/setup-node` or `npm ci` and runs:
  `splunkready judge-proof --out "$RUNNER_TEMP/splunkready-setup-proof" --json`
- README, Devpost copy, and the evidence ledger document the setup action
  without claiming public npmjs `0.1.6`.

## Expected Touched Files

- `setup-splunkready/action.yml`
- `.github/workflows/ci.yml`
- `tests/examples/repository-ci-workflow.test.ts`
- `tests/ci/github-action.test.ts`
- `README.md`
- `docs/devpost-submission.md`
- `submission-evidence/README.md`
- `submission-evidence/claim-ledger.md`
- `submission-evidence/setup-splunkready-action/setup-splunkready-action.json`
- `submission-evidence/evidence-pack-sha256.txt`
- `scripts/audit-submission-copy.mjs`
- `tests/scripts/submission-copy-audit.test.ts`
- `moves/moves200.md`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Verification Plan

- `npm run audit:submission-copy`
- `npx vitest run tests/examples/repository-ci-workflow.test.ts tests/ci/github-action.test.ts tests/scripts/submission-copy-audit.test.ts`
- evidence-pack SHA-256 regeneration and verification
- `git diff --check`
- `npm run check`
- Push and verify remote CI includes the setup action smoke job.

## Boundaries

- Do not replace the root SplunkReady gate action.
- Do not claim Homebrew support.
- Do not claim public npmjs `splunkready@0.1.6`.
- Do not require Splunk credentials or mutate Splunk.

## Current Status

Implemented and locally verified. Remote CI verification is pending until the
Move 200 commit is pushed.
