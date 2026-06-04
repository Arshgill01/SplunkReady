# Move 03 - Repair Fixture Integrity And Fixture/Live Parity

## Goal

Remove known provenance drift and add the parity tests promised by the
architecture documents.

## Known Gaps

- The two canonical trace fixtures use `mission-lateral-movement`; the actual
  flagship fixture mission is `mission-security-lateral-movement-readiness`.
- The deliberate wrong-mission CLI test currently relies on that accidental
  fixture mismatch.
- Documented parity expectations do not yet have direct tests for compiler
  adapter swapping, identical-context grading, and receipt mode disclosure.
- Saved-search requests support `tokens` in the shared interface, while the live
  adapter currently drops them. The MCP-supported behavior must be confirmed
  before claiming parity.

## Scope

Expected files:

- `fixtures/acme-soc-dev/traces/naive-failure.json`
- `fixtures/acme-soc-dev/traces/contract-aware-pass.json`
- `tests/fixtures/traces.test.ts`
- the wrong-mission case in `tests/cli/flow.test.ts`
- focused adapter/compiler/grader/receipt parity tests
- `src/adapters/live.ts` only if MCP token forwarding is confirmed by evidence
- `docs/fixture-live-parity.md`
- current wave and logs

## Plan

1. Correct the two fixture mission IDs.
2. Change the wrong-mission test to create an intentionally mutated temporary
   trace so the failure condition remains explicit.
3. Add a fixture integrity assertion that every canonical trace references an
   existing mission and uses internally consistent event mission IDs.
4. Add parity tests:
   - equivalent normalized adapter facts produce equivalent contracts;
   - identical rule context produces identical grading in both modes;
   - receipts disclose mode without changing deterministic verdict logic.
5. Resolve saved-search token behavior:
   - confirm the MCP schema and forward tokens with an exact-payload test; or
   - explicitly reject tokenized saved searches consistently in both modes.
6. Update parity documentation with proven behavior and remaining limitations.

## Acceptance Criteria

- Canonical fixtures no longer rely on accidental mismatch.
- Wrong-mission rejection remains covered.
- Parity tests cover compiler, grader, and receipt boundaries.
- No fixture-only fact is presented as a live guarantee.
- Saved-search token handling is explicit and tested.

## Verification

```bash
npx vitest run tests/fixtures/traces.test.ts tests/cli/flow.test.ts
npx vitest run tests/adapters tests/compiler tests/grader tests/receipts
npm run build
npm run check
git diff --check
```

## Stop Conditions

- Stop if MCP token behavior cannot be confirmed; document and reject rather
  than guess.
- Do not change the flagship trap set.
- Do not create a broad new fixture-audit framework for this narrow fix.
