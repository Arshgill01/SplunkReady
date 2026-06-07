# Move 155 - Live Hosted-Model Status Redaction Evidence

## Intent

The operator-owned Splunk MCP endpoint now reaches hosted-model discovery, but
the live SAIA calls still block with `SAIA_REST_HANDLERS_NOT_REGISTERED`. Track
that state as public-safe evidence without committing raw live artifacts or
operator secrets.

## Scope

- Add a focused audit script that reads the ignored live hosted-model diagnostic
  artifact and an optional operator env file, but only writes a redacted public
  status summary.
- Fail the audit if any real endpoint, token, password, credential, or API-key
  value from the env file appears in the exported diagnostic artifacts.
- Track `submission-evidence/live-hosted-model-status/live-hosted-model-status.json`
  as the public-safe status artifact.
- Update the claim ledger and submission-copy guard so future evidence must keep
  `redactionAudit.status: "PASS"` and `rawArtifactTracked: false`.

## Non-Goals

- Do not claim live SAIA hosted-model PASS while all four SAIA tools are blocked.
- Do not commit raw `artifacts/live-hosted-model-diagnostic/*`.
- Do not change LLM/SAIA authority; deterministic rules remain pass/fail.
- Do not modify Splunk configuration or auto-remediate the Splunk app install.

## Verification

- `npx vitest run tests/scripts/live-hosted-model-status.test.ts`
- `node scripts/audit-live-hosted-model-status.mjs --artifact artifacts/live-hosted-model-diagnostic/hosted-model-diagnostic.json --env-file ./.splunkready-live.env --out submission-evidence/live-hosted-model-status/live-hosted-model-status.json --require-blocked --expect-blocker SAIA_REST_HANDLERS_NOT_REGISTERED`

## Result

Implemented. The tracked safe summary reports:

- `status: "BLOCKED"`
- `blockerClass: "SAIA_REST_HANDLERS_NOT_REGISTERED"`
- `restHandlerProbeStatus: "NOT_REGISTERED"`
- all four SAIA tools advertised and blocked
- `redactionAudit.status: "PASS"`
- `rawArtifactTracked: false`
- `mutation: false`

The raw diagnostic remains ignored under `artifacts/live-hosted-model-diagnostic/`.
