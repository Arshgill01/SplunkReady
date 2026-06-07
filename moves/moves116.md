# Move 116 - External MCP Client Config Resources

## Goal

Make the SplunkReady MCP server usable from recognizable external MCP clients,
not only from the local `mcp-proof` workflow.

## Scope

- Add a package CLI entrypoint: `splunkready mcp`.
- Add credential-free MCP client-config resources for Claude Desktop and
  Cursor:
  - `splunkready://client-config/claude-desktop`
  - `splunkready://client-config/cursor`
- Extend `mcp-proof` so the recorded stdio MCP client reads both resources.
- Tighten the MCP composition scorecard and client-session PASS criteria so the
  external client resources are required.
- Refresh tracked MCP proof evidence, the public demo export, the claim ledger,
  and the Playwright-verified MCP proof screenshot.
- Keep Splunk MCP credentials operator-owned placeholders; do not read or write
  real secrets.

## Verification

- `npx tsc --noEmit`
- `npx vitest run tests/mcp/server.test.ts`
- `npx vitest run tests/scripts/submission-copy-audit.test.ts`
- `npx vitest run tests/cli/flow.test.ts --testNamePattern "stdio MCP server|MCP server proof"`
- `npx vitest run tests/ui/app.test.ts --testNamePattern "MCP proof"`
- `npm run build && node dist/src/cli.js mcp-proof --out submission-evidence/mcp-proof --json`
- `npm run public-demo:build`
- Playwright opened `http://127.0.0.1:4342/?artifacts=artifacts%2Fmcp-proof#mcp-proof`,
  verified the MCP proof route showed 11 resources, both external client-config
  URIs, `external-mcp-client-configs: PASS`, and 22 requests/responses, then
  captured `submission-evidence/screenshots/workbench-mcp-proof.png`.
- `npm run audit:public-demo-export`
- `npm run audit:submission-copy`
- `git diff --check`
- `npm run check`

## Boundaries

- Do not read, source, print, or commit real `.splunkready*` or `.env*`
  secret files.
- Do not make SAIA or any LLM output authoritative for pass/fail readiness.
- Do not mutate Splunk.
- Do not use subagents.
- Do not claim that npm `splunkready@0.1.0` already includes this new
  entrypoint; a later package publish is required for registry users.
