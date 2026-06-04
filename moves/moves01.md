# Move 01 - Fail Closed On Missing Rule Implementations

## Why This Is First

The rule catalog and schema declare 19 grader IDs, while the runtime registers
14. Missions activate the five missing IDs (`KO-003`, `KO-004`, `ANS-002`,
`ANS-003`, `SAF-003`), but `runRuleEngine` currently ignores any activated ID
that is not present in the supplied rule registry. A mission can therefore
receive a READY verdict without executing every required check.

This is the highest-severity correctness gap found in the review. It is more
important than UI interactivity or CLI structure.

## Goal

Make registry incompleteness and duplicate rule registration explicit,
deterministic failures. No mission evaluation may silently skip an activated
rule.

## Scope

Expected files:

- `src/grader/engine.ts`
- the runtime registry assembly currently in `src/cli.ts`
- `tests/grader/engine.test.ts`
- focused CLI flow tests if the surfaced error crosses the CLI boundary
- `docs/grader-rule-catalog.md`
- the current wave, execution log, and verification log

Do not implement the five missing rule semantics in this move.

## Implementation Plan

1. Inventory the canonical rule IDs from `graderRuleIdSchema`, registered rule
   IDs from the runtime registry, and mission-selected checks.
2. Add a pure registry validator that rejects:
   - duplicate registered IDs;
   - an activated mission check with no registered implementation;
   - a registered ID outside the canonical schema.
3. Invoke validation before rule evaluation. Return a specific configuration
   error rather than a fabricated rule violation or score.
4. Ensure the CLI exits non-zero and writes no READY receipt when validation
   fails.
5. Keep rule evaluation deterministic. Do not insert placeholder passing rules.
6. Document the difference between cataloged, implemented, registered, and
   mission-selected checks.

## Acceptance Criteria

- A mission selecting `SAF-003` with no registered implementation cannot grade.
- Duplicate rule IDs cannot grade.
- A complete registry preserves existing rule output order and scoring.
- No missing rule is converted into a normal violation; it is a harness
  configuration failure.
- Fixture and live modes use the same validation path.

## Verification

```bash
npx vitest run tests/grader/engine.test.ts tests/cli/flow.test.ts
npm run build
npm run check
git diff --check
```

Also run a focused negative reproduction that selects one missing implementation
and confirm no receipt with a READY verdict is emitted.

## Stop Conditions

- Stop if fixing this requires changing verdict thresholds or violation
  severities.
- Stop if any proposal makes the LLM the fallback judge.
- Do not weaken validation to keep old green tests passing.
- Expect existing flows that activate missing rules to fail until Move 02 is
  complete. Land Moves 01 and 02 in the same wave if required to keep the branch
  green.
