# Move 109 - MCP client session evidence

## Goal

Strengthen the MCP award evidence by tracking the actual SplunkReady MCP
JSON-RPC client session used by `mcp-proof`.

## Scope

- Record a credential-free stdio JSON-RPC session transcript for the local
  SplunkReady MCP server proof.
- Summarize the client session inside `mcp-proof-summary.json`.
- Surface the session evidence in the MCP proof workbench view.
- Require the session artifacts in the public demo export.
- Refresh tracked MCP proof evidence and the MCP screenshot.

## Verification

- `npx vitest run tests/cli/flow.test.ts --testNamePattern "MCP server proof|MCP JSON-RPC transcript|mcp-proof"`
- `npx vitest run tests/ui/app.test.ts --testNamePattern "MCP proof"`
- `npm run mcp-proof`
- `npm run build && node dist/src/cli.js mcp-proof --out submission-evidence/mcp-proof --json`
- `node dist/src/cli.js verify-manifest --out submission-evidence/mcp-proof/mcp-transcript-certification --json`
- `npm run audit:public-demo-export`
- Playwright open/snapshot/screenshot for the MCP proof route.
- `git diff --check`
- `npm run check`

## Boundaries

- Do not make LLM output authoritative.
- Do not add Splunk write actions.
- Do not use live Splunk credentials.
- Do not run `npm publish`.
- Do not use subagents.
- Do not read, source, print, or commit `.splunkready*` or `.env*` files.
