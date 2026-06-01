# Antigravity UI 19:57 Triage Report

Source worktree: `/private/tmp/splunkready-antigravity-ui-fresh-20260601-195731`

Source branch: `antigravity-ui-fresh-20260601-195731`

Main branch wave: Wave 75 - Antigravity UI 19:57 Triage

## Sidecar Summary

The fresh Antigravity/Gemini sidecar proposed adding mission-level deterministic check badges to the UI shell and also made broad visual restyling changes.

## Accepted

- Added a `Deterministic checks` column to the mission table.
- Derived check status from actual before/after violation data:
  - `failed` when the rule is currently violated.
  - `resolved` when the rule failed before the policy patch and no longer fails after rerun evidence exists.
  - `pass` when the rule is checked and never appears in the violation evidence.
- Added focused UI test coverage for the badge evidence mapping.

## Rejected

- Broad palette, typography, spacing, navigation, and layout restyling.
- `.antigravitycli/` sidecar metadata.
- Any schema, grader, adapter, receipt, or CLI changes.

## Rationale

The accepted change strengthens the existing UI contract: a viewer can connect mission checks directly to deterministic violation evidence and the Readiness Receipt rerun story. The rejected restyling was broader than the wave scope and would have made review harder without improving the certification evidence.

## Verification

- `npx vitest run tests/ui/shell.test.ts`
- `npm run build`

Both commands passed before this report was written.
