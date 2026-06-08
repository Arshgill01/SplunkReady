# ExecPlan: LLM Layer Expansion

Created: 2026-06-08

## Objective

Make SplunkReady's LLM layer a first-class proof surface while preserving the
core product boundary: deterministic rules decide Readiness Receipt verdicts;
LLMs produce traces, reasoning, explanations, and remediation narratives.

## Current Reality

- The Gemini specimen is real, but the prompt contract is shallow: one planning
  JSON object and one final-answer JSON object.
- The receipt score is already weighted by severity, not globally hardcoded to
  `60` or `100`. The visible `60 -> 100` pattern comes from the flagship
  scenario having two before-phase violations and zero after-phase violations.
- LLM output is not currently graded as an artifact. Judges can see that Gemini
  made tool calls, but they cannot see whether the LLM's reasoning, evidence
  handling, or safety posture was strong.

## Strategy

1. Add a harder LLM deliberation contract:
   - mission understanding;
   - risk controls;
   - evidence strategy;
   - structured final answer with provenance, uncertainty, next actions, and
     safety notes.
2. Add a deterministic LLM output-quality report:
   - dynamic 0-100 advisory score;
   - dimension scores for planning, provenance, safety, and remediation;
   - findings that explain missing or strong evidence;
   - explicit `passFailAuthority: "deterministic-rule-engine"`.
3. Write this report into LLM-backed proof artifacts for before/after phases.
4. Only after the first slice passes locally, rerun the real Splunk stress proof
   with LLM enabled and compare the new advisory report against the existing
   deterministic receipt results.

## Non-Goals

- Do not make LLM output authoritative for readiness verdicts.
- Do not weaken deterministic checks.
- Do not add a heavy model orchestration dependency for the first slice.
- Do not claim SAIA/hosted-model success unless the live diagnostic passes.
- Do not make the default credential-free judge path require live Splunk.

## First Slice

Move 175 implements the LLM deliberation contract and advisory quality report.

Expected files:

- `moves/moves175.md`
- `docs/execplans/llm-layer-expansion.md`
- `DECISIONS.md`
- `docs/llm-specimen-agent.md`
- `src/agents/llm-specimen.ts`
- `src/agents/gemini-model.ts`
- `src/agents/llm-output-quality.ts`
- `src/workflows/certification-actions.ts`
- `src/workflows/llm-agent.ts`
- focused tests under `tests/agents/`
- log updates

Verification:

- `npx vitest run tests/agents/llm-specimen.test.ts tests/workflows/llm-agent.test.ts`
- `npm run check`

## Follow-Up Slices

- Add a nuanced live stress mission variant that creates more than two before
  violations so deterministic scores are visibly less binary.
- Add UI rendering for LLM output-quality reports.
- Rerun `npm run real-splunk-stress-proof` with `SPLUNKREADY_LLM_ENABLED=true`
  and compare deterministic scores plus advisory LLM quality scores.

## Second Slice

Move 177 hardens the LLM output layer and the before/after contrast:

- The LLM answer contract must include a concise `decisionTrace` and a
  `claimEvidenceMatrix`, so every material answer claim can be checked against
  query refs, result counts, and evidence refs.
- The advisory output-quality report is reweighted to score claim discipline as
  a first-class dimension instead of treating provenance as one undifferentiated
  bucket.
- The pre-policy Gemini planning prompt is intentionally less over-coached: it
  receives the mission and runtime boundary, but not the full forbidden-pattern,
  preferred-saved-search, authorized-index, and deterministic-check hints. The
  post-policy rerun still receives the compiled contract and policy. This keeps
  the specimen real but naive before compilation and contract-aware after it.
- The receipt verdict and score remain deterministic. The LLM quality report is
  evidence for AI integration quality, not a readiness authority.

Expected files:

- `moves/moves177.md`
- `docs/execplans/llm-layer-expansion.md`
- `src/agents/llm-specimen.ts`
- `src/agents/gemini-model.ts`
- `src/agents/llm-output-quality.ts`
- `ui/src/artifacts.ts`
- `tests/agents/llm-specimen.test.ts`
- `tests/ui/app.test.ts`
- log updates

Verification:

- `npx vitest run tests/agents/llm-specimen.test.ts tests/ui/app.test.ts`
- real Gemini-backed `llm-proof`
- guarded real Splunk stress replay when Docker and credentials are available
- `npm run check`
