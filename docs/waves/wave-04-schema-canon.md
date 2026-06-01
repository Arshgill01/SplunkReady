# Wave 04 - Schema Canon

## Goal

Turn schema notes into implementation-ready contracts.

## Scope

- Environment contract.
- Mission.
- Trace event.
- Violation.
- Readiness receipt.
- Policy patch.

## Files Owned

- `docs/schemas/core-contracts.md`
- future schema source files.

## Acceptance Criteria

- Each schema has required fields, optional fields, examples, and invariants.
- Receipt references traces and violations by id.
- Mission checks are deterministic rule references, not prose only.

## Verification

- `rg -n "Required fields|Invariant|Example|rule" docs/schemas`

## Reviewer Checklist

- Can each schema support fixture and live mode?
- Is anything UI-specific leaking into schemas?

## Stop Conditions

- Schema allows untraceable receipt claims.

