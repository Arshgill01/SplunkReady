# Move 103 - Public Judge Proof Evidence Pack

## Goal

Make the tracked judge-facing evidence pack show the public hosted judge-proof
view that was added after package publication.

## Scope

- Track the Playwright-verified hosted judge-proof screenshot.
- Update the evidence README and claim ledger so the hosted judge-proof view is
  explicit.
- Refresh the evidence-pack SHA-256 ledger.

## Verification

- `shasum -a 256 -c submission-evidence/evidence-pack-sha256.txt`
- `npm run audit:submission-copy`
- `npm run verify:scaffold`
- `git diff --check`

## Boundaries

- Do not change source behavior.
- Do not run `npm publish`.
- Do not read, source, print, or commit `.splunkready*` or `.env*` files.
