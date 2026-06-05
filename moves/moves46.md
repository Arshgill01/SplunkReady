# Move 46: MCP Server Proof Command

## Status

Implemented.

## Problem

SplunkReady had a local MCP server, but the proof path still required a judge or
developer to know how to configure an MCP client or hand-send JSON-RPC. That
weakened the Best Use of MCP story because the server was real but not
one-command demonstrable.

## Scope

- Add a fixture-only `mcp-proof` CLI command and `npm run mcp-proof` script.
- Start the built SplunkReady stdio MCP server as a child process.
- Exercise the MCP handshake, tool listing, describe tool, and transcript
  certification tool through JSON-RPC.
- Certify the checked-in passing MCP transcript through
  `splunkready_certify_mcp_transcript`.
- Write `mcp-proof-summary.json` and `.md` plus the generated receipt bundle.
- Document the command in README and examples.

## Boundaries

- No Splunk search/data-access MCP server.
- No Splunk mutation.
- No LLM pass/fail authority.
- No new dependency.
- No UI change.
- No secret env file read.

## Verification

- `npm test -- tests/cli/flow.test.ts -t "MCP server proof"`
- `npm run build`
- `npm run mcp-proof`
- `npm run check`
- `git diff --check`
