# Wave 20 - Naive Specimen Agent

## Goal

Build a real but naive agent for evaluation.

## Scope

- Agent wrapper.
- Tool access through adapter.
- Final answer capture.
- Policy injection point.

## Files Owned

- specimen agent files.
- agent tests.

## Acceptance Criteria

- Agent can call tools.
- Agent has no contract before patch.
- Agent can receive policy/contract after patch.
- Agent trace is recorded without special-case scripting.

## Verification

- agent harness tests.
- failing fixture mission run.

## Reviewer Checklist

- Is failure natural?
- Is pass path caused by policy, not hidden hardcode?

## Stop Conditions

- Agent contains mission-specific if/else to fake behavior.

