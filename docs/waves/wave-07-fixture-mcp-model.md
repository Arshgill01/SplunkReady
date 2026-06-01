# Wave 07 - Fixture MCP Model

## Goal

Create fixture mode's MCP response model.

## Scope

- Tool response fixtures.
- Fixture loader.
- Fixture validation.

## Files Owned

- fixture data directories.
- fixture adapter files.
- fixture tests.

## Acceptance Criteria

- Fixture adapter implements the same interface as live adapter.
- Fixtures are validated at load time.
- Fixture data includes mode/version metadata.

## Verification

- fixture adapter tests.
- schema validation over fixtures.

## Reviewer Checklist

- Are fixture responses realistic enough?
- Are fixtures deterministic?

## Stop Conditions

- Fixture data bypasses adapter interface.

