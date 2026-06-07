# Move 119 - Four-Tool SAIA Hosted-Model Proof

## Goal

Make the hosted-model / SAIA track materially stronger by modeling the current
Splunk MCP AI Assistant surface as generate, explain, optimize, and ask instead
of only explain/optimize.

## Scope

- Add `saia_generate_spl` and `saia_ask_splunk_question` to shared read-only
  Splunk tool schemas.
- Extend fixture and live adapters with advisory `generateSpl` and
  `askSplunkQuestion` methods.
- Expand hosted-model proof to call generate, explain, optimize, and ask while
  keeping deterministic rules authoritative and never executing generated or
  optimized SPL.
- Regenerate MCP proof artifacts so public evidence shows all four SAIA tools
  required and available.
- Update README, Devpost draft, live setup docs, claim ledger, UI schema, and
  renderer copy to match the richer hosted-model proof.

## Boundaries

- Do not read or print `.splunkready*` or `.env*` secret values.
- Do not call live Splunk in this fixture evidence move.
- Do not execute generated, unsafe, or optimized SPL.
- Do not make SAIA or any LLM output authoritative.
- Do not mutate Splunk.
- Do not use subagents.

## Verification

- `npx tsc --noEmit`
- `npx vitest run tests/adapters/live.test.ts tests/workflows/hosted-model-actions.test.ts tests/cli/flow.test.ts --testNamePattern "hosted-model|SPL assistance|SAIA|live MCP arguments"`
- `npx vitest run tests/compiler/environment.test.ts tests/mcp/server.test.ts tests/ui/app.test.ts --testNamePattern "SAIA|hosted|MCP proof|Optional helper|hosted-model|saia"`
- `npx vitest run tests/ui/app.test.ts --testNamePattern "MCP proof|hosted|SAIA|live connect"`
- `npm run build && node dist/src/cli.js mcp-proof --out submission-evidence/mcp-proof --json`
- `npm run public-demo:build`
- Playwright route check for
  `http://127.0.0.1:4343/?artifacts=artifacts%2Fmcp-proof#mcp-proof`
- `npm run check`
