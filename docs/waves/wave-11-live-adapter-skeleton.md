# Wave 11 - Live Adapter Skeleton

## Goal

Add live MCP adapter structure without requiring credentials.

## Scope

- Config shape.
- Disabled-by-default live adapter.
- Capability checks.
- Clear missing-config errors.

## Files Owned

- live adapter files.
- config docs.

## Acceptance Criteria

- Tests run without Splunk credentials.
- Live adapter exposes the same interface as fixture adapter.
- Missing credentials fail with actionable messages.

## Verification

- unit tests with no credentials.
- typecheck.

## Reviewer Checklist

- Is secret handling safe?
- Is live mode isolated from fixture tests?

## Stop Conditions

- Hardcoded credentials or URLs.

