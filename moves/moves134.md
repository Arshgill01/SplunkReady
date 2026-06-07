# Move 134 - MCP Operator Live Hosted-Model Status

## Intent

Make the MCP proof honest about the current operator-owned SAIA state without
weakening the credential-free fixture proof. The MCP proof should still show
hosted-model access in the fixture path, but it must also surface the latest
redacted live diagnostic when one exists.

## Scope

- Do not run live calls from `mcp-proof`.
- Do not read, source, print, or commit `.splunkready*` or `.env*` secret
  contents.
- Read only the redacted live diagnostic artifact at
  `artifacts/live-hosted-model-diagnostic/hosted-model-diagnostic.json`.
- Add an `operatorLiveHostedModelStatus` block to the MCP proof summary.
- Keep SAIA advisory only; deterministic rules remain authoritative.
- Surface the operator-live status in the Vite workbench MCP route.
- Refresh tracked MCP proof evidence and Playwright screenshot evidence.

## Verification

- `npm run mcp-proof`
- `jq -e '.operatorLiveHostedModelStatus | tostring | (contains("Bearer") or contains("https://") or contains("SPLUNKREADY_SPLUNK_MCP_TOKEN") or contains("SPLUNKREADY_SAIA_TOKEN") | not)' artifacts/mcp-proof/mcp-proof-summary.json`
- `npx tsc --noEmit`
- `npx vitest run tests/cli/flow.test.ts tests/mcp/server.test.ts tests/ui/app.test.ts --testNamePattern "MCP|mcp-proof|mcp proof|hosted-model|hosted model"`
- `npx vitest run tests/cli/flow.test.ts tests/mcp/server.test.ts tests/ui/app.test.ts tests/scripts/submission-copy-audit.test.ts --testNamePattern "MCP|mcp-proof|mcp proof|hosted-model|hosted model|submission copy"`
- `npm run ui:build`
- `npm run public-demo:build`
- `npm run audit:public-demo-export`
- Playwright CLI against `http://127.0.0.1:4174/?artifacts=artifacts%2Fmcp-proof#mcp-proof`
- `npm run check`

## Result

The tracked MCP proof now distinguishes:

- credential-free fixture hosted-model access: `PASS`;
- operator-live hosted-model status: `BLOCKED`;
- operator-live blocker: `SAIA_CLOUD_ROUTE_NOT_FOUND`;
- local route probe: `PASS`;
- available live SAIA tools: all four `saia_*` tools;
- blocked live SAIA tools: all four `saia_*` tools;
- `mutation`: `false`;
- `deterministicAuthority`: `true`;
- `safeForPublicExport`: `true`.

The public MCP workbench route renders this as a separate operator-live block,
so judges do not have to infer the difference between the fixture MCP proof and
the current live SAIA/cloud blocker.
