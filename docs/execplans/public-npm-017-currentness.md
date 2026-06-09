# ExecPlan: Public npm 0.1.7 Currentness

Created: 2026-06-08

## Objective

Make the public unauthenticated npm judge path current with the already-built
`0.1.7` source and release evidence, or record the exact npm blocker if publish
cannot complete.

## Context

Move 201 verified:

- source package metadata `0.1.7`;
- public GitHub Release `v0.1.7`;
- public standalone macOS arm64 download smoke;
- GitHub Packages `@arshgill01/splunkready@0.1.7`;
- final branch-tip CI.

The remaining distribution risk was public npm: `npm view splunkready version`
previously reported `0.1.5`, so the unauthenticated judge command was stale.

## Success Criteria

- `npm publish --access public` succeeds for `splunkready@0.1.7`, or the exact
  npm failure is logged and the stale claim boundary is preserved.
- If publish succeeds,
  `npm run audit:public-package-currentness -- --require-current --out
  submission-evidence/public-package-currentness` passes.
- README, Devpost copy, claim ledger, and submission evidence stop pointing
  the no-auth npm judge path at `0.1.5` and cite `0.1.7`.
- The full local gate and final branch-tip CI pass.

## Expected Touched Files

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

## Verification Plan

- `npm view splunkready version`
- `npm run audit:npm-release-preflight -- --require-ready`
- `npm publish --access public`
- `npm run audit:public-package-currentness -- --require-current --out submission-evidence/public-package-currentness`
- `npm run audit:submission-copy`
- `npx vitest run tests/scripts/submission-copy-audit.test.ts`
- evidence-pack SHA-256 regeneration and verification
- `git diff --check`
- `npm run check`
- push and verify branch-tip CI.

## Boundaries

- Do not claim `splunkready@0.1.7` on npm until the registry and audit prove it.
- Do not mutate live Splunk.
- Do not conflate GitHub Packages with public npm.

## Current Status

Superseded by Move 208. The operator published `splunkready@0.1.7`; the public
registry now reports latest `0.1.7`, and the published package passes
judge-proof, MCP, live-mock, recorder, and policy-registry probes. The
currentness audit still reports `STALE` because the published package gitHead is
`634969b40df4d3aac75382df5306e6a1b5ba7ea9`, while the current package-input
tree has later commits. The next release action is to bump above `0.1.7`,
publish, and rerun the currentness audit.
