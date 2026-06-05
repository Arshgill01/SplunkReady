# Move 84: Package Installability Audit

## Goal

Reduce the public package cap by proving the package works after installation
from the packed npm tarball, not only from the repository checkout.

## Scope

- Add an installability audit that runs after build.
- Pack the package into a temporary directory.
- Install the tarball into a fresh temporary npm project.
- Run `npx splunkready judge-proof --json` from outside the repository root.
- Assert the installed CLI returns `PASS` and preserves `mutation: false`.
- Include the audit in the canonical `npm run check` gate.

## Non-goals

- Do not run `npm publish`.
- Do not log in to npm or read npm auth tokens.
- Do not read, source, print, or commit `.splunkready*` or `.env*` files.
- Do not change package name, version, grading behavior, fixture/live parity, or
  Splunk mutation boundaries.

## Expected verification

- `npm run build`
- `npm run audit:package-readiness`
- `npm run audit:package-installability`
- `npm run check`
- `git diff --check`
