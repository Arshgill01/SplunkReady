# Move 13 - Resolve The Critical Vitest Development Advisory

## Goal

Remove or explicitly mitigate the critical direct-dependency advisory reported
by `npm audit` before the public submission is frozen.

## Source Truth

On 2026-06-04, `npm audit --json` reports `GHSA-5xrq-8626-4rwp` against direct
development dependency Vitest versions below 4.1.0. The advisory concerns
arbitrary file read and execution when the Vitest UI server is listening.
SplunkReady does not currently use the Vitest UI server, and the production
runtime dependency set is not implicated, but a critical audit result is still
a credibility and maintenance risk for a security-focused public repository.

## Scope

Expected files:

- `package.json`
- `package-lock.json`
- Vitest configuration or tests only if the supported upgrade requires changes
- README/security notes only if a residual mitigation must be documented
- current wave and logs

Do not use `npm audit fix --force` without reviewing the resulting major-version
changes.

## Plan

1. Confirm the advisory, affected range, exploit condition, and current use of
   Vitest UI.
2. Attempt the narrow supported upgrade to a non-vulnerable Vitest release.
3. Review lockfile changes and migration notes. Make only compatibility changes
   required by the upgrade.
4. Run the full test, build, and UI build gates twice.
5. Run `npm audit --json` and `npm audit --omit=dev --json`.
6. If the upgrade cannot safely land before the deadline:
   - document that Vitest UI is not used and must not be exposed;
   - add an explicit script/config guard if practical;
   - record the residual advisory and schedule the upgrade immediately after
     submission.
7. Do not claim the dependency tree is vulnerability-free unless the audit
   output proves it.

## Acceptance Criteria

- Preferred: `npm audit` reports no critical vulnerability.
- Minimum fallback: production audit is clean, Vitest UI is explicitly unused
  and prohibited, and the residual dev-only advisory is documented.
- All 231 or later tests pass after dependency changes.
- Source and UI builds pass.
- No unrelated package upgrades enter the lockfile.

## Verification

```bash
npm audit --json
npm audit --omit=dev --json
npm run check
npm run check
npm run build
npm run ui:build
git diff --check
```

## Stop Conditions

- Stop before a broad dependency refresh or forced audit fix.
- Stop if the major upgrade changes runtime behavior beyond focused
  compatibility fixes.
- Do not hide the audit result or misstate the exploit condition.
