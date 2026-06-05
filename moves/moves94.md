# Move 94: NPM Release Preflight

## Goal

Reduce the public-package cap by making npm publish readiness and blockers
machine-checkable without performing the external release action.

## Scope

- Add an npm release preflight script.
- Check package metadata, dry-run pack contents, npm registry package/version
  availability, and local npm auth status.
- Report `READY`, `BLOCKED`, or `FAIL`.
- Keep the command out of the canonical gate because npm auth and registry
  availability are environment-dependent.
- Document the preflight in README.

## Non-goals

- Do not run `npm publish`.
- Do not read, source, print, or commit `.splunkready*` or `.env*` files.
- Do not add credentials or npm tokens.
- Do not change package contents beyond release-preflight wiring.

## Expected verification

- `npm run audit:npm-release-preflight`
- `npm run check`
- `git diff --check`
