# MCP Proof Route Schema Drift ExecPlan

## Goal

Restore the MCP proof route as a reliable judge-visible surface for the current
tracked MCP evidence. The route must load
`submission-evidence/mcp-proof/mcp-proof-summary.json`, render the live mock
Splunk MCP session, and avoid the `Artifact load failed` state that appeared
during installed Splunk Web route exploration.

## Current Reality

- Move 205 proved the installed Splunk app renders, but route exploration found
  the packaged/public `mcp-proof` artifact route failed on the current MCP proof
  summary.
- The tracked MCP proof summary includes a `liveMockSplunkMcp` block produced by
  the MCP workflow.
- The UI schema did not accept that block, and the existing UI tests only used
  an older synthetic MCP proof fixture.

## Design

1. Keep the MCP proof generator unchanged.
2. Extend the UI MCP proof schema to accept the workflow's
   `liveMockSplunkMcp` contract, with a default `NOT_REQUESTED` block for older
   summaries.
3. Render a dedicated `Live mock Splunk MCP` panel with route state, tools,
   evidence refs, saved-search execution, frame counts, deterministic
   authority, and mutation boundary.
4. Add a regression test that loads the real tracked
   `submission-evidence/mcp-proof/mcp-proof-summary.json`.
5. Verify the hosted-style static route with Playwright and capture public-safe
   screenshots.

## Stop Conditions

- Stop before weakening schema validation to a broad passthrough.
- Stop before changing MCP evidence semantics to satisfy the UI.
- Stop before adding a browser automation dependency to `package.json`.
- Stop before tracking any secret-bearing browser output.

## Verification

- Focused Vitest regression for the tracked MCP proof artifact.
- Full UI test file.
- Public-demo rebuild and audit.
- Playwright route check against the static export.
- Evidence-pack hash regeneration and canonical `npm run check`.
