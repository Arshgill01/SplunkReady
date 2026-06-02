# Live Proof Gap

Status: live Splunk remains unverified in this branch.

Wave 84 note: when live configuration is present, `live-smoke` now writes both `live-smoke-contract.json` and `live-smoke-readiness-profile.json`. The profile binds active deterministic rule IDs to the read-only live inventory facts. This path is covered by a mock MCP test, but it still has not been run against a real Splunk MCP endpoint.

## Command Run

```bash
npm run build && tmp=$(mktemp -d /tmp/splunkready-wave82-live-gap-XXXXXX) && unset SPLUNKREADY_LIVE_ENABLED SPLUNKREADY_SPLUNK_MCP_URL SPLUNKREADY_SPLUNK_MCP_TOKEN SPLUNK_HOST SPLUNK_TOKEN SPLUNK_USERNAME SPLUNK_PASSWORD SPLUNK_SCHEME SPLUNK_PORT && npm run splunkready -- live-smoke --out "$tmp" && printf 'out=%s\n' "$tmp" && find "$tmp" -maxdepth 1 -type f -print | sort
```

## Result

```text
SKIP live-smoke
Live smoke skipped; missing SPLUNKREADY_LIVE_ENABLED=true, SPLUNKREADY_SPLUNK_MCP_URL, SPLUNKREADY_SPLUNK_MCP_TOKEN. No live Splunk calls were made and no live artifacts were written. Fixture commands still run without live credentials. See docs/live-adapter.md for the opt-in setup checklist.
out=/tmp/splunkready-wave82-live-gap-eNiFdW
```

No files were written in `/tmp/splunkready-wave82-live-gap-eNiFdW`.

## Missing Configuration

- `SPLUNKREADY_LIVE_ENABLED=true`
- `SPLUNKREADY_SPLUNK_MCP_URL`
- `SPLUNKREADY_SPLUNK_MCP_TOKEN`

## Smallest Next Live Command

After the user confirms a bounded read-only live proof window and provides local env vars, run:

```bash
npm run build
npm run splunkready -- live-smoke --out artifacts/live-smoke --require-live true
```

The live-smoke path is inventory-only. It calls `splunk_get_info`, `splunk_get_user_info`, `splunk_get_indexes`, `splunk_get_metadata`, and `splunk_get_knowledge_objects`; it does not run searches and does not mutate Splunk. A successful run should produce `live-smoke-contract.json`, `live-smoke-readiness-profile.json`, and `live-smoke-summary.json`.
