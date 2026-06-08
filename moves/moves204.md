# Move 204 - Current Splunk App Package 0.1.7

## Status

Completed on 2026-06-08.

## Objective

Refresh the Splunk app package, AppInspect precertification, Splunkbase
readiness, and listing dossier evidence so the local `.spl` capstone tracks the
current source version `0.1.7` instead of the stale `0.1.6` archive.

## Expected touched files

- `moves/moves204.md`
- `docs/execplans/splunk-app-currentness-refresh.md`
- `README.md`
- `docs/devpost-submission.md`
- `docs/splunkbase-listing-dossier.md`
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
- `git diff --check`
- `npm run check`
- branch-tip CI

## Result

- Rebuilt `submission-evidence/splunk-app-package/SplunkReady-0.1.7.spl`.
- Updated the CLI's default Splunk app install-proof package path to the
  current `0.1.7` archive.
- Re-ran AppInspect precertification for the current package: 0 errors, 0
  failures, 0 future failures, and 1 expected KV Store warning.
- Refreshed Splunkbase readiness and listing dossier evidence to package SHA
  `282aa79b1bfa003ca7373b3588aeedb964f31c7d2636d7550af40e70d1fd70be`.
- Re-ran the explicit operator-approved live install proof against the current
  `.spl`; it reports `PASS` with redaction checks intact.
- Refreshed MCP proof AppInspect composition so the MCP evidence also points at
  `SplunkReady-0.1.7.spl`.
- Regenerated submission evidence hashes and ran the canonical gate locally.

Branch-tip CI remains pending until this move is committed and pushed.

## Boundaries

- Do not claim Splunkbase approval or public Splunk Cloud vetting.
- Do not submit externally from automation.
- Do not run hidden/default live mutations. The live install proof may be
  refreshed only with `--confirm-install true`, the operator-owned live env
  file, and tracked redaction evidence.
- Do not update public npm claims to `0.1.7`; Move 202 remains blocked on npm
  OTP.
- Keep deterministic Readiness Receipt rules authoritative.
