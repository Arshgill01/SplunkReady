# Move 129 - SAIA MCP Env Alias Readiness

## Why

The live hosted-model diagnostic still showed the dedicated SAIA route as
missing after Move 128. Splunk's MCP setup language centers on an MCP endpoint
and token, so an operator can reasonably copy those values into env names that
use `SAIA_MCP_*` rather than the canonical `SPLUNKREADY_SAIA_ENDPOINT` and
`SPLUNKREADY_SAIA_TOKEN` names.

## Scope

- Accept `SPLUNKREADY_SAIA_MCP_URL` as an alias for
  `SPLUNKREADY_SAIA_ENDPOINT`.
- Accept `SPLUNKREADY_SAIA_MCP_TOKEN` as an alias for
  `SPLUNKREADY_SAIA_TOKEN`.
- Keep canonical names in diagnostics while recording alias names and
  `sourceName` only when an alias is the source.
- Do not write endpoint or token values to artifacts.
- Update README and live setup checklist copy for the alias names.

## Files

- `src/adapters/live.ts`
- `src/workflows/hosted-model-actions.ts`
- `tests/adapters/live.test.ts`
- `tests/cli/flow.test.ts`
- `README.md`
- `docs/live-setup-checklist.md`
- `moves/README.md`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Verification

- `npx tsc --noEmit`
- `npx vitest run tests/adapters/live.test.ts tests/cli/flow.test.ts tests/workflows/hosted-model-actions.test.ts --testNamePattern "SAIA|hosted-model|hosted model|dedicated|env file|live Splunk adapter|MCP alias"`
- `npm run build && rm -rf artifacts/live-hosted-model-diagnostic && NODE_TLS_REJECT_UNAUTHORIZED=0 node dist/src/cli.js hosted-model-diagnostic --mode live --env-file ./.splunkready-live.env --out artifacts/live-hosted-model-diagnostic --require-pass true --json`
- `jq '{status, mutation, mode, blockerClass, hostedModelTransport: .setup.hostedModelTransport, requiredEnv: [.setup.requiredEnvironment[] | {name, status}], optionalEnv: [.setup.optionalEnvironment[] | {name, aliases, sourceName, status}], passedTools, blockedTools, toolResults: [.toolResults[]? | {toolName, status, contractAdvertised}], remediation: {status: .remediation.status, blockerClass: .remediation.blockerClass}}' artifacts/live-hosted-model-diagnostic/hosted-model-diagnostic.json`
- `npm run check`
- `git diff --check`

## Result

The code accepts SAIA MCP URL/token aliases and verifies the alias path through
adapter and CLI env-file tests. The current ignored env file still reports both
canonical names and aliases as missing, so the live diagnostic remains
`SAIA_ROUTE_NOT_FOUND` on the shared Splunk MCP endpoint. No live SAIA PASS is
claimed.
