# Move 48: Composite GitHub Action Gate

## Status

Implemented.

## Problem

The examples include a copy-paste GitHub workflow, but developers still need to
wire several raw CLI commands by hand. That leaves SplunkReady feeling like an
external certification chore instead of a CI-native developer gate.

## Scope

- Add a repository-root `action.yml` composite action.
- Add a small testable runner for credential-free GitHub Action modes:
  - `judge-proof`;
  - `mcp-transcript`;
  - `external-trace`.
- Keep the action read-only and fixture-backed by default.
- Resolve caller-provided trace/transcript paths relative to
  `GITHUB_WORKSPACE`, while running SplunkReady itself from the action checkout.
- Expose useful action outputs for proof directory, receipt path, and summary
  path.
- Update the examples and README to show the shorter GitHub Actions path.

## Boundaries

- No live Splunk credentials in action inputs.
- No Splunk mutation.
- No LLM pass/fail authority.
- No package publishing requirement.
- No new dependency.
- No repository CI workflow change.
- No UI change.
- No secret env file read.
- No subagents.

## Verification

- `npm test -- tests/ci/github-action.test.ts`
- `npm run build`
- `npm run check`
- `git diff --check`
