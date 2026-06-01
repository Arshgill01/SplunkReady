# Wave 23 - SPL Structural Checks

## Goal

Detect risky or invalid SPL patterns structurally.

## Scope

- Broad index patterns.
- Missing time bounds.
- Known forbidden commands/patterns.
- Early filtering heuristics.

## Files Owned

- SPL rule files.
- SPL rule tests.

## Acceptance Criteria

- `index=* earliest=-30d` fails.
- Missing time bound fails when mission requires it.
- Checks work without LLM.

## Verification

- SPL rule unit tests.

## Reviewer Checklist

- Are rules conservative?
- Do false positives have clear waiver path?

## Stop Conditions

- Rule claims to parse all SPL perfectly without implementation support.

