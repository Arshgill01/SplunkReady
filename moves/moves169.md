# Move 169 - Developer License Hosted-Model Remediation

## Intent

Use the operator-provided Splunk Developer Personal License to test whether the
current live SAIA hosted-model blocker is caused by the previous trial license
state, then capture public-safe before/after evidence.

## Scope

- Confirm the license file exists without writing license contents into logs.
- Run the strict live hosted-model diagnostic before license application.
- Apply the developer license to the operator-owned local Splunk instance using
  explicit credentials from the ignored live env file.
- Restart/probe Splunk when the license install requires it.
- Rerun the strict live hosted-model diagnostic and classify the result.
- Refresh tracked public-safe hosted-model status evidence only; do not commit
  license contents, credentials, endpoints, usernames, passwords, or tokens.

## Non-Goals

- Do not make SAIA/LLM output authoritative for readiness.
- Do not include hosted-model proof in the default credential-free judge path.
- Do not claim live hosted-model PASS unless
  `hosted-model-diagnostic --require-pass true` exits successfully.
- Do not claim Splunkbase/Splunk Cloud approval.

## Expected Files

- `moves/moves169.md`
- `submission-evidence/live-hosted-model-status/live-hosted-model-status.json`
- `submission-evidence/live-hosted-model-status/developer-license-remediation.json`
- `submission-evidence/claim-ledger.md`
- `submission-evidence/evidence-pack-sha256.txt`
- `docs/live-setup-checklist.md`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Verification

- `NODE_TLS_REJECT_UNAUTHORIZED=0 node dist/src/cli.js hosted-model-diagnostic --mode live --env-file ./.splunkready-live.env --out artifacts/live-hosted-model-diagnostic-before-license --require-pass true --json`
- License install/probe command, redacted in logs.
- Splunk restart/probe command, redacted in logs.
- `NODE_TLS_REJECT_UNAUTHORIZED=0 node dist/src/cli.js hosted-model-diagnostic --mode live --env-file ./.splunkready-live.env --out artifacts/live-hosted-model-diagnostic --require-pass true --json`
- `npm run audit:live-hosted-model-status`
- Redaction scan over tracked hosted-model status evidence.
- `npm run audit:submission-copy`
- `npx vitest run tests/scripts/live-hosted-model-status.test.ts tests/workflows/hosted-model-actions.test.ts`
- `npm run check`
