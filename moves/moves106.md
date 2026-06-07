# Move 106 - Live Security Public Export Redaction Guard

## Goal

Prove the public proof export redacts live-security proof summary fields before
any operator-owned live evidence can be shared.

## Scope

- Add focused workflow coverage for `live-security-proof-summary.json`.
- Assert endpoint URLs, private IPs, user paths, raw bodies, and token-like keys
  are redacted in the exported summary.
- Avoid reading real ignored live artifacts or secret env files.

## Verification

- `npx vitest run tests/workflows/public-proof-export.test.ts`
- `npm run check`
- `npm run verify:scaffold`
- `git diff --check`

## Boundaries

- Do not read or export real live artifacts.
- Do not use live Splunk credentials.
- Do not use Gemini credentials.
- Do not run `npm publish`.
- Do not read, source, print, or commit `.splunkready*` or `.env*` files.
