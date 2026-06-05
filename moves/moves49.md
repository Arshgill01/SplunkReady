# Move 49: GitHub Action Job Summary

## Status

Implemented.

## Problem

The composite GitHub Action writes proof artifacts and outputs paths, but a
developer reviewing a pull request still has to open logs or download artifacts
to see what happened. That weakens the developer-experience story.

## Scope

- Write a concise GitHub step summary when `GITHUB_STEP_SUMMARY` is present.
- Include selected gate mode, status when available, proof directory, primary
  receipt path, and primary summary path.
- Keep the summary deterministic and artifact-backed.
- Keep action pass/fail behavior delegated to the existing CLI gates.
- Test summary generation without requiring GitHub Actions.

## Boundaries

- No LLM-generated summary.
- No live Splunk credentials.
- No Splunk mutation.
- No new dependency.
- No UI change.
- No secret env file read.
- No subagents.

## Verification

- `npm test -- tests/ci/github-action.test.ts`
- `npm run build`
- `npm run check`
- `git diff --check`
