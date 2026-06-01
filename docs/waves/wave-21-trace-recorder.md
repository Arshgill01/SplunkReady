# Wave 21 - Trace Recorder

## Goal

Record every agent tool interaction.

## Scope

- Trace event creation.
- Tool input/output summaries.
- Error capture.
- Evidence references.

## Files Owned

- trace recorder files.
- trace tests.

## Acceptance Criteria

- Every tool call has a trace event id.
- Query and saved-search calls preserve time window and result count.
- Final answer links to preceding trace.

## Verification

- trace recorder tests.
- fixture trace validation.

## Reviewer Checklist

- Can receipt cite exact trace events?
- Are sensitive outputs summarized safely?

## Stop Conditions

- Tool calls are logged only as freeform strings.

