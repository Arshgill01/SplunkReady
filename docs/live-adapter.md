# Live Adapter Skeleton

Live mode is disabled by default. Normal fixture tests must not require Splunk credentials.

## Environment Variables

- `SPLUNKREADY_LIVE_ENABLED`: set to `true` to enable live mode.
- `SPLUNKREADY_SPLUNK_MCP_URL`: live Splunk MCP endpoint URL.
- `SPLUNKREADY_SPLUNK_MCP_TOKEN`: live MCP bearer token or equivalent secret.
- `SPLUNKREADY_SPLUNK_APP`: optional default Splunk app context.
- `SPLUNKREADY_SPLUNK_TIMEOUT_MS`: optional per-tool timeout.
- `SPLUNKREADY_SPLUNK_CAPABILITIES`: optional comma-separated read-only tool allowlist.

Do not commit real values for these variables.

## Safety Properties

- The live adapter implements the same `SplunkAccessAdapter` interface as fixture mode.
- Missing configuration fails with `SplunkAdapterError` and actionable missing-field names.
- Error messages must not echo secret values.
- Capability checks run before transport calls.
- The adapter only exposes read-only tool names from the shared schema.

The real Splunk MCP transport is intentionally deferred until the live smoke wave. Wave 11 provides the structure, config boundary, and tests without requiring credentials.
