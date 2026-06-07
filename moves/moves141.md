# Move 141 - Hosted Demo Currentness Refresh

## Intent

Clear the hosted-demo staleness left by Move 140 so the public GitHub Pages
demo, tracked evidence pack, and pushed source commit all agree.

## Scope

- Rerun the Public Demo Pages workflow from `splunkready-build`.
- Refresh `submission-evidence/hosted-demo-currentness/hosted-demo-currentness.json`.
- Update the claim ledger to cite the current hosted source commit.
- Keep this move evidence-only; no product behavior or demo UI changes.

## Verification

- `gh run watch 27097064534 --exit-status`
- `npm run audit:hosted-demo-currentness -- --require-current --out submission-evidence/hosted-demo-currentness/hosted-demo-currentness.json`
- `npm run audit:submission-copy`
- `npm run check`

## Result

The hosted demo currentness audit reports `CURRENT` for source commit
`5b44c3b4468bf1302e3b8babc19479c8fe1bdb89`, the hosted and local asset names
match, and `mutation` remains `false`.
