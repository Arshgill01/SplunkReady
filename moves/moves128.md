# Move 128 - MCP Client Config SAIA Routing Evidence

## Why

Move 127 added dedicated SAIA/cloud MCP routing for `saia_*` calls, but the MCP
client-config resources still did not show operators how to wire the dedicated
SAIA endpoint and token into Claude Desktop, Cursor, or the dual Splunk MCP plus
SplunkReady workflow. That left the MCP and SAIA story weaker than the live
adapter code.

## Scope

- Add `SPLUNKREADY_SAIA_ENDPOINT` and `SPLUNKREADY_SAIA_TOKEN` placeholders to
  MCP client-config resources.
- Keep core `splunk_*` calls on `SPLUNKREADY_SPLUNK_MCP_URL` and
  `SPLUNKREADY_SPLUNK_MCP_TOKEN`.
- Add `hostedModelDiagnosticTool` and hosted-model routing guidance to the MCP
  client-config resources.
- Refresh tracked MCP proof evidence and public demo export.
- Add submission-copy audit coverage for the dedicated SAIA MCP client-routing
  claim.

## Files

- `src/mcp/server.ts`
- `tests/mcp/server.test.ts`
- `tests/cli/flow.test.ts`
- `scripts/audit-submission-copy.mjs`
- `tests/scripts/submission-copy-audit.test.ts`
- `submission-evidence/claim-ledger.md`
- `submission-evidence/mcp-proof/mcp-client-session.jsonl`
- `submission-evidence/mcp-proof/mcp-proof-summary.json`
- `moves/README.md`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Verification

- `npx tsc --noEmit`
- `npx vitest run tests/mcp/server.test.ts tests/cli/flow.test.ts --testNamePattern "client config|MCP proof|hosted-model|SAIA|mcp-proof"`
- `npm run mcp-proof && node dist/src/cli.js mcp-proof --out submission-evidence/mcp-proof --json && npm run public-demo:build`
- Playwright opened `http://127.0.0.1:4182/?artifacts=artifacts%2Fmcp-proof#mcp-proof`
- Playwright browser eval verified exported MCP proof JSON includes
  `SPLUNKREADY_SAIA_ENDPOINT`, `SPLUNKREADY_SAIA_TOKEN`, and
  `splunkready_check_hosted_model_access` with no artifact failure
- `npx vitest run tests/mcp/server.test.ts tests/cli/flow.test.ts tests/scripts/submission-copy-audit.test.ts`
- `npm run check`
- `git diff --check`

## Result

The MCP client-config resources now show how an external MCP client can run
SplunkReady beside the existing Splunk MCP Server while routing only hosted
model `saia_*` calls through the dedicated SAIA/cloud target when needed. The
evidence remains secret-safe: the tracked resources contain placeholders, not
operator tokens.
