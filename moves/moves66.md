# Move 66: Hosted Model Workflow Extraction

## Trigger

The Minimax audit and user feedback both called out that LLM/hosted-model
evidence needs to be visible without making LLMs authoritative. The hosted-model
workbench workflow still imported the CLI dynamically, so the server-owned
workflow claim was weaker than the implementation.

## Scope

- Move hosted-model proof and diagnostic generation into
  `src/workflows/hosted-model-actions.ts`.
- Remove the hosted-model dynamic CLI import.
- Keep SAIA/hosted-model output advisory only.
- Preserve the CLI commands as thin workflow callers.
- Add direct workflow tests for fixture hosted-model proof and diagnostic
  artifacts.

## Boundaries

- Do not make hosted-model or LLM output the readiness judge.
- Do not execute SPL in hosted-model proof mode.
- Do not change live Splunk mutation posture.
- Do not read, source, print, or commit `.env*` or `.splunkready*` files.
- Do not change UI source; Playwright is not required.
- Do not use subagents.

## Acceptance

- `src/workflows/hosted-model-actions.ts` no longer imports `../cli.js`.
- Hosted-model CLI proof and diagnostic behavior remains covered by focused
  tests.
- Direct hosted-model workflow tests pass without live secrets.
- Full `npm run check` passes.
