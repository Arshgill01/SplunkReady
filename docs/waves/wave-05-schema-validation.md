# Wave 05 - Schema Validation

## Goal

Add executable schema validation.

## Scope

- Runtime schema validators.
- Fixture validation tests.
- Negative examples.

## Files Owned

- schema implementation files.
- schema tests.
- fixture sample files if needed.

## Acceptance Criteria

- Invalid trace event fails validation.
- Invalid receipt without trace refs fails validation.
- Mission without deterministic checks fails validation.

## Verification

- project-native schema tests.
- `rg -n "invalid|missing|traceRefs" test* src*`

## Reviewer Checklist

- Are validation errors useful?
- Are tests proving failure cases?

## Stop Conditions

- Schemas exist only as TypeScript types with no runtime validation.

