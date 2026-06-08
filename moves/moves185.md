# Move 185 - Splunkbase Listing Dossier

## Status

Implemented on 2026-06-08.

## Objective

Close the practical Splunkbase submission-preparation gap without claiming
external approval. Move 167/168 proved local package readiness and listing
assets; this move adds the copy-paste publisher-portal dossier and verifier.

## Expected touched files

- `docs/splunkbase-listing-dossier.md`
- `submission-evidence/splunkbase-readiness/splunkbase-listing-dossier.json`
- `submission-evidence/splunkbase-readiness/splunkbase-readiness.json`
- `submission-evidence/splunkbase-readiness/splunkbase-readiness.md`
- `submission-evidence/README.md`
- `submission-evidence/claim-ledger.md`
- `submission-evidence/evidence-pack-sha256.txt`
- `README.md`
- `docs/devpost-submission.md`
- `scripts/audit-splunkbase-listing-dossier.mjs`
- `scripts/audit-submission-copy.mjs`
- `package.json`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Implementation

- Added `submission-evidence/splunkbase-readiness/splunkbase-listing-dossier.json`
  with portal-ready app information, metadata copy, release notes, package SHA,
  AppInspect summary, listing asset paths, operator checklist, and explicit
  no-approval guardrails.
- Added `docs/splunkbase-listing-dossier.md` as the human-readable copy sheet
  for Splunkbase publisher portal entry.
- Added `scripts/audit-splunkbase-listing-dossier.mjs` and npm script
  `audit:splunkbase-listing-dossier`.
- Extended `scripts/audit-submission-copy.mjs` so public claims must keep
  referencing the listing dossier, support-contact blocker, and no-badge
  guardrail.
- Refreshed the Splunkbase readiness report so the screenshot count reflects
  the current evidence pack.

## Verification

- `npm run audit:splunkbase-listing-dossier`
- `npm run audit:splunkbase-readiness`
- `npm run audit:submission-copy`
- `find submission-evidence -type f ! -name evidence-pack-sha256.txt -print | sort | xargs shasum -a 256 > submission-evidence/evidence-pack-sha256.txt && shasum -a 256 -c submission-evidence/evidence-pack-sha256.txt`

## Result

- PASS: listing dossier verifier passed.
- PASS: Splunkbase readiness remains `ACTION_REQUIRED`, with local package,
  AppInspect, live install, receipt-store, and listing-asset checks passing.
- PASS: submission-copy audit now covers 375 required claims.
- PASS: evidence hash verification passed with the dossier included.
- External blocker remains: operator-owned Splunkbase publisher portal upload
  and public review are still required before claiming an "Available on
  Splunkbase" badge.
