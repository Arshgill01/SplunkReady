# Move 17 - Strengthen The Canonical Verification Gate

## Goal

Make one project-native command prove that the fast-moving backend/UI work is
still shippable.

## Scope

Expected files:

- `package.json`
- verification scripts
- CI workflow examples if needed
- logs

## Plan

1. Ensure the canonical gate runs:
   - scaffold verification;
   - TypeScript build;
   - UI build;
   - unit tests;
   - API/browser workbench tests;
   - reviewer/submission audits where appropriate;
   - diff whitespace checks.
2. Keep live and SAIA network checks as explicit opt-in commands.
3. Prevent shared output directory races between build and tests.
4. Add rule-registry and fixture-integrity checks from earlier moves.

## Acceptance Criteria

- One command can be run before every wave commit.
- It passes twice consecutively.
- It does not require live credentials.
- It fails on missing rule implementations or broken fixture provenance.

## Verification

```bash
npm run check
npm run check
npm run build
npm run ui:build
git diff --check
```

## Stop Conditions

- Stop before hiding failures with retries.
- Stop before adding live network requirements to the default gate.
- Stop before accepting concurrent output races as normal.
