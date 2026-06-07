# Move 133 - SAIA Cloud Route Blocker

## Intent

Make hosted-model diagnostics truthful for the current operator-owned Splunk
deployment. The previous `SAIA_ROUTE_NOT_FOUND` result was too broad: after
restart, the local Splunk AI Assistant routes are served by splunkd, but the
hosted-model calls still return a downstream cloud 404.

## Scope

- Keep hosted-model assistance advisory only; deterministic rules remain the
  pass/fail authority.
- Add `SAIA_CLOUD_ROUTE_NOT_FOUND` as a distinct hosted-model blocker class.
- Probe the actual local SAIA app routes:
  `/generatespl`, `/explainspl`, `/optimizespl`, and `/tellme`.
- Treat non-auth, non-404 GET responses as route-present evidence because this
  probe is checking registration, not successful model invocation.
- Preserve `SAIA_REST_HANDLERS_NOT_REGISTERED` only when local SAIA routes
  return 404.
- Update operator docs so restart/reinstall guidance is not applied to a cloud
  tenant/provisioning blocker.

## Verification

- `npx tsc --noEmit`
- `npx vitest run tests/cli/flow.test.ts tests/workflows/hosted-model-actions.test.ts --testNamePattern "hosted-model|SAIA|REST handlers"`
- `npm run build`
- `NODE_TLS_REJECT_UNAUTHORIZED=0 node dist/src/cli.js hosted-model-diagnostic --mode live --env-file ./.splunkready-live.env --out artifacts/live-hosted-model-diagnostic --json`

## Result

The live diagnostic remains blocked, but the blocker is now specific:

- `hosted-model-diagnostic.status`: `BLOCKED`
- `mutation`: `false`
- `blockerClass`: `SAIA_CLOUD_ROUTE_NOT_FOUND`
- local route probe: `PASS`
- probed local routes: `/generatespl`, `/explainspl`, `/optimizespl`, `/tellme`
- advertised tools: all four `saia_*` hosted-model tools
- blocked tools: all four `saia_*` hosted-model tools

This means SplunkReady should not keep sending the operator back to the local
MCP endpoint or local app reinstall path for this deployment state. The next
operator-side fix is tenant/cloud hosted-model provisioning or cloud-connect
activation for the SAIA v2 SPL hosted-model endpoints.
