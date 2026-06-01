# Wave 10 - Fixture Traces

## Goal

Create before/after trace fixtures.

## Scope

- Naive failing trace.
- Contract-informed passing trace.
- Trace event ids.
- Final answer examples.

## Files Owned

- trace fixture files.

## Acceptance Criteria

- Failing trace includes overbroad query, wrong field, missing saved search, and unsupported conclusion.
- Passing trace includes metadata/saved-search discovery and evidence citation.
- Both traces validate against schema.

## Verification

- trace validation tests.
- grader smoke tests once grader exists.

## Reviewer Checklist

- Does the failing agent fail naturally?
- Does passing trace prove policy improvement?

## Stop Conditions

- Trace omits tool inputs.

