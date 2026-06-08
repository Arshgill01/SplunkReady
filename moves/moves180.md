# Move 180 - Public Demo LLM Evidence Route

## Intent

Make the richer LLM layer judge-visible from the static public demo export.
Move 176 proved the real-Splunk LLM deliberation view locally, but the public
demo export copied only the screenshot, not the underlying artifact bundle.

## Scope

- Copy `submission-evidence/real-splunk-stress-llm-layer/` into
  `artifacts/public-demo/artifacts/real-splunk-stress-llm-layer`.
- Add the artifact base to `public-demo-manifest.json`.
- Audit that the public demo contains the LLM deliberation reports, claim
  audits, UI artifact selector metadata, and screenshot.
- Update public demo tests and submission evidence copy so the claim is guarded.
- Verify the hosted-style static route can load `#llm-deliberation`.

## Non-Goals

- Do not regenerate the real Splunk LLM proof in this move.
- Do not require live Splunk, Gemini, or SAIA credentials for public demo build.
- Do not make LLM output authoritative for readiness verdicts.
- Do not redesign the workbench.

## Expected Files

- `scripts/export-public-demo.js`
- `scripts/audit-public-demo-export.mjs`
- `tests/scripts/public-demo-export.test.ts`
- `README.md`
- `submission-evidence/README.md`
- `submission-evidence/claim-ledger.md`
- `scripts/audit-submission-copy.mjs`
- `tests/scripts/submission-copy-audit.test.ts`
- `submission-evidence/evidence-pack-sha256.txt`
- logs

## Verification

- `npx vitest run tests/scripts/public-demo-export.test.ts tests/scripts/submission-copy-audit.test.ts`
- `npm run public-demo:build`
- `npm run audit:public-demo-export`
- Playwright open/snapshot/screenshot of
  `http://127.0.0.1:<port>/?artifacts=artifacts%2Freal-splunk-stress-llm-layer#llm-deliberation`
- `npm run check`
