# Move 93: Judge Proof LLM Activation

## Goal

Reduce the LLM visibility cap by making the judge proof include the real
LLM trace-producer proof when an operator enables LLM mode.

## Scope

- Add `llmActivation` metadata to `judge-proof-summary.json` and Markdown.
- Include the LLM proof when either `--include-llm-proof true` is passed or
  `SPLUNKREADY_LLM_ENABLED=true` is set.
- Keep the base judge-proof suite credential-free and deterministic even when
  LLM mode is enabled in the parent environment.
- Preserve `NOT_CONFIGURED` fallback when LLM mode is enabled without
  `GEMINI_API_KEY`.
- Update focused tests and README.

## Non-goals

- Do not make LLM output authoritative for readiness.
- Do not call Gemini unless the operator enables LLM mode or passes the
  existing include flag.
- Do not call live Splunk or mutate Splunk.
- Do not read, source, print, or commit `.splunkready*` or `.env*` files.
- Do not change UI source or behavior.

## Expected verification

- `npx tsc --noEmit`
- `npx vitest run tests/cli/flow.test.ts --testNamePattern "judge proof"`
- `npm run build && SPLUNKREADY_LLM_ENABLED=true GEMINI_API_KEY= npm run splunkready -- judge-proof --out <tmpdir> --json`
- `npm run check`
- `git diff --check`
