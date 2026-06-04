# Move 18 - Resolve The Critical Vitest Advisory

## Goal

Remove or explicitly mitigate the critical direct-development dependency
advisory reported by `npm audit`.

## Scope

Expected files:

- `package.json`
- `package-lock.json`
- Vitest config/tests only if upgrade compatibility requires it
- logs

## Plan

1. Confirm current `npm audit --json` output.
2. Attempt the narrow Vitest upgrade to a non-vulnerable release.
3. Review migration impact and lockfile churn.
4. Run full tests, build, UI build, and workbench tests.
5. If upgrade is unsafe before other work lands, document that Vitest UI is not
   used and ensure it is not exposed by scripts.

## Acceptance Criteria

- Preferred: `npm audit` reports no critical vulnerability.
- Fallback: production audit is clean and the dev-only residual risk is
  documented with a concrete upgrade issue.
- No unrelated dependency refresh is included.

## Verification

```bash
npm audit --json
npm audit --omit=dev --json
npm run check
npm run build
npm run ui:build
git diff --check
```

## Stop Conditions

- Stop before `npm audit fix --force`.
- Stop before a broad dependency refresh.
- Stop before claiming the tree is clean without audit output.
