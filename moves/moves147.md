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

## Deferred Scope

- `--live-mock` wiring for `live-proof`, `live-security-proof`, and `mcp-proof`.
- Dockerfile and docker-compose packaging.
- SAIA route states and full saved-search/query behavior.
- CI live-mock proof and `submission-evidence/live-mock/`.

## Verification

- Focused mock MCP server tests.
- `npm run build`.
- `npm run audit:package-readiness` if package exports change.
- Built CLI stdio smoke for initialize, tools/list, `splunk_get_info`, and
  `splunk_get_knowledge_objects`.

## Result

First slice implemented. `mock-splunk-mcp` initializes over stdio, lists two
read-only Splunk tools, returns fixture deployment info, returns fixture
knowledge objects, and reports no mutation. Full `--live-mock` workflow wiring
remains deferred to the next Move 147 slice.
