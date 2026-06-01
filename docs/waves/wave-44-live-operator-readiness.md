# Wave 44 - Live Operator Readiness

## Goal

Improve optional live MCP operator readiness without requiring live credentials for normal verification.

## Scope

- Live-mode setup clarity.
- Secret-handling checks.
- Read-only capability guardrails.
- Better skip/error messages for missing live configuration.

## Files Owned

- live adapter docs.
- CLI live-smoke messages.
- live adapter tests.
- verification logs.

## Acceptance Criteria

- Fixture tests still require no live credentials.
- Live smoke remains opt-in and read-only.
- Missing live configuration is actionable and does not expose secrets.
- Fixture and live modes still share the adapter boundary after configuration.

## Verification

- `npx vitest run tests/adapters/live.test.ts tests/cli/flow.test.ts`
- `npx tsc --noEmit`
- no-credential live-smoke skip command

## Reviewer Checklist

- Does any path auto-mutate Splunk?
- Does any normal fixture command require live credentials?

## Stop Conditions

- Any change introduces write operations against Splunk.
