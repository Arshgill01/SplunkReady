# Move 181 - Hosted public demo LLM currentness

## Intent

Close the residual risk from Move 180: the local public-demo export exposed the
real-Splunk LLM deliberation bundle, but the live GitHub Pages demo still had to
be deployed and audited before the hosted URL could be cited.

## Scope

- Run the `Public Demo Pages` workflow for the current branch commit.
- Re-run hosted-demo currentness audit against GitHub Pages and track the
  refreshed report.
- Open the actual hosted LLM deliberation route with Playwright and capture a
  screenshot.
- Update claim-ledger and submission evidence copy so the hosted route evidence
  names the current source commit and LLM artifact base.
- Keep this move evidence-only: no UI redesign, no runtime behavior change, no
  Splunk mutation.

## Expected touched files

- `moves/moves181.md`
- `README.md`
- `submission-evidence/README.md`
- `submission-evidence/claim-ledger.md`
- `submission-evidence/hosted-demo-currentness/hosted-demo-currentness.json`
- `submission-evidence/screenshots/hosted-demo-llm-deliberation.png`
- `submission-evidence/evidence-pack-sha256.txt`
- `scripts/audit-submission-copy.mjs`
- `tests/scripts/submission-copy-audit.test.ts`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Verification

- `gh workflow run public-demo-pages.yml --ref splunkready-build`
- `gh run watch <pages-run-id> --exit-status`
- `npm run audit:hosted-demo-currentness -- --out submission-evidence/hosted-demo-currentness/hosted-demo-currentness.json --require-current`
- Playwright open/snapshot/screenshot of
  `https://arshgill01.github.io/SplunkReady/?artifacts=artifacts%2Freal-splunk-stress-llm-layer#llm-deliberation`
- `npx vitest run tests/scripts/submission-copy-audit.test.ts`
- `npm run audit:submission-copy`
- `shasum -a 256 -c submission-evidence/evidence-pack-sha256.txt`
- `git diff --check`
