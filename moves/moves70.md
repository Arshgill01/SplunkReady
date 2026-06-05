# Move 70: MCP Boundary Proof Evidence

## Trigger

The user clarified that the Best Use of MCP story should not depend on merely
building a local MCP server. The stronger story is using and certifying behavior
at the Splunk MCP Server boundary: captured `splunk_*` tool calls become
deterministic Readiness Receipts.

## Scope

- Extend `mcp-proof` so its summary includes an explicit
  `splunkMcpBoundary` block.
- Parse the certified Splunk MCP JSON-RPC transcript to record:
  - certified `splunk_*` tool names;
  - saved-search execution;
  - evidence refs;
  - generated receipt path;
  - deterministic authority;
  - no mutation.
- Update README copy so the MCP proof is positioned as Splunk MCP behavior
  certification, not as a Splunk search copilot or a local-server-only demo.
- Add/extend tests for the new boundary evidence.

## Boundaries

- Do not make LLM or SAIA output authoritative.
- Do not remove deterministic checks.
- Do not add Splunk write operations.
- Do not read, source, print, or commit `.env*` or `.splunkready*` files.
- Do not change UI source; Playwright is not required.
- Do not use subagents.

## Acceptance

- `mcp-proof-summary.json` contains `splunkMcpBoundary`.
- The boundary block proves the certified transcript includes
  `splunk_run_saved_search` and evidence refs.
- The boundary block records deterministic authority and `mutation: false`.
- Focused MCP proof tests pass.
- Full `npm run check` passes.
