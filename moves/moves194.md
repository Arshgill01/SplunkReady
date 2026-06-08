# Move 194 - Refresh Public Package Currentness After Splunk App Evidence

## Status

Completed on 2026-06-08.

## Objective

Refresh the public npm currentness evidence after Move 193 changed package-input
files. The expected result is still `STALE`: public npm latest remains
`splunkready@0.1.5`, local source remains `0.1.6`, and publish remains
operator/OTP-blocked.

## Expected touched files

- `moves/moves194.md`
- `submission-evidence/public-package-currentness/public-package-currentness.json`
- `submission-evidence/claim-ledger.md`
- `submission-evidence/evidence-pack-sha256.txt`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Verification

- `npm view splunkready version dist-tags.latest gitHead --json`
- `npm run audit:public-package-currentness -- --out submission-evidence/public-package-currentness`
- `npm run audit:npm-release-preflight -- --require-ready`
- `npm run audit:submission-copy`
- evidence-pack SHA-256 regeneration and verification
- `npm run check`

## Boundaries

- Do not claim public npm `0.1.6` currentness unless npm actually publishes it.
- Do not attempt a blind `npm publish`; publish requires operator OTP.
- Do not update GitHub Packages, GitHub Release, or no-clone install snippets
  to `0.1.6` until public npm currentness passes.

## Result

- Refreshed `submission-evidence/public-package-currentness/public-package-currentness.json`.
- Public npm latest remains `splunkready@0.1.5` from gitHead
  `a79ee9e9de60b709d2110703004bbe9b1fedc373`.
- Local source remains `0.1.6`; the package-input head is now correctly
  recorded as Move 193 commit `8311db4`.
- Published `0.1.5` judge-proof, MCP initialization, live-mock proof,
  `mcp-recorder`, and policy-registry checks still pass.
- `npm run audit:npm-release-preflight -- --require-ready` reports `READY` for
  `0.1.6`, but publish still requires operator OTP.
