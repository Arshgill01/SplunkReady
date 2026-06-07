# Move 143 - MCP Composition Review Tool

## Intent

Strengthen the Best Use of MCP story by making the two-server Splunk MCP plus
SplunkReady MCP composition review callable through the SplunkReady MCP server,
not only summarized by the proof workflow.

## Scope

- Add a deterministic, read-only MCP composition review implementation.
- Expose `splunkready_review_mcp_composition` from the MCP stdio server.
- Call the tool from `npm run mcp-proof` against the checked-in captured Splunk
  MCP transcript and dual-server client config.
- Surface the review result in MCP proof JSON, Markdown, workbench artifact
  parsing, tests, and submission evidence.
- Guard public submission copy so the composition-review tool cannot disappear
  from the claim ledger silently.

## Verification

- `npm view splunkready version dist-tags --json`
- `tmp=$(mktemp -d /tmp/splunkready-publish-smoke-XXXXXX) && cd "$tmp" && npx -y splunkready@latest judge-proof --out ./judge-proof --json`
- `npx vitest run tests/mcp/server.test.ts`
- `npx vitest run tests/cli/flow.test.ts --testNamePattern "one-command MCP server proof"`
- `npx vitest run tests/scripts/submission-copy-audit.test.ts`
- `npm run mcp-proof`
- `npm run audit:submission-copy`
- `npm run audit:public-demo-export`
- `npm run check`

## Result

The MCP proof now exposes `splunkready_review_mcp_composition` as a read-only
tool. The generated proof reports 6 MCP tools, `mcpCompositionReview.status:
"PASS"`, `score: 100`, certified Splunk tool names
`splunk_get_knowledge_objects` and `splunk_run_saved_search`, evidence refs
`evt-102`, `evt-118`, and `evt-141`, deterministic authority, and
`mutation=false`.
