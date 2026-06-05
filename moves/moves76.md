# Move 76: LLM Agent Workflow Extraction

## Trigger

After suite-proof extraction, the largest remaining CLI-owned orchestration block
was `llm-agent`. The command still compiled the contract, constructed the
Gemini-backed specimen, ran the agent, graded the trace, scored readiness, and
wrote receipt artifacts directly inside `src/cli.ts`.

## Scope

- Move `llm-agent` orchestration into `src/workflows/llm-agent.ts`.
- Keep the CLI command as a thin delegator.
- Preserve the credential fail-closed behavior when `GEMINI_API_KEY` is absent.
- Preserve deterministic grading authority for the generated receipt.
- Add workflow tests for fail-closed behavior and CLI independence.

## Boundaries

- Do not make LLM output authoritative for pass/fail.
- Do not change fixture/live adapter behavior.
- Do not call live Splunk or mutate Splunk.
- Do not read, source, print, or commit `.env*` or `.splunkready*` files.
- Do not change UI source; Playwright is not required.
- Do not use subagents.

## Acceptance

- `src/cli.ts` no longer imports receipt generation or scoring internals for
  `llm-agent`.
- `src/workflows/llm-agent.ts` owns LLM trace, violation, score, and receipt
  artifact writes.
- Focused LLM workflow and CLI regressions pass.
- Full repository checks pass.
