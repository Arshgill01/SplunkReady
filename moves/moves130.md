# Move 130 - Splunk MCP Remote Client Config Evidence

## Why

The MCP client-config resources still used generic
`<existing-splunk-mcp-server-command>` placeholders for the existing Splunk MCP
Server. That made the two-server MCP workflow less copy-pastable than Splunk's
own sample client configuration and weakened the MCP-category story.

## Scope

- Use an `npx -y mcp-remote` template for the existing Splunk MCP Server side
  of the dual-server, Claude Desktop, and Cursor client-config resources.
- Keep all endpoint/token values as placeholders:
  `${SPLUNKREADY_SPLUNK_MCP_URL}` and
  `Authorization: Bearer ${SPLUNKREADY_SPLUNK_MCP_TOKEN}`.
- Keep SplunkReady's MCP server entrypoint as source-clone `npm run mcp` until
  npm latest includes the current MCP entrypoint.
- Include canonical and alias SAIA placeholders in the same client resources.
- Regenerate tracked MCP proof evidence and public demo export.
- Add claim-ledger and submission-copy audit coverage for the `mcp-remote`
  client-config claim.

## Files

- `src/mcp/server.ts`
- `tests/mcp/server.test.ts`
- `tests/cli/flow.test.ts`
- `scripts/audit-submission-copy.mjs`
- `tests/scripts/submission-copy-audit.test.ts`
- `README.md`
- `submission-evidence/claim-ledger.md`
- `submission-evidence/mcp-proof/mcp-client-session.jsonl`
- `submission-evidence/mcp-proof/mcp-proof-summary.json`
- `moves/README.md`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Verification

- `npx tsc --noEmit`
- `npx vitest run tests/mcp/server.test.ts tests/cli/flow.test.ts tests/scripts/submission-copy-audit.test.ts`
- `npm run mcp-proof && node dist/src/cli.js mcp-proof --out submission-evidence/mcp-proof --json && npm run public-demo:build`
- Playwright opened `http://127.0.0.1:4182/?artifacts=artifacts%2Fmcp-proof#mcp-proof`
- Playwright console reported 0 errors and 0 warnings
- Playwright browser eval verified the exported MCP proof JSON includes
  `mcp-remote`, `SPLUNKREADY_SPLUNK_MCP_URL`,
  `Authorization: Bearer ${SPLUNKREADY_SPLUNK_MCP_TOKEN}`,
  `SPLUNKREADY_SAIA_MCP_URL`, and `SPLUNKREADY_SAIA_MCP_TOKEN` with no artifact
  failure
- `npm run check`
- `git diff --check`

## Result

External MCP client resources now show a concrete Splunk MCP `mcp-remote`
template beside the local SplunkReady MCP source-clone entrypoint. The evidence
remains credential-free and does not claim that the currently published
`splunkready@0.1.0` package includes the MCP entrypoint.
