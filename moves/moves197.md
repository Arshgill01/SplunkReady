# Move 197 - Refresh GitHub Packages Mirror

## Status

Completed on 2026-06-08.

## Objective

Publish and verify the repo-linked GitHub Packages npm mirror for the current
`0.1.6` source release while keeping the unauthenticated npmjs install path
honestly pinned to `splunkready@0.1.5` until npm OTP publish succeeds.

## Expected touched files

- `moves/moves197.md`
- `README.md`
- `submission-evidence/github-package-currentness/github-package-currentness.json`
- `submission-evidence/claim-ledger.md`
- `submission-evidence/README.md`
- `submission-evidence/evidence-pack-sha256.txt`
- `scripts/audit-submission-copy.mjs`
- `tests/scripts/submission-copy-audit.test.ts`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Verification

- `gh workflow run github-packages.yml --ref splunkready-build`
- `gh run watch 27149553852 --exit-status`
- `gh run view 27149553852 --json status,conclusion,headSha,url,jobs`
- `gh run view 27149553852 --log`
- `npm run audit:submission-copy`
- focused submission-copy test
- evidence-pack SHA-256 regeneration and verification
- `git diff --check`
- `npm run check`

## Boundaries

- Do not claim npmjs `splunkready@0.1.6` is public.
- Do not change the unauthenticated judge command away from
  `npx -y splunkready@0.1.5 judge-proof --out ./judge-proof --json`.
- GitHub Packages installs require package-registry authentication and are a
  repo package/sidebar mirror, not the primary no-auth judge path.

## Result

- GitHub Packages workflow run `27149553852` succeeded.
- Workflow log shows `+ @arshgill01/splunkready@0.1.6`.
- Workflow verification ran `npm view` against GitHub Packages and returned
  package name `@arshgill01/splunkready`, version `0.1.6`, repository URL, and
  `splunkready` bin.
- `npm run check` passed locally after the evidence refresh: 76 Vitest files /
  441 tests plus the full audit chain.
- Public npm remains `splunkready@0.1.5` and stays the unauthenticated judge
  install path until npm OTP-backed publish succeeds.
