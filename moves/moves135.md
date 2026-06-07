# Move 135 - Splunk MCP Transcript Compatibility

## Intent

Make external MCP transcript certification tolerate the field shapes emitted by
real Splunk MCP clients without weakening deterministic grading:

- saved-search calls may use `saved_search_name` instead of `name`;
- result payloads may report `total_rows` / `totalRows` instead of
  `resultCount`;
- inline transcript certification should create its output directory before
  writing uploaded transcript artifacts.

## Scope

- Update MCP transcript import evidence collection and saved-search provenance.
- Add focused MCP server tests for the real Splunk MCP field aliases and nested
  output directories.
- Do not add or claim external-client screencast evidence in this move.
- Do not make LLM/SAIA output authoritative for pass/fail readiness.
- Do not mutate Splunk.

## Verification

- `npx vitest run tests/mcp/server.test.ts --testNamePattern "path-based MCP transcript certification|saved_search_name|inline MCP transcript"`
- `npm run check`

## Status

Implemented and verified on 2026-06-07.
