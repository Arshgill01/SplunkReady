# Move 175 - LLM Deliberation Contract

## Intent

Make the Gemini-backed specimen visibly more than a thin prompt wrapper by
requiring structured planning, safety, evidence, and answer fields, then grading
that LLM output with a deterministic advisory report.

## Scope

- Extend the LLM plan contract with mission understanding, risk controls,
  evidence strategy, and self-check fields.
- Extend the LLM final answer contract with provenance, uncertainty, next
  actions, and safety notes.
- Add a deterministic LLM output-quality evaluator with dynamic advisory
  scoring.
- Persist before/after LLM deliberation artifacts during LLM-backed evaluate and
  rerun flows.
- Keep Readiness Receipt verdict authority with the deterministic rule engine.

## Non-Goals

- Do not make an LLM the grader.
- Do not remove deterministic rules.
- Do not require Gemini for the default judge path.
- Do not change live Splunk setup behavior in this move.

## Verification

- `npx vitest run tests/agents/llm-specimen.test.ts tests/workflows/llm-agent.test.ts`
- `npm run check`
