# ExecPlan: Splunk App Currentness Refresh

Created: 2026-06-08

## Objective

Refresh the Splunk app and Splunkbase readiness evidence so the local
Use-of-Splunk package surface tracks the current source version, while keeping
public approval claims honest.

## Current Reality

- The source package metadata is `0.1.7`.
- The public npm package is still `0.1.5` because npm publish is blocked on
  operator OTP.
- The tracked Splunk app package and Splunkbase readiness artifacts still point
  at `submission-evidence/splunk-app-package/SplunkReady-0.1.6.spl`.
- The package builder already derives `.spl` version from `package.json`, but
  README, Devpost, claim-ledger, AppInspect, readiness, listing dossier, and
  some guardrails still cite the old archive.

## Strategy

1. Rebuild the public demo and Splunk app package with the current source
   version.
2. Run AppInspect precertification on the refreshed `.spl`.
3. Regenerate Splunkbase readiness and listing-dossier evidence.
4. Update public copy and claim guards to cite `SplunkReady-0.1.7.spl` without
   claiming Splunkbase approval.
5. Keep npm public-package currentness separate: npm remains stale until OTP
   publish succeeds.

## Non-Goals

- Do not submit to Splunkbase or Splunk Cloud from automation.
- Do not claim "Available on Splunkbase".
- Do not run hidden/default live mutations. A live install-proof refresh is
  allowed only when explicitly operator-approved with `--confirm-install true`,
  the operator-owned env file, and tracked redaction evidence.
- Do not update public npm claims to `0.1.7`.
- Do not make AppInspect, MCP, LLM, or SAIA output authoritative for Readiness
  Receipt verdicts.

## Expected Files

- `moves/moves204.md`
- `docs/execplans/splunk-app-currentness-refresh.md`
- `README.md`
- `docs/devpost-submission.md`
- `docs/splunkbase-listing-dossier.md`
- `scripts/audit-splunkbase-readiness.mjs`
- `scripts/audit-submission-copy.mjs`
- focused tests under `tests/scripts/`
- `submission-evidence/splunk-app-package/*`
- `submission-evidence/splunkbase-readiness/*`
- `submission-evidence/README.md`
- `submission-evidence/claim-ledger.md`
- `submission-evidence/evidence-pack-sha256.txt`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Verification

- `npm run splunk-app:package`
- `tar -tzf submission-evidence/splunk-app-package/SplunkReady-0.1.7.spl`
- `uvx splunk-appinspect inspect submission-evidence/splunk-app-package/SplunkReady-0.1.7.spl --mode precert --data-format json --output-file submission-evidence/splunkbase-readiness/appinspect-precert.json`
- `npm run audit:splunkbase-readiness`
- `npm run audit:splunkbase-listing-dossier`
- `NODE_TLS_REJECT_UNAUTHORIZED=0 node dist/src/cli.js splunk-app-install-proof --out submission-evidence/splunk-app-install --app-package submission-evidence/splunk-app-package/SplunkReady-0.1.7.spl --env-file ./.splunkready-live.env --confirm-install true --json`
- `npx vitest run tests/scripts/splunk-app-package.test.ts tests/scripts/splunkbase-readiness.test.ts tests/scripts/submission-copy-audit.test.ts`
- `npm run audit:submission-copy`
- evidence-pack SHA-256 regeneration and verification
- `npm run check`

## Stop Conditions

- Stop before any external Splunkbase upload.
- Stop if AppInspect reports an error, failure, or unexpected warning requiring
  product or package changes outside this currentness refresh.
- Stop if npm publish is needed; Move 202 already records the OTP blocker.
