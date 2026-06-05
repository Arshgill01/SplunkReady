# Move 71: Judge Proof LLM Evidence Slot

## Trigger

The Minimax audit and user feedback both flagged that the judge-facing path
still made the deterministic specimen feel like the only demo producer. Move 60
made `llm-proof` real, but it stayed adjacent to `judge-proof` instead of
showing up in the main evidence bundle.

## Scope

- Add an explicit `llmEvidence` block to `judge-proof-summary.json`.
- Keep the default `judge-proof` command credential-free with
  `llmEvidence.status: "NOT_REQUESTED"`.
- Add an explicit `--include-llm-proof true` opt-in that runs `llm-proof` inside
  the judge bundle when `GEMINI_API_KEY` is configured.
- Add `npm run judge-proof:llm` as the discoverable opt-in script.
- Extract judge-proof orchestration into a workflow module instead of growing
  `src/cli.ts`.
- Document the new path in README.

## Boundaries

- Do not make LLM output authoritative for readiness.
- Do not replace the deterministic fixture judge proof.
- Do not call Gemini unless the operator explicitly opts in.
- Do not call live Splunk or mutate Splunk.
- Do not read, source, print, or commit `.env*` or `.splunkready*` files.
- Do not change UI source; Playwright is not required.
- Do not use subagents.

## Acceptance

- Normal `judge-proof` writes `llmEvidence.status: "NOT_REQUESTED"`.
- `judge-proof --include-llm-proof true` with a configured Gemini endpoint writes
  `llm-proof/llm-proof-summary.json` inside the judge bundle and reports
  `llmEvidence.status: "PASS"`.
- The LLM evidence block records `role: "trace-producer"` and
  `passFailAuthority: "deterministic-rule-engine"`.
- `src/cli.ts` delegates judge-proof orchestration to a workflow module.
- Focused CLI coverage and full repository checks pass.
