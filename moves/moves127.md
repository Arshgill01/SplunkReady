# Move 127 - Dedicated SAIA MCP Routing

## Why

The operator-owned live hosted-model diagnostic reached the live Splunk MCP
endpoint after the cloud connection/token setup, but all four advertised SAIA
tools still returned route-not-found at invocation time. The code assumed SAIA
hosted-model calls shared the same endpoint and token as core Splunk MCP calls.
That blocks setups where Splunk AI Assistant/cloud hosted-model calls are served
through a separate MCP endpoint.

## Scope

- Add optional `SPLUNKREADY_SAIA_ENDPOINT` and `SPLUNKREADY_SAIA_TOKEN`
  support.
- Route only `saia_*` calls to the dedicated SAIA target when both values are
  present.
- Keep `splunk_*` inventory/search calls on `SPLUNKREADY_SPLUNK_MCP_URL` and
  `SPLUNKREADY_SPLUNK_MCP_TOKEN`.
- Record secret-safe hosted-model routing status in live diagnostic artifacts:
  `shared-splunk-mcp` or `dedicated-saia-mcp`.
- Update SAIA route-not-found remediation to point operators at the dedicated
  endpoint/token path.
- Document the setup in README and the live setup checklist.

## Files

- `src/adapters/live.ts`
- `src/workflows/hosted-model-actions.ts`
- `tests/adapters/live.test.ts`
- `tests/workflows/hosted-model-actions.test.ts`
- `tests/cli/flow.test.ts`
- `README.md`
- `docs/live-setup-checklist.md`
- `moves/README.md`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Verification

- `npx tsc --noEmit`
- `npx vitest run tests/adapters/live.test.ts tests/workflows/hosted-model-actions.test.ts tests/cli/flow.test.ts --testNamePattern "SAIA|hosted-model|hosted model|dedicated|env file|live Splunk adapter"`
- `npm run build`
- `NODE_TLS_REJECT_UNAUTHORIZED=0 node dist/src/cli.js hosted-model-diagnostic --mode live --env-file ./.splunkready-live.env --out artifacts/live-hosted-model-diagnostic --require-pass true --json`
- `npx vitest run tests/adapters/live.test.ts tests/workflows/hosted-model-actions.test.ts tests/cli/flow.test.ts`
- `npm run check`

## Result

The implementation is verified locally. The live diagnostic remains honestly
blocked because the ignored env file currently reports
`SPLUNKREADY_SAIA_ENDPOINT` and `SPLUNKREADY_SAIA_TOKEN` as missing, so the live
run still uses `shared-splunk-mcp` and returns `SAIA_ROUTE_NOT_FOUND`.

Do not claim live SAIA PASS until the operator-owned ignored env file contains
the dedicated SAIA endpoint/token, or the shared endpoint itself can invoke all
four `saia_*` tools successfully.
