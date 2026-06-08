# ExecPlan: Splunk App Currentness Refresh

Created: 2026-06-08

## Objective

Refresh the Splunk app and Splunkbase readiness evidence so the local
Use-of-Splunk package surface tracks the current source version, while keeping
public approval claims honest.

## Current Reality

- The source package metadata is `0.1.6`.
- The public npm package is still `0.1.5` because npm publish is blocked on
  operator OTP.
- The tracked Splunk app package and Splunkbase readiness artifacts still point
  at `submission-evidence/splunk-app-package/SplunkReady-0.1.3.spl`.
- The package builder already derives `.spl` version from `package.json`, but
  README, Devpost, claim-ledger, AppInspect, readiness, listing dossier, and
  some guardrails still cite the old archive.

## Strategy

1. Rebuild the public demo and Splunk app package with the current source
   version.
2. Run AppInspect precertification on the refreshed `.spl`.
3. Regenerate Splunkbase readiness and listing-dossier evidence.
4. Update public copy and claim guards to cite `SplunkReady-0.1.6.spl` without
   claiming Splunkbase approval.
5. Keep npm public-package currentness separate: npm remains stale until OTP
   publish succeeds.

## Non-Goals

- Do not submit to Splunkbase or Splunk Cloud from automation.
- Do not claim "Available on Splunkbase".
- Do not mutate live Splunk or reinstall the app in this move.
- Do not update npm, GitHub Packages, or GitHub Release claims to `0.1.6`.
- Do not make AppInspect, MCP, LLM, or SAIA output authoritative for Readiness
  Receipt verdicts.

## Expected Files

- `moves/moves193.md`
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
- `tar -tzf submission-evidence/splunk-app-package/SplunkReady-0.1.6.spl`
- `uvx splunk-appinspect inspect submission-evidence/splunk-app-package/SplunkReady-0.1.6.spl --mode precert --data-format json --output-file submission-evidence/splunkbase-readiness/appinspect-precert.json`
- `npm run audit:splunkbase-readiness`
- `npm run audit:splunkbase-listing-dossier`
- `npx vitest run tests/scripts/splunk-app-package.test.ts tests/scripts/splunkbase-readiness.test.ts tests/scripts/submission-copy-audit.test.ts`
- `npm run audit:submission-copy`
- evidence-pack SHA-256 regeneration and verification
- `npm run check`

## Stop Conditions

- Stop before any external Splunkbase upload.
- Stop if AppInspect reports an error, failure, or unexpected warning requiring
  product or package changes outside this currentness refresh.
- Stop if npm publish is needed; Move 192 already records the OTP blocker.
