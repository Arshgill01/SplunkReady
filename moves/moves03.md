# Move 03 - Repair Fixture Drift And Fixture/Live Parity

## Goal

Make the canonical fixtures internally consistent and add direct parity tests for
the shared fixture/live interfaces.

## Scope

Expected files:

- `fixtures/acme-soc-dev/traces/naive-failure.json`
- `fixtures/acme-soc-dev/traces/contract-aware-pass.json`
- `tests/fixtures/traces.test.ts`
- `tests/cli/flow.test.ts`
- adapter/compiler/grader/receipt parity tests
- `src/adapters/live.ts` only if saved-search tokens are confirmed
- `docs/fixture-live-parity.md`
- logs

## Plan

1. Fix canonical trace `missionId` values to match the actual flagship mission.
2. Rewrite the wrong-mission rejection test so it mutates a temporary trace
   deliberately.
3. Add fixture integrity tests for trace-to-mission consistency.
4. Add compiler adapter-swap equivalence tests.
5. Add identical-context fixture/live grader equivalence tests.
6. Add receipt mode-disclosure tests that confirm mode does not alter verdict
   logic.
7. Resolve saved-search token parity: forward tokens if MCP supports them, or
   reject tokenized saved searches consistently.

## Acceptance Criteria

- Canonical fixtures are not accidentally wrong.
- Wrong-mission rejection remains covered.
- Fixture/live parity is tested at compiler, grader, and receipt boundaries.
- Saved-search token behavior is explicit.

## Verification

```bash
npx vitest run tests/fixtures/traces.test.ts tests/cli/flow.test.ts
npx vitest run tests/adapters tests/compiler tests/grader tests/receipts
npm run build
npm run check
git diff --check
```

## Stop Conditions

- Stop before guessing MCP token behavior.
- Stop before changing the demo trap set.
- Stop before creating fixture-only enforcement that live mode cannot match.
