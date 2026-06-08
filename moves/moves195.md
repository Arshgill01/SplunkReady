# Move 195 - Refresh Hosted Public Demo Currentness

## Status

Completed on 2026-06-08.

## Objective

Redeploy the GitHub Pages public demo after Move 193 changed public-demo input
evidence. The hosted manifest must match the latest public-demo input commit
and the tracked currentness evidence must return `CURRENT`.

## Expected touched files

- `moves/moves195.md`
- `submission-evidence/hosted-demo-currentness/hosted-demo-currentness.json`
- `submission-evidence/claim-ledger.md`
- `submission-evidence/README.md`
- `submission-evidence/evidence-pack-sha256.txt`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`
- focused submission-copy guard/test files if the public currentness row changes

## Verification

- `npm run audit:hosted-demo-currentness -- --out submission-evidence/hosted-demo-currentness/hosted-demo-currentness.json`
- `gh workflow run public-demo-pages.yml --ref splunkready-build`
- `gh run watch <run-id> --exit-status`
- `npm run audit:hosted-demo-currentness -- --require-current --out submission-evidence/hosted-demo-currentness/hosted-demo-currentness.json`
- `npm run audit:submission-copy`
- evidence-pack SHA-256 regeneration and verification
- `npm run check`

## Boundaries

- Do not claim hosted currentness until the deployed manifest source commit
  matches or contains the latest public-demo input commit.
- Do not change the public demo route or add new UI features in this move.
- Keep the hosted demo credential-free and mutation-free.

## Result

- Redeployed GitHub Pages with workflow run `27148574658`.
- Refreshed
  `submission-evidence/hosted-demo-currentness/hosted-demo-currentness.json`
  with `status: "CURRENT"`.
- Hardened `scripts/audit-hosted-demo-currentness.mjs` so a hosted source
  commit can be a descendant of the latest public-demo input commit. This keeps
  later evidence-only deployments from being falsely marked stale while still
  failing deployments that do not contain the expected input commit.
- Updated submission-copy guardrails and focused tests to require
  `hostedSourceCommitCoversExpectedInput: true`.
