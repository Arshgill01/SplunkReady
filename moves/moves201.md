# Move 201 - Tagged Setup Action Release

## Status

Implemented on 2026-06-08. Source prep, `v0.1.7` tag publication, Release
Artifacts workflow, public macOS arm64 download smoke, GitHub Packages refresh,
and local/focused checks are complete. Awaiting final branch-tip CI after the
workflow pin update to `v0.1.7`.

## Objective

Close the Move 200 public-reference gap by shipping a new tagged release that
contains `setup-splunkready/action.yml`. The judge-facing setup-action snippet
should be able to use `Arshgill01/SplunkReady/setup-splunkready@v0.1.7` instead
of a moving branch ref.

## Expected touched files

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
- `docs/execplans/tagged-setup-action-release.md`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Verification

- `npm run audit:public-package-currentness -- --out submission-evidence/public-package-currentness`
- `npm run audit:submission-copy`
- `npx vitest run tests/examples/repository-ci-workflow.test.ts tests/ci/github-action.test.ts tests/scripts/submission-copy-audit.test.ts`
- evidence-pack SHA-256 regeneration and verification
- `git diff --check`
- `npm run check`
- Release Artifacts workflow for tag `v0.1.7`
- GitHub Packages workflow for `@arshgill01/splunkready@0.1.7`
- public `v0.1.7` standalone download smoke
- branch-tip CI

## Boundaries

- Do not force-move `v0.1.6`.
- Do not claim public npmjs `splunkready@0.1.7`.
- Do not mutate live Splunk.
