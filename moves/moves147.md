# Move 147 - Self-Hostable Splunk MCP Mock Server

## Intent

Make live-mode proof reproducible without operator-owned Splunk credentials by
shipping a read-only Splunk MCP mock server that exercises the live adapter
transport boundary.

## Scope

- Add package subpath `splunkready/mock-splunk-mcp`.
- Add CLI command `splunkready mock-splunk-mcp`.
- Implement an MCP-compatible JSON-RPC stdio server backed by fixture data.
- Start with `splunk_get_info` and `splunk_get_knowledge_objects`.
- Add tests for initialize, tools/list, and tools/call.
- Extend the proven mock transport with read-only `splunk_run_query` and
  `splunk_run_saved_search` fixture-backed calls.
- Wire `--live-mock` into the live proof path using a fixture-backed mock live
  transport that still exercises the live adapter normalization boundary.

## Deferred Scope

- Dockerfile and docker-compose packaging.
- SAIA route states plus realistic latency, pagination, and degraded-state behavior.
- CI live-mock proof and `submission-evidence/live-mock/`.
- `mcp-proof --live-mock` composition evidence.
- Full `live-security-proof --live-mock` without operator-owned LLM credentials;
  the strict proof command still requires `SPLUNKREADY_LLM_ENABLED=true`.

## Verification

- Focused mock MCP server tests.
- `npm run build`.
- `npm run audit:package-readiness` if package exports change.
- Built CLI stdio smoke for initialize, tools/list, `splunk_get_info`, and
  `splunk_get_knowledge_objects`.

## Result

First slice implemented. `mock-splunk-mcp` initializes over stdio, lists
read-only Splunk tools, returns fixture deployment info, returns fixture
knowledge objects, and reports no mutation.

Second slice implemented. The mock server now also lists and serves
`splunk_run_query` and `splunk_run_saved_search` through the same fixture
adapter. Focused tests and a built CLI stdio smoke verify evidence-bearing
query and saved-search outputs.

Third slice implemented. `live-proof --live-mock` and
`live-security-check --live-mock` now run through a fixture-backed mock live
transport with no Splunk credentials. A stripped-env built CLI smoke verifies
`live-proof --live-mock --json` returns `PASS`, `mode: live`,
`mutation: false`, `failToPass: true`, and `proofLoop: fail-to-pass`.
`live-security-check --live-mock --json` reports
`READY_FOR_FLAGSHIP_LIVE_SECURITY_PROOF` with fallback disabled. Route-state
simulation, Docker packaging, CI live-mock proof, `mcp-proof --live-mock`, and
`submission-evidence/live-mock/` remain deferred.
