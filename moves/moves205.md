# Move 205 - Installed Splunk Web App Render Proof

## Status

Completed locally on 2026-06-08. Branch-tip CI pending after commit.

## Objective

Capture public-safe evidence that the current `SplunkReady` `.spl` package
renders inside an operator-owned Splunk Web deployment, not only through REST
probes and AppInspect. The proof should log into Splunk Web with an explicit
operator env file, open the installed SplunkReady launcher route, verify the
static artifact workbench served by the installed app, capture a public-safe
screenshot, and write redacted JSON/Markdown evidence.

## Expected touched files

- `moves/moves205.md`
- `docs/execplans/splunk-web-app-render-proof.md`
- `scripts/capture-splunk-app-web-proof.mjs`
- `tests/scripts/splunk-app-web-proof.test.ts`
- `scripts/build-splunk-app-package.mjs`
- `tests/scripts/splunk-app-package.test.ts`
- `submission-evidence/splunk-app-web-proof/*`
- `submission-evidence/screenshots/splunk-app-web-proof.png`
- `submission-evidence/README.md`
- `submission-evidence/claim-ledger.md`
- `scripts/audit-submission-copy.mjs`
- `tests/scripts/submission-copy-audit.test.ts`
- `submission-evidence/evidence-pack-sha256.txt`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Verification

- `command -v npx >/dev/null 2>&1`
- `npx vitest run tests/scripts/splunk-app-web-proof.test.ts`
- `SPLUNKREADY_ALLOW_SPLUNK_WEB_PROOF=1 npx --yes --package playwright node scripts/capture-splunk-app-web-proof.mjs --env-file ./.splunkready-live.env --out submission-evidence/splunk-app-web-proof --screenshot submission-evidence/screenshots/splunk-app-web-proof.png --confirm-browser true --json`
- `npm run audit:submission-copy`
- evidence-pack SHA-256 regeneration and verification
- `git diff --check`
- `npm run check`
- branch-tip CI

## Boundaries

- The browser proof itself must not write to Splunk.
- Operator-approved app install/restart actions are allowed only when logged
  with explicit commands and public-safe evidence.
- Do not commit endpoint, username, password, token, session cookie, or raw
  deployment inventory values.
- Do not add Playwright as a repository dependency.
- Do not claim Splunkbase approval or Splunk Cloud vetting.
- If the browser proof cannot authenticate or render, record `BLOCKED` evidence
  and continue with the next higher-value move.
