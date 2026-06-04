# Move 02 - Implement The Missing Activated Rules

## Goal

Implement or explicitly remove from missions the five rule IDs that are declared
and activated but currently absent at runtime.

## Missing Rules

- `KO-003`: macro and lookup dependency existence.
- `KO-004`: dashboard panel dependency resolution.
- `ANS-002`: admits uncertainty when evidence is incomplete.
- `ANS-003`: answer addresses the mission.
- `SAF-003`: no unsupported or destructive actions.

## Scope

Expected files:

- existing modules in `src/grader/`
- `src/knowledge/normalizer.ts` and `src/knowledge/graph.ts` where needed
- rule registry assembly
- existing mission definitions only if a rule cannot be deterministic
- tests under `tests/grader/`, `tests/missions/`, and `tests/cli/`
- `docs/grader-rule-catalog.md`
- logs

## Plan

1. Write a deterministic contract for each rule before implementing it.
2. Implement `SAF-003` first because unsupported tools are a platform boundary.
3. Implement `KO-003` and `KO-004` using structured knowledge dependency data,
   not broad regex guesses.
4. Implement `ANS-002` as an uncertainty rule, not an evidence-ledger duplicate.
5. Define a deterministic `ANS-003` mission-answer contract. If the trace data
   cannot support one, remove `ANS-003` from active missions and document why.
6. Add pass, fail, boundary, and fixture/live-unavailable-data tests.
7. Update catalog and readiness-profile wording after behavior is proven.

## Acceptance Criteria

- No active check is unimplemented.
- Every rule has focused tests.
- Rule meanings match the catalog.
- Fixture-only facts do not create false live-mode guarantees.

## Verification

```bash
npx vitest run tests/grader tests/missions tests/compiler/readiness-profile.test.ts
npx vitest run tests/cli/flow.test.ts
npm run build
npm run check
git diff --check
```

## Stop Conditions

- Stop before inventing semantic LLM grading.
- Stop before weakening a catalog definition to make implementation easier.
- Stop if live mode cannot support a claimed deterministic fact.
