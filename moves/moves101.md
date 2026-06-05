# Move 101 - Published Version Release Preflight

## Goal

Make the npm release preflight reflect the post-publication state instead of
failing when the current package version already exists on npm.

## Scope

- Treat the current published version as a valid `PUBLISHED` audit state.
- Keep `READY` for a bumped unpublished version.
- Keep real metadata, pack, registry, and auth failures visible.
- Update public docs and risk tracking so release evidence no longer says the
  package is only publish-ready.

## Verification

- `npx vitest run tests/scripts/npm-release-preflight.test.ts`
- `npm run audit:npm-release-preflight`
- `npm run check`
- `npm run verify:scaffold`
- `git diff --check`

## Boundaries

- Do not run `npm publish`.
- Do not read, source, print, or commit `.splunkready*` or `.env*` files.
- Do not weaken the published-package smoke evidence from Move 100.
