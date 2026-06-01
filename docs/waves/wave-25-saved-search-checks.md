# Wave 25 - Saved Search Checks

## Goal

Grade saved-search discovery and usage.

## Scope

- Required discovery before custom SPL.
- Preferred saved search selection.
- Ignored saved-search violation.

## Files Owned

- saved-search rule files.
- tests.

## Acceptance Criteria

- Mission can require discovery.
- Agent fails if it generates broad SPL before checking existing validated searches.
- Passing trace cites saved-search id.

## Verification

- saved-search rule tests.

## Reviewer Checklist

- Does rule avoid overfitting to one saved search name?
- Is app context deferred to wave 26?

## Stop Conditions

- Saved search preference is only prompt text.

