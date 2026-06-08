# Move 178 - Deterministic LLM Claim Audit

## Intent

Add a hard output layer for LLM answers: the model can produce a
claim-evidence matrix, but SplunkReady must independently audit those claims
against actual observations before showing the result in evidence or UI.

## Scope

- Add a deterministic `llm-claim-audit-v1` report.
- Audit model-declared query and evidence references against observed tool
  names, query refs, and evidence refs.
- Embed the audit in `llm-deliberation-before.json` and
  `llm-deliberation-after.json`.
- Write separate `llm-claim-audit-before.json` and
  `llm-claim-audit-after.json` artifacts for evidence-pack inspection.
- Render decision trace and claim-audit status in the Vite workbench.
- Keep the audit advisory: deterministic receipt rules remain the only
  pass/fail authority.

## Non-Goals

- Do not make claim-audit status override Readiness Receipt verdicts.
- Do not add a new model dependency or agent framework.
- Do not change fixture/live adapter contracts.
- Do not auto-mutate Splunk.

## Expected Files

- `src/agents/llm-claim-audit.ts`
- `src/agents/llm-specimen.ts`
- `src/workflows/certification-actions.ts`
- `scripts/run-real-splunk-stress-proof.mjs`
- `ui/src/artifacts.ts`
- `ui/src/render.ts`
- `tests/agents/llm-specimen.test.ts`
- `tests/ui/app.test.ts`
- `submission-evidence/real-splunk-stress-llm-layer/*`
- `submission-evidence/claim-ledger.md`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Verification

- `npx vitest run tests/agents/llm-specimen.test.ts tests/ui/app.test.ts`
- Real Gemini-backed `llm-proof`
- Guarded real Splunk stress replay when Docker and credentials are available
- Playwright screenshot of the LLM workbench view
- `npm run check`
