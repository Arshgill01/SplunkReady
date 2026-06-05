# Move 45: Callback Trace Capture

## Status

Implemented.

## Problem

The dependency-free trace bridge reduced manual JSON shaping, but many agent
frameworks expose callback run IDs instead of SplunkReady parent trace IDs. That
still left a practical integration gap for LangChain, AutoGen, CrewAI,
LlamaIndex, and custom callback-based agents.

## Scope

- Add a dependency-free callback capture wrapper over the existing trace bridge.
- Map framework callback `runId` values to canonical SplunkReady trace event IDs.
- Preserve parent links for result, error, and final-answer events.
- Reject tool-end and tool-error callbacks without a matching open start event.
- Document framework callback mappings in the examples guide.
- Certify a callback-captured trace through the real external trace workflow in
  tests.

## Boundaries

- No LangChain, AutoGen, CrewAI, or LlamaIndex dependency.
- No trace schema change.
- No grading change.
- No UI change.
- No Splunk mutation.
- No secret env file read.

## Verification

- `npm test -- tests/integrations/callback-trace-capture.test.ts`
- `npm run build`
- `npm run check`
- `git diff --check`
