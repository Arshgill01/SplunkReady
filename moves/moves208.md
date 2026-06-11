# Move 208 - Public npm 0.1.7 Post-Publish Boundary

## Status

Implemented on 2026-06-09. Branch-tip CI passed on commit
`099c0fc96472c3fdadc751aa171ab8ddb1c59187`.

## Objective

Replace stale public npm `0.1.5` and OTP-blocker copy with the current verified
state after the operator published `splunkready@0.1.7`: npm latest is `0.1.7`,
the published package passes no-clone judge-proof, MCP, live-mock, recorder, and
policy-registry probes, but the package is not source-current because newer
package-input commits landed after the publish.

## Expected touched files

- `moves/moves208.md`
- `moves/moves202.md`
- `docs/execplans/public-npm-017-currentness.md`
- `README.md`
- `docs/devpost-submission.md`
- `submission-evidence/public-package-currentness/public-package-currentness.json`
- `submission-evidence/README.md`
- `submission-evidence/claim-ledger.md`
- `scripts/audit-submission-copy.mjs`
- `tests/scripts/submission-copy-audit.test.ts`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`
- `submission-evidence/evidence-pack-sha256.txt`

## Verification

- `npm view splunkready version dist-tags.latest time --json`
- `npm run audit:public-package-currentness -- --require-current --out submission-evidence/public-package-currentness`
- `npm run audit:submission-copy`
- `npx vitest run tests/scripts/public-package-currentness.test.ts tests/scripts/submission-copy-audit.test.ts`
- evidence-pack SHA-256 regeneration and verification
- `git diff --check`
- `npm run check`
- branch-tip CI

## Boundaries

- Do not call the public npm package source-current while
  `registry.gitHeadMatchesPackageInputs` is false.
- Do not publish a new npm version without a version bump and release preflight.
- Do not mutate live Splunk.

## Result

- Verified public npm latest is `splunkready@0.1.7`.
- Refreshed the public-package currentness artifact. It reports:
  `latestVersion: "0.1.7"`, `localVersionPublished: true`,
  `latestMatchesLocal: true`, published judge-proof `PASS`, published MCP
  `PASS`, published live-mock proof `PASS`, published recorder `PASS`, and
  published policy registry `PASS`.
- Preserved the fail-closed `STALE` verdict because published gitHead
  `634969b40df4d3aac75382df5306e6a1b5ba7ea9` does not match the current
  package-input gitHead.
- Updated README, Devpost copy, claim ledger, and submission-copy guards to
  cite `npx -y splunkready@0.1.7 judge-proof --out ./judge-proof --json` while
  documenting that the next release must bump above `0.1.7`.
