# Move 121 - Live SAIA Prompt Compatibility And Redaction

## Goal

Use the operator-owned live SAIA setup to remove a real adapter mismatch and
make blocked live hosted-model artifacts safe to inspect.

## Scope

- Run the strict live hosted-model diagnostic through the ignored env file
  without reading or printing the file contents.
- Fix `saia_ask_splunk_question` live arguments from `question` to `prompt`,
  matching the observed live MCP endpoint requirement.
- Redact URLs in hosted-model proof and diagnostic error text so live artifacts
  do not leak endpoint routes.
- Update the live setup checklist with the current four-tool blocked state.
- Preserve the hosted-model boundary: SAIA output is advisory and generated or
  optimized SPL is not executed.

## Boundaries

- Do not read, source, print, or commit `.splunkready*` / `.env*` secret values.
- Do not commit `artifacts/live-hosted-model-diagnostic`.
- Do not claim live SAIA PASS unless the strict diagnostic exits PASS.
- Do not execute generated, unsafe, or optimized SPL.
- Do not make SAIA or any LLM output authoritative.
- Do not mutate Splunk.
- Do not use subagents.

## Verification

- `node dist/src/cli.js hosted-model-diagnostic --mode live --env-file ./.splunkready-live.env --out artifacts/live-hosted-model-diagnostic --require-pass true --json`
- `NODE_TLS_REJECT_UNAUTHORIZED=0 node dist/src/cli.js hosted-model-diagnostic --mode live --env-file ./.splunkready-live.env --out artifacts/live-hosted-model-diagnostic --require-pass true --json`
- `npx tsc --noEmit`
- `npx vitest run tests/adapters/live.test.ts tests/cli/flow.test.ts tests/workbench/workbench.test.ts --testNamePattern "SPL assistance|live MCP arguments|hosted-model|redacts secret-looking|not-found|SAIA"`
- `npm run build`
- redacted live artifact inspection for `status`, `toolResults`, `containsUrl`,
  and `containsRedactedUrl`
- `npm run check`
