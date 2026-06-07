# Move 156 - SAIA Partial Route And Trial Compatibility Evidence

## Intent

The operator-owned Splunk MCP endpoint advertises all four SAIA hosted-model
tools, but the live diagnostic now shows a more specific blocker than total app
handler absence: some `Splunk_AI_Assistant_Cloud` routes are served by splunkd
while the current `ask` route is not, and all four hosted-model tool calls still
return not found. Classify this as partial route registration and make the
Splunk Trial compatibility boundary explicit for operators.

## Scope

- Add a distinct `SAIA_REST_HANDLERS_PARTIALLY_REGISTERED` blocker class.
- Treat mixed SAIA management-route results as `PARTIALLY_REGISTERED` instead
  of collapsing them into total handler absence.
- Add a regression test for the current live shape: namespace plus
  generate/explain/optimize routes present, ask route missing, all hosted-model
  tool calls blocked.
- Update live setup docs and public-safe evidence so the current operator-live
  status is precise.
- Record Splunk's published limitation that Splunk AI Assistant is not
  compatible with Splunk Trial stacks, without claiming that this alone is the
  proven root cause.

## Non-Goals

- Do not claim live SAIA hosted-model PASS while all four SAIA tools are blocked.
- Do not commit raw live diagnostic artifacts, endpoints, tokens, or env files.
- Do not bypass the local Splunk MCP Server by making a direct cloud endpoint
  workaround look like a deployment fix.
- Do not make SAIA or any LLM authoritative for readiness verdicts.
- Do not mutate Splunk or auto-remediate installed Splunk apps.

## Verification

- `npx vitest run tests/cli/flow.test.ts --testNamePattern "hosted-model|SAIA|partially registered"`
- `npm run build >/tmp/splunkready-hosted-build-move156.log && NODE_TLS_REJECT_UNAUTHORIZED=0 node dist/src/cli.js hosted-model-diagnostic --mode live --env-file ./.splunkready-live.env --out artifacts/live-hosted-model-diagnostic --json >/tmp/splunkready-hosted-model-diagnostic-move156.json`
- `node scripts/audit-live-hosted-model-status.mjs --artifact artifacts/live-hosted-model-diagnostic/hosted-model-diagnostic.json --env-file ./.splunkready-live.env --out submission-evidence/live-hosted-model-status/live-hosted-model-status.json --require-blocked --expect-blocker SAIA_REST_HANDLERS_PARTIALLY_REGISTERED`
- `node dist/src/cli.js mcp-proof --out submission-evidence/mcp-proof --live-mock --json`
- `npm run audit:submission-copy`
- `npm run check`

## Result

Implemented. The tracked safe summary reports:

- `status: "BLOCKED"`
- `blockerClass: "SAIA_REST_HANDLERS_PARTIALLY_REGISTERED"`
- `restHandlerProbeStatus: "PARTIALLY_REGISTERED"`
- all four SAIA tools advertised and blocked
- `redactionAudit.status: "PASS"`
- `rawArtifactTracked: false`
- `mutation: false`

The raw diagnostic remains ignored under `artifacts/live-hosted-model-diagnostic/`.
The current evidence says live hosted-model access is still blocked. The most
likely next operator checks are app route alignment, Splunk restart/reinstall,
and tenant/provisioning validation, including whether the deployment is a
Splunk Trial stack.
