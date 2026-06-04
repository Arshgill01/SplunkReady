# Move 01 - Fail Closed On Missing Rule Implementations

## Goal

Make it impossible for a mission to receive a READY verdict while one of its
declared checks has no runtime implementation.

## Why

The catalog/schema declare 19 rule IDs. Runtime currently registers 14. The five
missing IDs are activated by missions, and `runRuleEngine` silently filters
unregistered rules out. That is the most serious product bug in the harness.

## Scope

Expected files:

- `src/grader/engine.ts`
- rule registry assembly in `src/cli.ts` or a new focused registry module
- `tests/grader/engine.test.ts`
- focused CLI flow tests if the error crosses the CLI boundary
- `docs/grader-rule-catalog.md`
- wave file and logs

## Plan

1. Add a pure rule-registry validator.
2. Reject duplicate registered IDs.
3. Reject registered IDs outside the schema.
4. Reject any mission-selected check with no registered implementation.
5. Call the validator before grading.
6. Surface a harness configuration failure, not a normal violation.
7. Ensure no receipt with READY is written on validation failure.

## Acceptance Criteria

- A mission selecting unimplemented `SAF-003` fails before scoring.
- Duplicate IDs fail before scoring.
- Complete registries preserve existing rule ordering and scoring.
- Fixture and live paths use the same validation.

## Verification

```bash
npx vitest run tests/grader/engine.test.ts tests/cli/flow.test.ts
npm run build
npm run check
git diff --check
```

## Stop Conditions

- Stop before adding placeholder pass rules.
- Stop before changing verdict thresholds.
- Stop before using an LLM as a fallback judge.
