# Move 190 - Restore Public Package Currentness After Recorder Fix

## Status

Blocked on npm OTP on 2026-06-08.

## Objective

Publish the Move 189 recorder-gateway fix as a current public package so the
no-clone judge path, npm package, GitHub Packages mirror, and release evidence
all point at the same source commit again.

## Expected touched files

- `moves/moves190.md`
- `package.json`
- `package-lock.json`
- `README.md`
- `docs/devpost-submission.md`
- `scripts/audit-submission-copy.mjs`
- `tests/scripts/submission-copy-audit.test.ts`
- `submission-evidence/claim-ledger.md`
- `submission-evidence/README.md`
- `submission-evidence/public-package-currentness/public-package-currentness.json`
- `submission-evidence/github-package-currentness/github-package-currentness.json`
- `submission-evidence/standalone-release/standalone-release-github-release.json`
- `submission-evidence/evidence-pack-sha256.txt`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Verification

- `npm version 0.1.6 --no-git-tag-version`
- `npm run audit:package-readiness`
- `npm run audit:package-installability`
- `npm run audit:npm-release-preflight -- --require-ready`
- `npm publish --access public`
- `npm publish --access public --otp=<code>`
- `npm view splunkready version dist-tags.latest gitHead --json`
- `npm run audit:public-package-currentness -- --require-current --out submission-evidence/public-package-currentness`
- `gh workflow run github-packages.yml --ref splunkready-build`
- `gh run watch <github-packages-run-id> --exit-status`
- `gh release view v0.1.6 --json tagName,name,url,isDraft,isPrerelease,publishedAt,assets`
- `npm run audit:submission-copy`
- evidence-pack SHA-256 regeneration and verification
- `npm run check`

## Boundaries

- Do not publish until package readiness, installability, and release preflight
  pass locally.
- Do not claim GitHub Packages or release assets are current until their
  workflows complete successfully.
- Do not mutate live Splunk.

## Result

Local release preparation passed:

- Source package version is `0.1.6`.
- `npm run audit:package-readiness` passed.
- `npm run audit:package-installability` passed for
  `splunkready-0.1.6.tgz`, including clean tarball `judge-proof` and MCP
  initialization.
- `npm run audit:npm-release-preflight -- --require-ready` reported
  `status: "READY"`, authenticated npm user `brightybrainiac`, and version
  `0.1.6` available.

Publish is blocked by npm two-factor authentication:

- `npm publish --access public` failed with `EOTP`.
- npm latest remains `splunkready@0.1.5`.
- Public README, Devpost, claim-ledger, and submission-copy guardrails continue
  to cite `0.1.5` until `0.1.6` is actually published and verified.

Next action once the operator provides the current npm OTP:

```bash
npm publish --access public --otp=<code>
```
