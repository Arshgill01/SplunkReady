# Wave 38 - Live MCP Smoke Path

## Goal

Prove live MCP path can compile a minimal contract.

## Scope

- Config docs.
- Safe live smoke command.
- No credential assumptions.
- Optional skip path.

## Files Owned

- live adapter smoke tests.
- setup docs.

## Acceptance Criteria

- Without credentials, tests skip cleanly.
- With credentials, smoke command retrieves safe metadata.
- No destructive or write operations.

## Verification

- fixture test suite.
- optional live smoke command documented.

## Reviewer Checklist

- Are secrets excluded?
- Does live path use bounded queries only?

## Stop Conditions

- Live smoke required for normal CI.

