# Move 92: MCP Client Walkthrough Evidence

## Goal

Reduce the Best Use of MCP cap by making the proof show an MCP client workflow
that uses the existing Splunk MCP Server before SplunkReady certification.

## Scope

- Add generated MCP client walkthrough JSON and Markdown artifacts to
  `mcp-proof`.
- Keep Splunk MCP positioned as the read-only investigation server and
  SplunkReady MCP as the deterministic certification server.
- Refresh tracked credential-free `submission-evidence/mcp-proof`.
- Require the walkthrough files in the public demo export audit.
- Regenerate the submission evidence SHA-256 ledger.

## Non-goals

- Do not add another MCP tool just to increase tool count.
- Do not claim a live public MCP-client screencast.
- Do not read, source, print, or commit `.splunkready*` or `.env*` files.
- Do not make LLM, SAIA, or MCP output authoritative for pass/fail.
- Do not introduce Splunk write operations or auto-mutation.

## Expected verification

- `npx tsc --noEmit`
- `npx vitest run tests/cli/flow.test.ts --testNamePattern "one-command MCP server proof"`
- `npm run mcp-proof`
- `npm run splunkready -- verify-manifest --out artifacts/mcp-proof/mcp-transcript-certification --json`
- `shasum -a 256 -c submission-evidence/evidence-pack-sha256.txt`
- `npm run audit:public-demo-export`
- `npm run audit:submission-copy`
- `npm run check`
- `git diff --check`
