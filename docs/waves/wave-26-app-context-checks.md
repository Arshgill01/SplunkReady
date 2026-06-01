# Wave 26 - App Context Checks

## Goal

Grade whether the agent resolved app context correctly.

## Scope

- Saved search app.
- Macro app.
- Duplicate names.
- Context mismatch violations.

## Files Owned

- app-context rule files.
- tests.

## Acceptance Criteria

- Duplicate-name fixture fails if wrong app is used.
- Passing trace includes correct app context.
- Violation explains blast radius.

## Verification

- app-context tests.

## Reviewer Checklist

- Is app context modeled in contract?
- Are same-name objects handled?

## Stop Conditions

- App context is ignored because fixture works without it.

