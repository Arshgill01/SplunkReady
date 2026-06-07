# Move 115 - MCP Hosted Model Diagnostic Resource

## Goal

Make hosted-model / SAIA readiness discoverable as an MCP workflow, not only as
a callable tool.

## Scope

- Add a `splunkready://workflows/hosted-model-diagnostic` MCP resource.
- Add a `splunkready_hosted_model_diagnostic` MCP prompt.
- Extend `mcp-proof` so the recorded stdio MCP client reads the resource and
  fetches the prompt.
- Tighten the MCP composition scorecard so hosted-model diagnostic discovery is
  part of the PASS criteria.
- Refresh tracked MCP proof evidence, public-demo artifacts, and the
  Playwright-verified MCP proof screenshot.
- Keep SAIA and LLM output advisory only; deterministic SplunkReady rules
  remain authoritative.

## Verification

- `npx tsc --noEmit`
- `npx vitest run tests/mcp/server.test.ts`
- `npx vitest run tests/cli/flow.test.ts --testNamePattern "MCP server proof"`
- `npx vitest run tests/ui/app.test.ts --testNamePattern "MCP proof"`
- `npx vitest run tests/scripts/submission-copy-audit.test.ts`
- `npm run public-demo:build`
- Playwright opened `http://127.0.0.1:4342/?artifacts=artifacts%2Fmcp-proof#mcp-proof`
  and captured `submission-evidence/screenshots/workbench-mcp-proof.png`.
- `npm run check`

## Boundaries

- Do not read, source, print, or commit real `.splunkready*` or `.env*`
  secret files.
- Do not make SAIA or any LLM output authoritative for pass/fail readiness.
- Do not mutate Splunk.
- Do not use subagents.
