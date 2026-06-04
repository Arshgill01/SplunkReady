# Move 15 - Modularize The CLI Around Reused Workflows

## Goal

Reduce the `src/cli.ts` monolith where it blocks backend reuse, without spending
days on a broad mechanical refactor.

## Scope

Expected files:

- `src/cli.ts`
- focused modules under `src/cli/`
- workflow modules already created by earlier moves
- CLI tests
- logs

## Plan

1. Identify command handlers now backed by workflows.
2. Extract shared parsing/output helpers only when two or more commands use
   them.
3. Move proof audit, manifest verification, artifact bundling, and workbench
   workflow wrappers into focused modules if they remain large.
4. Keep command names, flags, JSON output, and artifact paths stable.
5. Avoid a grand reorganization while backend/UI work is still moving.

## Acceptance Criteria

- `src/cli.ts` shrinks in the areas touched by workbench workflows.
- Imports do not execute `main()`.
- Existing CLI command behavior is unchanged.
- Backend imports workflow modules, not CLI handlers.

## Verification

```bash
npx vitest run tests/cli/flow.test.ts tests/workflows tests/workbench
npm run build
npm run check
git diff --check
```

## Stop Conditions

- Stop before renaming commands or flags.
- Stop if the refactor delays executable UI workflows.
- Stop before moving code without behavior tests.
