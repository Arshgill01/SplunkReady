# Move 187 - Version-Aligned Public Distribution

## Status

Implemented on 2026-06-08.

## Objective

Align every public distribution surface after the `0.1.4` npm recorder release:
the unauthenticated npm package, repo-linked GitHub Packages mirror, and
no-Node GitHub Release assets should all point at the same current package-input
commit and version.

## Expected touched files

- `moves/moves187.md`
- `package.json`
- `package-lock.json`
- `README.md`
- `docs/devpost-submission.md`
- `scripts/audit-submission-copy.mjs`
- `tests/scripts/submission-copy-audit.test.ts`
- `submission-evidence/github-package-currentness/github-package-currentness.json`
- `submission-evidence/standalone-release/standalone-release-github-release.json`
- `submission-evidence/claim-ledger.md`
- `submission-evidence/README.md`
- `submission-evidence/evidence-pack-sha256.txt`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Plan

1. Bump source package version and distribution copy to `0.1.5`.
2. Run local build/package/audit preflight.
3. Commit the package-input release state.
4. Publish `splunkready@0.1.5` to npm.
5. Push branch and tag `v0.1.5`; wait for GitHub Release assets.
6. Run GitHub Packages workflow for `@arshgill01/splunkready@0.1.5`.
7. Refresh evidence, claim ledger, and submission-copy guards.

## Verification

- `npm run build`
- `npm run audit:package-readiness`
- `npm run audit:package-installability`
- `npm run audit:npm-release-preflight -- --require-ready`
- `npm publish --access public`
- `npm run audit:public-package-currentness -- --require-current --out submission-evidence/public-package-currentness`
- `gh run watch <github-packages-run> --exit-status`
- `gh run watch <release-artifacts-run> --exit-status`
- `gh release view v0.1.5 --json tagName,name,url,isDraft,isPrerelease,publishedAt,assets`
- `npm run audit:submission-copy`
- `npm run check`
- `git diff --check`

## Boundaries

- Do not change Splunk runtime behavior.
- Do not claim GitHub Packages is the unauthenticated judge install path; npmjs
  remains the no-auth install path.
- Do not edit package-input files after publishing without doing another npm
  publish/currentness pass.

## Result

- Bumped source and public distribution copy to `0.1.5`.
- Published `splunkready@0.1.5` to npm; npm latest and local package input
  commit both point at `a79ee9e9de60b709d2110703004bbe9b1fedc373`.
- Pushed `v0.1.5`; the release-artifacts workflow published Linux, macOS, and
  Windows no-Node archives, checksum files, and per-platform manifests.
- Published and verified the GitHub Packages mirror
  `@arshgill01/splunkready@0.1.5`.
- Refreshed public-package, GitHub Packages, GitHub Release, claim-ledger, and
  evidence-pack artifacts.
