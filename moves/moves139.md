# Move 139 - Hosted Demo Currentness Evidence

## Intent

Turn the successful hosted-demo currentness audit into tracked submission
evidence so the public GitHub Pages URL cannot be presented without source
commit provenance.

## Scope

- Record the current `audit:hosted-demo-currentness --require-current` result in
  `submission-evidence/hosted-demo-currentness/`.
- Add a claim-ledger row for source-current hosted demo evidence.
- Extend the submission-copy audit so the hosted currentness evidence and
  command remain cited.
- Do not change the public demo export inputs, registry package state, or live
  Splunk/SAIA behavior.

## Verification

- `npm run audit:hosted-demo-currentness -- --require-current --out submission-evidence/hosted-demo-currentness/hosted-demo-currentness.json`
- `npx vitest run tests/scripts/submission-copy-audit.test.ts`
- `npm run audit:submission-copy`

## Result

The hosted public demo reports `CURRENT` against source commit `22777f3`, the
hosted asset names match local public-demo assets, and the tracked manifest
continues to report `mutation=false`.
