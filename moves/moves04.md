# Move 04 - Make The Canonical Verification Gate Honest

## Goal

Turn the project-native verification command into a reliable pre-merge and
pre-submission gate.

## Current State

`npm run check` runs scaffold verification and the test suite. It does not
explicitly run the TypeScript build, Vite production build, reviewer audit,
submission-copy audit, rule-registry completeness, or fixture integrity checks.
During this review, concurrent build/test commands caused one transient CLI
module-export failure; an isolated rerun passed all 231 tests. The gate should
avoid shared-output races and make its coverage explicit.

## Scope

Expected files:

- `package.json`
- existing verification scripts under `scripts/`
- focused tests added by Moves 01-03
- CI workflow examples only if they invoke the canonical gate
- verification documentation
- current wave and logs

No coverage dependency or heavy tooling is needed.

## Plan

1. Define separate commands for:
   - source build;
   - UI production build;
   - deterministic tests;
   - scaffold/reviewer/submission audits;
   - rule-registry and fixture-integrity checks.
2. Compose them into one canonical command with a deterministic order that
   prevents shared `dist` directory races.
3. Keep live, Gemini, and SAIA network checks outside the default offline gate.
   Provide explicit opt-in commands for them.
4. Ensure CI-oriented JSON output tests do not rely on stale compiled files.
5. Document which gate is required per move and which is required before
   submission.

## Acceptance Criteria

- One command proves source build, UI build, offline tests, and repository
  audits.
- The command passes twice consecutively from a clean worktree.
- Missing rule registrations and invalid canonical trace mission IDs fail the
  gate.
- Network credentials are not required.
- Generated output races cannot corrupt the test run.

## Verification

```bash
npm run check
npm run check
git diff --check
git status --short
```

Record exact subcommands and results in `logs/verification-log.md`.

## Stop Conditions

- Stop before adding coverage quotas without a measured baseline and explicit
  approval.
- Do not make a live credentialed command part of the default gate.
- Do not hide intermittent failures with retries.
