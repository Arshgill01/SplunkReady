# Move 102 - Published Package Submission Claim Guard

## Goal

Make the submission-copy audit verify the new public npm package claim instead
of relying on the claim ledger row alone.

## Scope

- Add README, Devpost, and claim-ledger checks for the published
  `splunkready` npm package.
- Require the clean-folder `npx -y splunkready@0.1.0 judge-proof --out
  ./judge-proof --json` command in public copy.
- Add focused audit tests that pass when the npm package claim is present and
  fail when the claim-ledger row is removed.

## Verification

- `npx vitest run tests/scripts/submission-copy-audit.test.ts`
- `npm run audit:submission-copy`
- `npm run check`
- `npm run verify:scaffold`
- `git diff --check`

## Boundaries

- Do not run `npm publish`.
- Do not read, source, print, or commit `.splunkready*` or `.env*` files.
- Do not add new product claims beyond the already verified published-package
  evidence.
