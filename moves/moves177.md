# Move 177 - LLM Evidence Matrix And Naive Before-Phase Prompt

## Intent

Make the LLM layer more substantial without making it the readiness judge.
The LLM should produce auditable reasoning artifacts, and the before/after proof
should show a real pre-policy specimen becoming contract-aware after the policy
patch instead of a model that was over-coached before compilation.

## Scope

- Add a claim-to-evidence matrix and concise decision trace to the LLM answer
  contract.
- Add a `claim-discipline` dimension to the deterministic advisory LLM
  output-quality report.
- Reweight the advisory quality report to remain a dynamic 0-100 score while
  giving claim support explicit points.
- Hide policy-only hints from the pre-policy Gemini planning prompt:
  forbidden patterns, authorized indexes, preferred saved-search refs, and
  deterministic check IDs are exposed only after policy injection.
- Keep Readiness Receipt verdicts and receipt scores controlled by the
  deterministic rule engine.

## Non-Goals

- Do not make LLM output authoritative for pass/fail.
- Do not weaken deterministic SPL, knowledge-object, evidence, answer, or
  safety checks.
- Do not add a new model orchestration dependency.
- Do not require live Splunk for the credential-free judge path.

## Verification

- `npx vitest run tests/agents/llm-specimen.test.ts tests/ui/app.test.ts`
- `npm run check`
- Real Gemini-backed proof and real Splunk stress replay after the focused
  tests pass.
