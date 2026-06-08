# Move 199 - Public Standalone Download Smoke

## Status

Implemented on 2026-06-08.

## Objective

Prove the public `v0.1.6` macOS arm64 standalone archive from GitHub Releases is
usable from a clean temp folder without Node/npm/npx by downloading it, verifying
its checksum, extracting it, and running `judge-proof`.

## Expected touched files

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

## Verification

- public release asset download
- `shasum -a 256 -c splunkready-macos-arm64.tar.gz.sha256`
- `./splunkready judge-proof --out ./judge-proof --json`
- `npm run audit:submission-copy`
- `npx vitest run tests/scripts/submission-copy-audit.test.ts`
- evidence-pack SHA-256 regeneration and verification
- `git diff --check`
- `npm run check`

## Boundaries

- Do not claim Homebrew support.
- Do not claim npmjs `splunkready@0.1.6` is public.
- Do not mutate live Splunk.

## Result

- Public GitHub Release archive downloaded from
  `https://github.com/Arshgill01/SplunkReady/releases/download/v0.1.6/splunkready-macos-arm64.tar.gz`.
- Published SHA-256 checksum verified with `shasum -a 256 -c`.
- Extracted standalone binary ran
  `./splunkready judge-proof --out ./judge-proof --json`.
- Evidence reports `PASS`, 67 generated artifacts, and `mutation: false`.
