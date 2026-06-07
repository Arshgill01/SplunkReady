# Move 104 - Hosted Demo Public Copy Guard

## Goal

Put the verified hosted demo URL in the public judge path and make the
submission-copy audit fail if it disappears.

## Scope

- Add the hosted MCP proof route and hosted judge-proof route to README and
  Devpost copy.
- Extend the submission-copy audit to require those hosted routes in public
  copy and evidence claims.
- Add focused regression coverage for missing hosted demo copy.

## Verification

- `npx vitest run tests/scripts/submission-copy-audit.test.ts`
- `npm run audit:submission-copy`
- `npm run verify:scaffold`
- `git diff --check`

## Boundaries

- Do not change product behavior.
- Do not run `npm publish`.
- Do not read, source, print, or commit `.splunkready*` or `.env*` files.
