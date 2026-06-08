# Move 182 - Stabilize hosted currentness after evidence commit

## Intent

Move 181 added a new hosted screenshot under `submission-evidence/screenshots`,
which is part of the public-demo input set. That made the Pages deployment for
Move 180 current, but not the subsequent Move 181 commit. This move deploys the
Move 181 commit and refreshes only non-public-demo-input currentness evidence.

## Scope

- Deploy GitHub Pages for commit `06c0146`.
- Refresh hosted-demo currentness JSON so the hosted source commit matches the
  latest public-demo input commit.
- Update claim/audit guard text from `807d047` to `06c0146`.
- Do not add or modify public-demo input files in this move.

## Expected touched files

- `moves/moves182.md`
- `submission-evidence/hosted-demo-currentness/hosted-demo-currentness.json`
- `submission-evidence/claim-ledger.md`
- `submission-evidence/evidence-pack-sha256.txt`
- `scripts/audit-submission-copy.mjs`
- `tests/scripts/submission-copy-audit.test.ts`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Verification

- `gh workflow run public-demo-pages.yml --ref splunkready-build`
- `gh run watch 27138145639 --exit-status`
- `npm run audit:hosted-demo-currentness -- --out submission-evidence/hosted-demo-currentness/hosted-demo-currentness.json --require-current`
- `npx vitest run tests/scripts/submission-copy-audit.test.ts`
- `npm run audit:submission-copy`
- `shasum -a 256 -c submission-evidence/evidence-pack-sha256.txt`
- `git diff --check`
