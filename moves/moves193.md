# Move 193 - Current Splunk App Package And Splunkbase Evidence

## Status

Completed on 2026-06-08.

## Objective

Refresh the Splunk app package, AppInspect precertification, Splunkbase
readiness, and listing dossier evidence so the local `.spl` capstone tracks the
current source version `0.1.6` instead of the stale `0.1.3` archive.

## Expected touched files

- `moves/moves193.md`
- `docs/execplans/splunk-app-currentness-refresh.md`
- `README.md`
- `docs/devpost-submission.md`
- `docs/splunkbase-listing-dossier.md`
- `scripts/audit-splunkbase-readiness.mjs`
- `scripts/audit-submission-copy.mjs`
- focused tests under `tests/scripts/`
- `submission-evidence/splunk-app-package/*`
- `submission-evidence/splunk-app-install/splunk-app-install-proof.json`
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
- `NODE_TLS_REJECT_UNAUTHORIZED=0 node dist/src/cli.js splunk-app-install-proof --out submission-evidence/splunk-app-install --env-file ./.splunkready-live.env --confirm-install true --json`
- `npx vitest run tests/scripts/splunk-app-package.test.ts tests/scripts/splunkbase-readiness.test.ts tests/scripts/submission-copy-audit.test.ts tests/workflows/appinspect-composition.test.ts`
- `npx vitest run tests/ui/app.test.ts -t "MCP proof summary"`
- `npm run audit:submission-copy`
- evidence-pack SHA-256 regeneration and verification
- `npm run check`

## Boundaries

- Do not claim Splunkbase approval or public Splunk Cloud vetting.
- Do not submit externally from automation.
- Do not run hidden/default live mutations. The current package install proof
  may be refreshed only with `--confirm-install true`, the operator-owned live
  env file, and tracked redaction evidence.
- Do not update npm/GitHub Packages/GitHub Release claims to `0.1.6`; Move 192
  remains blocked on npm OTP.
- Keep deterministic Readiness Receipt rules authoritative.

## Result

- Rebuilt `submission-evidence/splunk-app-package/SplunkReady-0.1.6.spl`.
- Re-ran AppInspect precertification for the `0.1.6` package: 0 errors, 0
  failures, 0 future failures, 1 expected `check_collections_conf` warning.
- Hardened `scripts/audit-splunkbase-readiness.mjs` so the live install proof
  must match the current package path and SHA.
- Refreshed the operator-approved live Splunk app install proof for
  `SplunkReady-0.1.6.spl`; 6 probes passed, package SHA matched, and no
  endpoint, username, password, or token values were written.
- Regenerated Splunkbase readiness/listing evidence, MCP AppInspect
  composition evidence, claim ledger rows, submission README, and evidence
  hashes.
- The local Splunkbase readiness status remains `ACTION_REQUIRED` because
  publisher-account upload, public Splunkbase listing, and Splunk Cloud review
  are external/operator-controlled.
