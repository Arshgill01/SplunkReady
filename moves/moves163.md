# Move 163 - MCP Recorder Pass-Through Gateway

## Intent

Turn Move 159's generated dual-server recorder evidence into a real
client-facing MCP recorder gateway. An MCP-capable client should be able to point
at SplunkReady's recorder, route calls to named downstream MCP servers, and get a
redacted, certifiable JSON-RPC session artifact without relying on closed desktop
log directories.

## Scope

- Add a `splunkready mcp-recorder` CLI entrypoint.
- Accept named downstream servers through explicit flags or config, for example
  `--server splunk=<command-or-url>` and
  `--server splunkready=<command-or-url>`.
- Preserve `serverId`, direction, sequence, method, tool name, and response
  identity in every captured frame.
- Redact endpoint, token, authorization header, env-name, and local-path
  material before writing tracked artifacts.
- Emit a dual-server JSONL session and Markdown summary in the Move 159 recorder
  format.
- Certify the Splunk-side transcript through the existing deterministic MCP
  transcript importer.
- Wire the recorder gateway into `mcp-proof` only after a credential-free mock
  path passes.

## Non-Goals

- Do not require Claude Desktop, Cursor, Antigravity, or Zed.
- Do not claim third-party client evidence until a real client consumes the
  gateway.
- Do not commit raw downstream logs, credentials, endpoint URLs, or env files.
- Do not turn the gateway into a generic write-capable Splunk proxy.

## Verification

- Focused unit tests for routing, frame capture, redaction, and server identity.
- Integration test using mock Splunk MCP plus local SplunkReady MCP over stdio.
- `node dist/src/cli.js mcp-proof --out submission-evidence/mcp-proof --live-mock --json`
- Recorder artifact leak scan for bearer headers, URLs, local paths, and secret
  env names.
- `npm run check`
