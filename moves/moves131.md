# Move 131 - SAIA Cloud MCP Alias and Header Readiness

## Scope

Increase the value of the MCP and hosted-model track by making live SAIA routing
match more realistic operator MCP configuration shapes without reading or
printing ignored secret files.

## Changes

- Added supported dedicated SAIA endpoint/token aliases:
  - `SAIA_MCP_URL` / `SAIA_MCP_TOKEN`
  - `SPLUNK_AI_ASSISTANT_MCP_URL` / `SPLUNK_AI_ASSISTANT_MCP_TOKEN`
  - `SPLUNKREADY_HOSTED_MODEL_MCP_URL` / `SPLUNKREADY_HOSTED_MODEL_MCP_TOKEN`
- Added core Splunk MCP aliases:
  - `SPLUNK_MCP_URL` / `SPLUNK_MCP_TOKEN`
- Added optional dedicated SAIA/cloud headers for hosted-model calls only:
  - `SPLUNKREADY_SAIA_REALM` / `SAIA_REALM` / `SPLUNK_REALM`
  - `SPLUNKREADY_SAIA_TENANT` / `SAIA_TENANT` / `SPLUNK_TENANT`
  - `SPLUNKREADY_SAIA_SF_TOKEN` / `SAIA_SF_TOKEN` / `SPLUNK_SF_TOKEN`
- Kept core `splunk_*` calls on the core Splunk MCP endpoint.
- Kept `saia_*` calls on the dedicated SAIA endpoint only when endpoint and
  token are configured.
- Updated MCP client-config resources, README, live setup docs, claim ledger,
  and submission-copy guards so public evidence exposes the supported aliases.
- Regenerated tracked MCP proof evidence and the public demo export.

## Verification

- `npx tsc --noEmit`
- `npx vitest run tests/adapters/live.test.ts tests/workflows/hosted-model-actions.test.ts tests/cli/flow.test.ts --testNamePattern "hosted-model|SAIA|live config|cloud headers|MCP aliases|dedicated hosted-model"`
- `npx vitest run tests/adapters/live.test.ts tests/workflows/hosted-model-actions.test.ts tests/mcp/server.test.ts tests/cli/flow.test.ts tests/scripts/submission-copy-audit.test.ts --testNamePattern "hosted-model|SAIA|live config|cloud headers|MCP aliases|dedicated hosted-model|client config|MCP proof|mcp-proof|submission copy"`
- `npm run mcp-proof && node dist/src/cli.js mcp-proof --out submission-evidence/mcp-proof --json && npm run public-demo:build`
- `NODE_TLS_REJECT_UNAUTHORIZED=0 node dist/src/cli.js hosted-model-diagnostic --mode live --env-file ./.splunkready-live.env --out artifacts/live-hosted-model-diagnostic --require-pass true --json`
- Playwright opened `http://127.0.0.1:4182/?artifacts=artifacts%2Fmcp-proof#mcp-proof`, took a snapshot, checked console output, and browser-verified the exported MCP proof JSON includes `mcp-remote`, `SPLUNKREADY_SPLUNK_MCP_URL`, `Authorization: Bearer ${SPLUNKREADY_SPLUNK_MCP_TOKEN}`, `SAIA_MCP_URL`, `SPLUNK_AI_ASSISTANT_MCP_URL`, `SPLUNKREADY_SAIA_REALM`, and `SPLUNKREADY_SAIA_TENANT`.

## Result

- Focused tests passed.
- MCP proof and public demo export passed.
- Playwright verification passed with zero console errors and no artifact
  failure.
- Live hosted-model diagnostic remains `BLOCKED` with
  `SAIA_ROUTE_NOT_FOUND`; the ignored env file still reports all supported
  dedicated SAIA endpoint/token names as missing, so runtime stays on
  `shared-splunk-mcp`.
- `mutation: false`.
- Did not read, source, print, or commit `.splunkready*` or `.env*` secret
  contents.
