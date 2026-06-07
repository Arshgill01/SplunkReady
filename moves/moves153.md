# Move 153 - Hosted Demo Currentness After Package Release

## Intent

Close the public demo drift introduced after the package publish. The no-clone
npm path is current, but the GitHub Pages demo must also match the latest
public-demo inputs and current UI asset names.

## Scope

- Fix the public-demo exporter so `sourceCommit` records the latest commit that
  touched public-demo inputs, not an arbitrary workflow checkout commit.
- Preserve the workflow checkout as `deploymentCommit` for traceability.
- Keep the exporter and hosted currentness audit on one shared public-demo input
  path list.
- Redeploy the GitHub Pages public demo.
- Refresh hosted-demo currentness evidence and claim-ledger copy.

## Stop Conditions

- Do not copy secrets, `.env*`, or `.splunkready*` files into hosted artifacts.
- Do not weaken the credential-free public demo boundary.
- Do not claim operator-owned live Splunk proof from hosted static artifacts.

## Verification

- `npm test -- tests/scripts/public-demo-export.test.ts tests/scripts/hosted-demo-currentness.test.ts`
- `npm run build`
- `npm run audit:public-demo-export`
- `gh workflow run public-demo-pages.yml --ref splunkready-build`
- `gh run watch 27102069779 --exit-status`
- `npm run audit:hosted-demo-currentness -- --require-current --out submission-evidence/hosted-demo-currentness/hosted-demo-currentness.json`
- `npm run check`

## Result

Implemented. GitHub Pages run `27102069779` deployed the corrected public demo,
and the hosted-demo currentness audit reports `CURRENT` for source commit
`fefd727`, matching local assets and preserving `mutation=false`.
