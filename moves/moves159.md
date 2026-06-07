# Move 159 - MCP Composition Recorder Gateway

## Intent

Strengthen the MCP award story without depending on a fragile closed desktop
client recording. Build a client-neutral recorder that can capture dual-server
MCP JSON-RPC frames from Splunk MCP investigation calls and SplunkReady MCP
certification calls, redact them, and hand the transcript back to the existing
deterministic certifier.

## Scope

- Add a local MCP recorder/proxy mode that can sit between a client and one or
  more MCP servers.
- Preserve server identity in every captured frame.
- Redact endpoint, token, and local path material before tracked export.
- Emit a dual-server session JSONL artifact compatible with
  `certify-mcp-transcript`.
- Add scorecard evidence for frames, server IDs, required Splunk tools, required
  SplunkReady tools, and mutation=false.

## Non-Goals

- Do not require Claude Desktop.
- Do not require Cursor-as-agent.
- Do not commit operator credentials or raw desktop logs.
- Do not claim a third-party client session until Antigravity, Zed, or another
  real client has actually consumed the recorder.

## Verification

- Focused recorder tests for redaction, server IDs, and transcript import.
- `npm run mcp-proof` with recorder evidence enabled.
- `npm run check`
