# Live Smoke Safety Refresh Report

Wave: 66 - Live Smoke Safety Refresh

## Scope

Refreshed the optional live-smoke safety evidence against the current implementation without using live Splunk credentials.

## Current Safety Contract

- Live mode is disabled unless `SPLUNKREADY_LIVE_ENABLED=true`.
- The no-credential live-smoke path exits with `SKIP live-smoke`.
- The no-credential path writes no `live-smoke-contract.json` or `live-smoke-summary.json` artifacts.
- The mocked live path pins a fixed inventory-only tool allowlist:
  - `splunk_get_info`
  - `splunk_get_user_info`
  - `splunk_get_indexes`
  - `splunk_get_metadata`
  - `splunk_get_knowledge_objects`
- The live-smoke summary records `readOnlyToolsOnly: true`, `destructiveOperations: false`, and the tools intentionally not called.

## Evidence

The targeted no-credential smoke command was run with live env vars unset:

```bash
env -u SPLUNKREADY_LIVE_ENABLED -u SPLUNKREADY_SPLUNK_MCP_URL -u SPLUNKREADY_SPLUNK_MCP_TOKEN npm run splunkready -- live-smoke --out /tmp/splunkready-wave66-live-smoke-skip
```

Result:

- PASS by returning `SKIP live-smoke`.
- Output stated no live Splunk calls were made.
- Output stated no live artifacts were written.
- Output pointed operators to `docs/live-adapter.md`.
- `/tmp/splunkready-wave66-live-smoke-skip` did not exist after the skip.

The targeted CLI tests were also run:

```bash
npx vitest run tests/cli/flow.test.ts -t "live smoke"
```

Result:

- PASS, 2 live-smoke tests.
- The skip test verifies no live credentials are required, missing configuration is actionable, and a provided token value is not echoed.
- The mocked live test verifies the command calls only the five inventory read-only MCP tools and does not call `splunk_run_query`, `splunk_run_saved_search`, `saia_explain_spl`, or `saia_optimize_spl`.

## Conclusion

The current live-smoke path remains optional, read-only, inventory-scoped, and safe for normal fixture verification without live Splunk credentials. The overall goal remains open pending explicit user approval.
