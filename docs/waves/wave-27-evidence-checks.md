# Wave 27 - Evidence Grounding Checks

## Goal

Ensure answers are backed by Splunk evidence.

## Scope

- Query or saved-search id requirement.
- Time window.
- Result count.
- Raw event sample refs.
- Uncertainty language when evidence is missing.

## Files Owned

- evidence rule files.
- tests.

## Acceptance Criteria

- Unsupported benign conclusion fails.
- Answer with result count and event refs passes.
- Missing evidence emits critical violation for security mission.

## Verification

- evidence tests.

## Reviewer Checklist

- Does final answer link to trace ids?
- Are raw event samples summarized safely?

## Stop Conditions

- Receipt claim cannot be traced to event/query.

