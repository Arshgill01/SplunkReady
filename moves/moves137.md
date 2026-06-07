# Move 137 - SAIA Ask Route Diagnostic Alignment

## Intent

Align the live hosted-model diagnostic with the current Splunk AI Assistant ask
route shape and remove stale `/tellme` probe evidence from current-source
artifacts.

## Scope

- Probe `/servicesNS/-/Splunk_AI_Assistant_Cloud/ask` for the
  `saia_ask_splunk_question` local REST handler.
- Keep hosted-model output advisory only; deterministic rules remain the
  pass/fail authority.
- Keep the diagnostic read-only and non-mutating.
- Do not read, print, or commit `.splunkready*` secret values.

## Verification

- `npx vitest run tests/cli/flow.test.ts --testNamePattern "hosted-model-diagnostic|SAIA"`
- `npm run build`
- `NODE_TLS_REJECT_UNAUTHORIZED=0 node dist/src/cli.js hosted-model-diagnostic --mode live --env-file .splunkready-live.env --out artifacts/live-hosted-model-diagnostic --require-pass false --json`

## Result

The focused regression passed. The operator-owned live diagnostic remains
`BLOCKED` and `mutation: false`. The live route probe now checks `/ask`; the
current deployment serves the SAIA namespace plus generate/explain/optimize
routes, but `/ask` returns 404. SplunkReady therefore reports
`SAIA_REST_HANDLERS_NOT_REGISTERED` for the current canonical ask route instead
of claiming live SAIA hosted-model PASS.
