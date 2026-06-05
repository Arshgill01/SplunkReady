# Move 42 - SplunkReady MCP Server

## Goal

Address the MCP category gap by exposing SplunkReady's Agent Readiness Compiler as a local MCP server with certification tools.

## Scope

- Implement a dependency-free stdio MCP server for SplunkReady.
- Support the MCP initialization handshake, tool discovery, tool calls, notifications, and protocol errors needed for local MCP clients.
- Expose certification tools for:
  - describing SplunkReady's deterministic no-mutation posture;
  - certifying a local external trace file;
  - certifying a local Splunk MCP JSON-RPC transcript file with a producer final answer.
- Reuse existing SplunkReady workflows and deterministic graders.
- Add focused MCP server tests and a launch script.
- Document local MCP client usage.

## Non-Goals

- Do not build a Splunk search/data-access MCP server.
- Do not expose write operations against Splunk.
- Do not make LLM/SAIA output authoritative.
- Do not add a heavy MCP SDK dependency for this narrow server surface.
- Do not change the workbench UI in this move.
- Do not work on video or submission packaging.

## Expected Files

- `src/mcp/server.ts`
- `tests/mcp/server.test.ts`
- `package.json`
- `examples/README.md`
- `logs/risk-register.md`
- `moves/README.md`
- `moves/moves42.md`
- `logs/execution-log.md`
- `logs/verification-log.md`

## Verification

- `npm test -- tests/mcp/server.test.ts`
- `npm run build`
- stdio smoke against `dist/src/mcp/server.js`
- `npm run check && git diff --check`

## Acceptance Criteria

- `initialize` returns MCP protocol version `2025-06-18`, server info, and `tools` capability.
- `tools/list` exposes deterministic SplunkReady certification tools with non-destructive annotations.
- `tools/call` can certify a checked-in passing external trace into a `PASS` result and written receipt artifacts.
- Tool calls reject `.env*` and `.splunkready*` paths instead of reading secret environment files.
- Unknown tools return protocol errors.
- The server does not claim to be a Splunk copilot, telemetry server, or mutation-capable Splunk integration.
