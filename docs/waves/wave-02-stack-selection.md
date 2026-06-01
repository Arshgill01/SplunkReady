# Wave 02 - Stack Selection

## Goal

Choose a conservative implementation stack.

## Scope

- Runtime.
- Test framework.
- Schema library.
- UI framework.
- CLI approach.

## Files Owned

- `docs/stack-decision.md`
- package manifests once implementation starts.

## Acceptance Criteria

- Stack supports typed schemas and deterministic tests.
- No heavy dependency is added without justification.
- Fixture mode can run without Splunk credentials.
- Live mode can be disabled by default.

## Verification

- `sed -n '1,220p' docs/stack-decision.md`

## Reviewer Checklist

- Is the stack boring enough to ship?
- Are dependencies justified by product needs?

## Stop Conditions

- Adding paid services.
- Choosing a stack that slows fixture-first delivery.

