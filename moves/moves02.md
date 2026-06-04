# Move 02 - Restore Catalog-To-Runtime Rule Truth

## Goal

Resolve the five activated but unimplemented rule IDs so that mission contracts,
runtime behavior, tests, and judge-facing claims agree.

## Source Truth

Missing runtime implementations:

- `KO-003` - macro and lookup dependency existence
- `KO-004` - dashboard panel dependency resolution
- `ANS-002` - admit uncertainty when evidence is incomplete
- `ANS-003` - answer addresses the mission
- `SAF-003` - no unsupported or destructive actions

The original draft proposed implementations that did not match these catalog
definitions. In particular, unknown saved-search detection is not dashboard
dependency traversal, and evidence-ledger completeness is not admission of
uncertainty.

## Scope

Expected files:

- existing grader modules under `src/grader/`
- `src/grader/engine.ts` or a dedicated registry module
- existing knowledge normalization and graph modules
- affected mission definitions only if a rule cannot be implemented from the
  current deterministic context
- focused grader, mission, readiness-profile, and CLI tests
- `docs/grader-rule-catalog.md`
- current wave and logs

Prefer extending existing modules. Add a new module only where it creates a
clear rule-family boundary.

## Implementation Sequence

1. **Reconcile definitions before coding.** For every missing ID, write the
   deterministic inputs, pass condition, violation condition, and unavailable-
   fact behavior. Review this against fixture/live parity.
2. **Implement `SAF-003` first.** Cover unsupported tool calls, destructive SPL
   or requests, and claims that a mutation occurred. Reuse the contract's
   read-only boundary and existing firewall logic where appropriate.
3. **Implement `KO-004` and `KO-003` using structured dependency data.** Reuse
   `normalizer.ts` and `graph.ts`; do not rely on broad function-call regexes.
   When live MCP data cannot prove a dependency fact, disclose that limitation
   rather than claiming enforcement.
4. **Implement deterministic `ANS-002`.** Define observable phrases or
   structured answer facts that prove uncertainty was admitted when the trace
   is incomplete. Avoid overlap with evidence-reference rules.
5. **Handle `ANS-003` honestly.** Define a deterministic mission-answer
   contract that existing trace facts can support. If no defensible contract is
   possible, remove `ANS-003` from active missions and document why rather than
   shipping a weak heuristic.
6. Register every implemented rule and add a registry-completeness test against
   all mission-selected checks.
7. Update receipt/readiness-profile claims only after runtime coverage is
   proven.

## Acceptance Criteria

- No active mission check is silently unimplemented.
- Each implemented rule has pass, fail, boundary, and unavailable-data tests.
- Rule IDs, severities, and meanings match the catalog.
- The same rule implementation runs in fixture and live modes.
- Judge-facing copy states measured rule coverage, not a theoretical matrix.

## Verification

```bash
npx vitest run tests/grader tests/missions tests/compiler/readiness-profile.test.ts
npx vitest run tests/cli/flow.test.ts
npm run build
npm run check
git diff --check
```

## Stop Conditions

- Stop before changing a rule's product meaning merely to make it easy to
  implement.
- Stop before using an LLM to decide `ANS-002` or `ANS-003`.
- Stop if fixture-only metadata would create a false live-mode guarantee.
