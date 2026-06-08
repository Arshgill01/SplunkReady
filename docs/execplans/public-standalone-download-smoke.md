# ExecPlan: Public Standalone Download Smoke

Created: 2026-06-08

## Objective

Prove that the public `v0.1.6` GitHub Release standalone asset can be downloaded
from GitHub, checksum-verified, extracted into a clean temp folder, and used to
run `judge-proof` without npm, `npx`, a repo checkout, Splunk credentials, or
live mutation.

This is distinct from the Release Artifacts workflow smoke. The workflow proves
archives before upload; this move proves the public download URL that a judge
would use.

## Success Criteria

- Download `splunkready-macos-arm64.tar.gz` and its `.sha256` file from
  `https://github.com/Arshgill01/SplunkReady/releases/tag/v0.1.6`.
- Verify the archive checksum with `shasum -a 256 -c`.
- Extract the archive in a clean temp directory outside the repo.
- Run `./splunkready judge-proof --out ./judge-proof --json`.
- Confirm stdout reports `status: "PASS"`, command `judge-proof`, generated
  proof artifacts, and `mutation: false`.
- Track a public-safe evidence JSON under `submission-evidence/standalone-release/`.
- Update README/Devpost/claim-ledger with the public-download command without
  changing npmjs `splunkready@0.1.5` currentness claims.

## Expected Touched Files

- `docs/execplans/public-standalone-download-smoke.md`
- `moves/moves199.md`
- `README.md`
- `docs/devpost-submission.md`
- `submission-evidence/README.md`
- `submission-evidence/claim-ledger.md`
- `submission-evidence/standalone-release/standalone-release-public-download-smoke.json`
- `submission-evidence/evidence-pack-sha256.txt`
- `scripts/audit-submission-copy.mjs`
- `tests/scripts/submission-copy-audit.test.ts`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Verification Plan

- public `curl` download of archive and checksum
- `shasum -a 256 -c splunkready-macos-arm64.tar.gz.sha256`
- `./splunkready judge-proof --out ./judge-proof --json`
- `npm run audit:submission-copy`
- `npx vitest run tests/scripts/submission-copy-audit.test.ts`
- evidence-pack SHA-256 regeneration and verification
- `git diff --check`
- `npm run check`

## Boundaries

- Do not claim all public release assets have been downloaded locally; this
  move verifies the current operator platform asset.
- Do not claim Homebrew support.
- Do not claim public npmjs `splunkready@0.1.6`.
- Do not mutate Splunk or require live credentials.

## Current Status

Implemented. Public download, checksum verification, extraction, and
`./splunkready judge-proof --out ./judge-proof --json` passed from
`/tmp/splunkready-public-standalone-smoke-D4pKLS`.
