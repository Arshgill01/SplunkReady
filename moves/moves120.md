# Move 120 - Per-Tool SAIA Hosted-Model Receipt

## Goal

Make the SAIA / hosted-model proof credible for real live setup by recording
which hosted-model tools passed or failed individually instead of collapsing
generate, explain, optimize, and ask into one aggregate PASS/BLOCKED result.

## Scope

- Add per-tool hosted-model invocation results to `hosted-model-proof.json` and
  `hosted-model-diagnostic.json`.
- Forward the per-tool results through
  `splunkready_check_hosted_model_access` so external MCP clients and
  `mcp-proof-summary.json` can show the tool-level health.
- Surface passed, blocked, and tool-result rows in the MCP proof route.
- Regenerate MCP proof evidence and the public demo export.

## Boundaries

- Do not read, source, print, or commit `.splunkready*` / `.env*` secret values.
- Do not call live Splunk in this credential-free evidence move.
- Do not execute generated, unsafe, or optimized SPL.
- Do not make SAIA or any LLM output authoritative.
- Do not mutate Splunk.
- Do not use subagents.

## Verification

- `npx tsc --noEmit`
- `npx vitest run tests/workflows/hosted-model-actions.test.ts tests/cli/flow.test.ts tests/mcp/server.test.ts tests/ui/app.test.ts --testNamePattern "hosted-model|Hosted model|SAIA|MCP proof|hosted_model"`
- `npm run build && node dist/src/cli.js mcp-proof --out submission-evidence/mcp-proof --json && npm run public-demo:build`
- Playwright static browser check for
  `http://127.0.0.1:4343/?artifacts=artifacts%2Fmcp-proof#mcp-proof`
- `npm run check`
