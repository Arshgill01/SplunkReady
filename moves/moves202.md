# Move 202 - Public npm 0.1.7 Currentness

## Status

Superseded by Move 208. The 2026-06-08 `EOTP` blocker was resolved by the
operator publishing `splunkready@0.1.7`; public npm now reports latest `0.1.7`.
The package remains source-stale because current package-input commits landed
after that publish.

## Objective

Close or precisely re-document the public npm distribution gap after Move 201.
The source, GitHub Release, setup action, and GitHub Packages mirror are at
`0.1.7`; public npm originally reported latest `splunkready@0.1.5`.

## Expected touched files

- `moves/moves202.md`
- `docs/execplans/public-npm-017-currentness.md`
- `submission-evidence/public-package-currentness/public-package-currentness.json`
- `submission-evidence/README.md`
- `submission-evidence/claim-ledger.md`
- `README.md`
- `docs/devpost-submission.md`
- `scripts/audit-submission-copy.mjs`
- `tests/scripts/submission-copy-audit.test.ts`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`
- `submission-evidence/evidence-pack-sha256.txt`

## Verification

- `npm view splunkready version`
- `npm run audit:npm-release-preflight -- --require-ready`
- `npm publish --access public`
- `npm run audit:public-package-currentness -- --require-current --out submission-evidence/public-package-currentness`
- `npm run audit:submission-copy`
- `npx vitest run tests/scripts/submission-copy-audit.test.ts`
- evidence-pack SHA-256 regeneration and verification
- `git diff --check`
- `npm run check`
- branch-tip CI

## Boundaries

- Do not claim public npm `0.1.7` unless npm registry verification and the
  public-package currentness audit pass.
- Do not mutate live Splunk.
- Do not change package metadata unless the registry or preflight shows a
  concrete versioning issue.
