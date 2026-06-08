# Move 179 - Readiness Score Calibration Evidence

## Intent

Make the deterministic scoring layer visibly non-binary. The flagship proof may
still land at `NOT READY / 0` to `READY / 100`, but the product should ship a
tracked calibration artifact proving that the same deterministic scorer produces
intermediate scores and a `NEEDS REVIEW` verdict when the rule mix warrants it.

## Scope

- Add a deterministic score-calibration workflow.
- Emit JSON and Markdown evidence with READY, NEEDS REVIEW, and NOT READY
  scenarios.
- Show severity deductions, blockers, and threshold behavior.
- Add a package script so the artifact can be regenerated without touching live
  Splunk or LLM credentials.
- Track the artifact in `submission-evidence/` and the claim ledger.

## Non-Goals

- Do not change the authoritative score formula for existing receipts.
- Do not let LLM output influence readiness scores.
- Do not mutate Splunk or require live credentials.
- Do not add a CLI monolith command unless the workflow proves it needs one.

## Expected Files

- `src/workflows/readiness-score-calibration.ts`
- `scripts/run-readiness-score-calibration.mjs`
- `tests/workflows/readiness-score-calibration.test.ts`
- `package.json`
- `submission-evidence/readiness-score-calibration/*`
- `submission-evidence/claim-ledger.md`
- `submission-evidence/README.md`
- `scripts/audit-submission-copy.mjs`
- `tests/scripts/submission-copy-audit.test.ts`
- logs

## Verification

- `npm run build`
- `npm run score-calibration`
- `npx vitest run tests/workflows/readiness-score-calibration.test.ts tests/scripts/submission-copy-audit.test.ts`
- `npm run audit:submission-copy`
- `npm run check`
