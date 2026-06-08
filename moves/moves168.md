# Move 168 - Splunkbase Listing Assets

## Intent

Clear the repo-owned Splunkbase readiness blocker left by Move 167 by packaging the required Splunk app icon and screenshot assets, then make the readiness audit verify their exact dimensions from inside the `.spl` archive.

## Scope

- Generate deterministic, credential-free PNG assets during `npm run splunk-app:package`:
  - `SplunkReady/static/appIcon.png` at 36 x 36.
  - `SplunkReady/static/appIcon_2x.png` at 72 x 72.
  - `SplunkReady/static/screenshot.png` at 623 x 350.
- Add the generated listing asset paths to `splunk-app-package-manifest.json`.
- Update `audit-splunkbase-readiness` so it extracts those PNGs from the packaged app and validates the dimensions.
- Update evidence docs and claim audits to reflect that local Splunkbase package assets are ready while publisher upload/review remains external.

## Non-Goals

- Do not claim the app is available on Splunkbase.
- Do not submit to Splunkbase from this repository automation.
- Do not redesign the workbench UI.
- Do not add image generation or graphics dependencies.

## Expected Files

- `scripts/build-splunk-app-package.mjs`
- `scripts/audit-splunkbase-readiness.mjs`
- `tests/scripts/splunk-app-package.test.ts`
- `tests/scripts/splunkbase-readiness.test.ts`
- `submission-evidence/splunk-app-package/*`
- `submission-evidence/splunkbase-readiness/*`
- `submission-evidence/claim-ledger.md`
- `submission-evidence/README.md`
- `README.md`
- `docs/devpost-submission.md`
- `logs/execution-log.md`
- `logs/verification-log.md`

## Verification

- `npx vitest run tests/scripts/splunk-app-package.test.ts tests/scripts/splunkbase-readiness.test.ts`
- `npm run splunk-app:package`
- `uvx splunk-appinspect inspect submission-evidence/splunk-app-package/SplunkReady-0.1.3.spl --mode precert --data-format json --output-file submission-evidence/splunkbase-readiness/appinspect-precert.json`
- `node scripts/audit-splunkbase-readiness.mjs --json`
- `npm run audit:submission-copy`
- `npm run check`
