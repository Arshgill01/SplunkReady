# Wave 09 - Fixture Query Results

## Goal

Seed deterministic query and saved-search results.

## Scope

- Broad query result behavior.
- Correct saved-search output.
- Wrong-field zero-result output.
- Prompt-injection event row.
- Observability latency rows.

## Files Owned

- fixture query result files.

## Acceptance Criteria

- Correct path produces evidence rows.
- Wrong path produces plausible zero results or errors.
- Prompt injection appears only as event data.
- Result counts are stable.

## Verification

- fixture query tests.
- receipt examples reference these rows.

## Reviewer Checklist

- Is the failure plausible, not cartoonish?
- Can the grader cite these rows?

## Stop Conditions

- Query fixtures are handwaved summaries without rows/counts.

