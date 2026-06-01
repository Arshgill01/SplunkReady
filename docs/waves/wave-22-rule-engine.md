# Wave 22 - Rule Engine Foundation

## Goal

Create deterministic grader rule engine.

## Scope

- Rule interface.
- Severity model.
- Rule result shape.
- Violation emission.

## Files Owned

- grader core files.
- rule tests.

## Acceptance Criteria

- Rules consume contract, mission, trace.
- Rules emit structured violations.
- Rule engine can run multiple checks and preserve order.

## Verification

- unit tests for pass/fail rule.
- violation schema validation.

## Reviewer Checklist

- Are LLMs absent from pass/fail path?
- Are severities explainable?

## Stop Conditions

- Rule engine accepts arbitrary prose as grade.

