# ExecPlan: Tagged Setup Action Release

Created: 2026-06-08

## Objective

Ship a tagged public release that contains the `setup-splunkready` GitHub
Action subpath, so judge-facing CI snippets can use a stable release tag instead
of `splunkready-build`.

Move 200 proved the action works, but `v0.1.6` predates
`setup-splunkready/action.yml`. Move 201 closes that public-reference gap with
`v0.1.7`.

## Success Criteria

- Source package metadata is bumped to `0.1.7`.
- `setup-splunkready/action.yml` defaults to release tag `v0.1.7`.
- README, Devpost copy, claim ledger, and evidence refer to
  `Arshgill01/SplunkReady/setup-splunkready@v0.1.7`.
- Public GitHub Release `v0.1.7` exists, is not draft/prerelease, and publishes
  Linux, macOS, and Windows standalone archives with checksums and manifests.
- Public macOS arm64 `v0.1.7` archive downloads, verifies checksum, extracts,
  and runs `judge-proof` without Node/npm/npx.
- GitHub Packages mirror is refreshed to `@arshgill01/splunkready@0.1.7`.
- Public npmjs remains honestly marked stale until operator OTP publish
  succeeds.

## Expected Touched Files

- `package.json`
- `package-lock.json`
- `setup-splunkready/action.yml`
- `README.md`
- `docs/devpost-submission.md`
- `submission-evidence/README.md`
- `submission-evidence/claim-ledger.md`
- `submission-evidence/setup-splunkready-action/setup-splunkready-action.json`
- `submission-evidence/standalone-release/standalone-release-github-release.json`
- `submission-evidence/standalone-release/standalone-release-public-download-smoke.json`
- `submission-evidence/github-package-currentness/github-package-currentness.json`
- `submission-evidence/public-package-currentness/public-package-currentness.json`
- `submission-evidence/evidence-pack-sha256.txt`
- `scripts/audit-submission-copy.mjs`
- `tests/ci/github-action.test.ts`
- `tests/examples/repository-ci-workflow.test.ts`
- `tests/scripts/submission-copy-audit.test.ts`
- `moves/moves201.md`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Verification Plan

- `npm run audit:public-package-currentness -- --out submission-evidence/public-package-currentness`
- `npm run audit:submission-copy`
- `npx vitest run tests/examples/repository-ci-workflow.test.ts tests/ci/github-action.test.ts tests/scripts/submission-copy-audit.test.ts`
- evidence-pack SHA-256 regeneration and verification
- `git diff --check`
- `npm run check`
- Push branch and tag `v0.1.7`.
- Verify Release Artifacts workflow for `v0.1.7`.
- Verify GitHub Packages workflow publishes `@arshgill01/splunkready@0.1.7`.
- Public-download smoke for `v0.1.7` macOS arm64 archive.
- Final branch-tip CI verification.

## Boundaries

- Do not force-move or rewrite `v0.1.6`.
- Do not claim public npmjs `splunkready@0.1.7` until npm OTP publish succeeds.
- Do not claim Homebrew support.
- Do not mutate live Splunk.

## Current Status

Implemented locally. Source metadata, docs, tests, setup-action defaults,
current-OS standalone release evidence, public npm currentness evidence, and
submission-copy guardrails are updated for `0.1.7`.

Release-order boundary: `.github/workflows/ci.yml` remains pinned to standalone
binary `v0.1.6` for the first source push so branch CI does not try to download
`v0.1.7` assets before the tag workflow has published them. After the
`v0.1.7` release assets exist, update branch CI and the repository workflow
test to use `v0.1.7`.
