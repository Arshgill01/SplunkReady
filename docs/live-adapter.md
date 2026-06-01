# Live Adapter

Live mode is disabled by default. Normal fixture tests must not require Splunk credentials.

## Environment Variables

- `SPLUNKREADY_LIVE_ENABLED`: set to `true` to enable live mode.
- `SPLUNKREADY_SPLUNK_MCP_URL`: live Splunk MCP endpoint URL.
- `SPLUNKREADY_SPLUNK_MCP_TOKEN`: live MCP bearer token or equivalent secret.
- `SPLUNKREADY_SPLUNK_APP`: optional default Splunk app context.
- `SPLUNKREADY_SPLUNK_TIMEOUT_MS`: optional per-tool timeout.
- `SPLUNKREADY_SPLUNK_CAPABILITIES`: optional comma-separated read-only tool allowlist.

Do not commit real values for these variables.

## Safe Smoke Command

Build first:

```bash
npm run build
```

Run the optional live smoke:

```bash
npm run splunkready -- live-smoke --out artifacts/live-smoke
```

Without live configuration, the command exits successfully with `SKIP live-smoke` and writes no live artifacts. To make missing live configuration fail explicitly in a local operator session:

```bash
npm run splunkready -- live-smoke --out artifacts/live-smoke --require-live true
```

With live configuration, the command uses a fixed inventory-only allowlist and calls only these read-only MCP tools:

- `splunk_get_info`
- `splunk_get_user_info`
- `splunk_get_indexes`
- `splunk_get_metadata`
- `splunk_get_knowledge_objects`

`SPLUNKREADY_SPLUNK_CAPABILITIES` can narrow adapter behavior in other live-adapter exercises, but `live-smoke` pins the allowlist above so the smoke path cannot start running searches if an operator sets broader capabilities.

The smoke path writes:

- `live-smoke-contract.json`: a schema-validated minimal live environment contract.
- `live-smoke-summary.json`: mode, source refs, bounded metadata window, fixed allowed tools, tools intentionally not called, and read-only safety flags.

The metadata request is bounded to `earliest=-15m` and `latest=now`. The smoke path does not call `splunk_run_query`, does not run saved searches, and never writes or mutates Splunk configuration.

## Operator Checklist

Before running live smoke against a real MCP endpoint:

- Confirm the endpoint is a non-production or approved read-only Splunk MCP endpoint.
- Export credentials only in the local shell; never write tokens into repo files, fixtures, screenshots, logs, or reviewer inbox notes.
- Run the no-credential skip path first to confirm the CLI reports missing fields without writing live artifacts.
- Use `--require-live true` only when you want missing configuration to fail the command.
- Inspect `live-smoke-summary.json` after a live run and confirm `readOnlyToolsOnly: true`, `destructiveOperations: false`, and the fixed `allowedTools` list.

## Safety Properties

- The live adapter implements the same `SplunkAccessAdapter` interface as fixture mode.
- Missing configuration fails with `SplunkAdapterError` and actionable missing-field names.
- Error messages must not echo secret values.
- Capability checks run before transport calls.
- The adapter only exposes read-only tool names from the shared schema.
- The HTTP transport uses MCP `tools/call` requests and sends tokens only in the authorization header.
- Normal CI should run fixture tests and the no-credential skip path, not a required live smoke.

## Transport Shape

SplunkReady posts JSON-RPC MCP tool calls to `SPLUNKREADY_SPLUNK_MCP_URL`:

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "splunk_get_metadata",
    "arguments": {
      "indexes": ["wineventlog"],
      "timeWindow": { "earliest": "-15m", "latest": "now" }
    },
    "defaultApp": "search"
  }
}
```

The transport accepts typed JSON from `result.structuredContent`, `result.output`, `result.content[].text`, or a direct `output` field.
