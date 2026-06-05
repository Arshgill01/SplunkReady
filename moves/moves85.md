# Move 85: MCP Composition Scorecard

## Goal

Strengthen the Best Use of MCP position by making the proof explicitly show
composed MCP usage: an existing Splunk MCP server performs read-only
investigation, while SplunkReady MCP certifies the captured behavior.

## Scope

- Add an MCP resource and prompt for reviewing the composed Splunk MCP +
  SplunkReady certification workflow.
- Add a deterministic `mcpComposition` scorecard to `mcp-proof-summary.json`.
- Score the composition on concrete evidence: dual-server client config,
  discoverable resources/prompts, captured Splunk MCP tool calls, saved-search
  evidence, Readiness Receipt authority, and no mutation.
- Render the scorecard in the Vite workbench MCP proof view.
- Regenerate judge-facing MCP proof evidence and the MCP workbench screenshot.

## Non-goals

- Do not claim SplunkReady replaces Splunk MCP.
- Do not add write operations against Splunk.
- Do not make LLM, MCP, or SAIA output authoritative for pass/fail.
- Do not read, source, print, or commit `.splunkready*` or `.env*` files.
- Do not deploy or publish externally in this move.

## Expected verification

- `npx vitest run tests/mcp/server.test.ts`
- `npx vitest run tests/cli/flow.test.ts --testNamePattern "MCP server proof|MCP JSON-RPC transcript|mcp-proof"`
- `npx vitest run tests/ui/app.test.ts --testNamePattern "MCP proof|static-host"`
- `npm run build && node dist/src/cli.js mcp-proof --out submission-evidence/mcp-proof --json`
- Playwright open/snapshot/screenshot for
  `http://127.0.0.1:4338/?artifacts=artifacts%2Fmcp-proof#mcp-proof`
- `shasum -a 256 -c submission-evidence/evidence-pack-sha256.txt`
- `npm run check`
- `git diff --check`
