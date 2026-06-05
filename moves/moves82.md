# Move 82: Dual MCP Client Kit

## Goal

Strengthen the Best Use of MCP story by making the proof show how an MCP client
uses an existing Splunk MCP Server together with SplunkReady's deterministic
certification server.

## Scope

- Add a credential-free MCP resource for a two-server client configuration:
  existing Splunk MCP for read-only investigation and SplunkReady MCP for
  certification.
- Keep Splunk credentials as placeholders only; do not read, source, print, or
  commit `.splunkready*` or `.env*` files.
- Update the Splunk MCP certification-loop resource and prompt so the two-server
  workflow is explicit.
- Include the dual-server config resource in `mcp-proof-summary.json` and
  `mcp-proof-summary.md`.
- Update UI schema/tests so the workbench accepts the new proof field.
- Regenerate MCP proof evidence, the MCP workbench screenshot, and evidence
  hashes.

## Non-goals

- Do not claim SplunkReady replaces Splunk MCP.
- Do not add write operations against Splunk.
- Do not make LLM, MCP, or SAIA output authoritative for pass/fail.
- Do not deploy or publish externally in this move.

## Expected verification

- `npx vitest run tests/mcp/server.test.ts`
- `npx vitest run tests/cli/flow.test.ts --testNamePattern "MCP server proof|MCP JSON-RPC transcript|mcp-proof"`
- `npx vitest run tests/ui/app.test.ts --testNamePattern "MCP proof|static-host"`
- `npm run build && node dist/src/cli.js mcp-proof --out submission-evidence/mcp-proof --json`
- `node dist/src/cli.js verify-manifest --out submission-evidence/mcp-proof/mcp-transcript-certification --json`
- `npm run public-demo:build`
- Playwright open/snapshot/screenshot for
  `http://127.0.0.1:4338/?artifacts=artifacts%2Fmcp-proof#mcp-proof`
- `shasum -a 256 -c submission-evidence/evidence-pack-sha256.txt`
- `npm run check`
- `git diff --check`
