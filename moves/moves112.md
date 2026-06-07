# Move 112 - Inline MCP Transcript Certification

## Goal

Strengthen the MCP award track by letting MCP clients certify a captured
transcript directly from JSONL content, not only from a local file path.

## Scope

- Add `splunkready_certify_mcp_transcript_content` to the SplunkReady MCP
  server.
- Keep the new tool read-only and non-mutating.
- Reject inline transcript content that appears to contain secrets before
  writing proof artifacts.
- Extend `mcp-proof` so the recorded stdio MCP client session certifies the
  same captured Splunk MCP transcript through both the path-based tool and the
  inline-content tool.
- Surface inline transcript certification in the MCP proof summary, public
  workbench route, submission evidence, and claim ledger.
- Refresh tracked MCP proof evidence, screenshot, and evidence hashes.

## Verification

- `npx tsc --noEmit`
- `npx vitest run tests/mcp/server.test.ts`
- `npx vitest run tests/ui/app.test.ts --testNamePattern "MCP proof"`
- `npx vitest run tests/cli/flow.test.ts --testNamePattern "MCP server proof"`
- `npm run build`
- `node dist/src/cli.js mcp-proof --out submission-evidence/mcp-proof --json`
- `node dist/src/cli.js verify-manifest --out submission-evidence/mcp-proof/mcp-transcript-certification --json`
- `node dist/src/cli.js verify-manifest --out submission-evidence/mcp-proof/mcp-inline-transcript-certification --json`
- `npm run public-demo:build`
- Playwright open/snapshot/screenshot for
  `?artifacts=artifacts%2Fmcp-proof#mcp-proof`
- `npm run audit:public-demo-export`
- `npm run audit:submission-copy`
- `shasum -a 256 -c submission-evidence/evidence-pack-sha256.txt`
- `git diff --check`
- `npm run check`

## Boundaries

- Do not make an LLM or SAIA authoritative for pass/fail readiness.
- Do not mutate Splunk.
- Do not read, source, print, or commit `.splunkready*` or `.env*` files.
- Do not add a dependency.
- Do not use subagents.
