# Move 111 - MCP Resource Template Proof

## Goal

Strengthen the MCP award track by making SplunkReady's MCP surface more
composable for real MCP clients, not just a fixed two-tool certifier.

## Scope

- Add `resources/templates/list` support to the SplunkReady MCP server.
- Expose a templated Readiness Receipt resource:
  `splunkready://receipts/{receiptId}`.
- Keep templated receipt reads bounded to known receipt IDs; do not add an
  arbitrary local-file read surface.
- Extend `mcp-proof` so the recorded stdio MCP session discovers resource
  templates and reads `splunkready://receipts/pass`.
- Surface resource templates in the Vite MCP proof route.
- Refresh tracked MCP evidence, screenshot, claim ledger, and evidence hashes.

## Verification

- `npx tsc --noEmit`
- `npx vitest run tests/mcp/server.test.ts`
- `npx vitest run tests/ui/app.test.ts --testNamePattern "MCP proof"`
- `npx vitest run tests/cli/flow.test.ts --testNamePattern "MCP server proof"`
- `npm run build`
- `node dist/src/cli.js mcp-proof --out submission-evidence/mcp-proof --json`
- `node dist/src/cli.js verify-manifest --out submission-evidence/mcp-proof/mcp-transcript-certification --json`
- `npm run public-demo:build`
- Playwright open/snapshot/screenshot for
  `?artifacts=artifacts%2Fmcp-proof#mcp-proof`
- `npm run audit:public-demo-export`
- `npm run audit:submission-copy`
- `shasum -a 256 -c submission-evidence/evidence-pack-sha256.txt`
- `git diff --check`
- `npm run check`

## Boundaries

- Do not make an LLM or SAIA authoritative for pass/fail readiness.
- Do not mutate Splunk.
- Do not read, source, print, or commit `.splunkready*` or `.env*` files.
- Do not add a dependency.
- Do not use subagents.
