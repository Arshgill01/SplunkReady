# Move 200 - Setup SplunkReady Standalone Action

## Status

Implemented and locally verified on 2026-06-08. Remote CI verification is
pending until the Move 200 commit is pushed.

## Objective

Ship a `setup-splunkready` GitHub Action subpath that downloads the public
standalone binary from GitHub Releases, verifies its checksum, adds it to PATH,
and proves a non-Node CI job can run `splunkready judge-proof`.

## Expected touched files

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
- `docs/execplans/setup-splunkready-action.md`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Verification

- `npm run audit:submission-copy`
- `npx vitest run tests/examples/repository-ci-workflow.test.ts tests/ci/github-action.test.ts tests/scripts/submission-copy-audit.test.ts`
- evidence-pack SHA-256 regeneration and verification
- `git diff --check`
- `npm run check`
- remote CI run including the setup action smoke job

## Boundaries

- Do not claim Homebrew support.
- Do not claim npmjs `splunkready@0.1.6` is public.
- Do not mutate live Splunk.

## Result

- Added `setup-splunkready/action.yml` as a checksum-verified standalone
  installer for GitHub Actions jobs.
- Added CI job `setup-splunkready action smoke` that does not use
  `actions/setup-node` or `npm ci` in the consumer job.
- The smoke job installs the public `v0.1.6` standalone release asset and runs
  `splunkready judge-proof`.
- Public copy uses `splunkready-build` as the action ref because tag `v0.1.6`
  predates the setup action path; `v0.1.6` is only the downloaded binary asset
  tag for this move.
