# Wave 16 - Mission DSL

## Goal

Create mission definition format.

## Scope

- Mission ids.
- Prompt text.
- Expected tools.
- Forbidden patterns.
- Required evidence.
- Rule references.

## Files Owned

- mission schema files.
- mission examples.
- mission tests.

## Acceptance Criteria

- Mission validates before execution.
- Mission can require saved-search discovery.
- Mission can declare safety constraints.

## Verification

- mission schema tests.
- fixture mission validation.

## Reviewer Checklist

- Are mission checks deterministic?
- Are prompts realistic?

## Stop Conditions

- Mission result depends only on final answer text.

