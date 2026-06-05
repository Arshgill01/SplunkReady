# Move 72: Public Package Publish Readiness

## Trigger

The Minimax audit identified `private: true` as one of the highest-leverage
Developer Experience caps because judges cannot run `npx splunkready` from a
registry package while the package is private.

## Scope

- Remove the `private: true` package blocker and move the package version off
  `0.0.0`.
- Add public publish metadata (`publishConfig.access`, repository, homepage,
  bugs, keywords).
- Add a package readiness audit that runs after build and performs
  `npm pack --dry-run --json`.
- Verify the packed contents include the CLI, package exports, fixtures,
  README, and action file.
- Verify the packed contents exclude local artifacts, logs, moves, source
  files, `.env*`, and `.splunkready*`.
- Update README to distinguish publish readiness from actual registry
  publication.

## Boundaries

- Do not run `npm publish`.
- Do not read, source, print, or commit `.env*` or `.splunkready*` files.
- Do not add dependencies.
- Do not change runtime behavior, grading authority, fixture/live parity, or UI
  source.
- Do not use subagents.

## Acceptance

- `package.json` no longer sets `private: true`.
- `npm run audit:package-readiness` passes after `npm run build`.
- The canonical `npm run check` includes the package readiness audit.
- Focused package tests pass.
- Full repository checks pass.
