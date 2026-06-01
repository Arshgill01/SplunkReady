# Wave 51 - Goal Completion Audit

## Goal

Create a prompt-to-artifact completion audit for the full SplunkReady objective without marking the goal complete.

## Scope

- Restate the objective as concrete deliverables and success criteria.
- Map explicit product, process, safety, reviewer, branch, verification, and demo requirements to concrete repo evidence.
- Run current verification commands that exercise the key completion claims.
- Identify missing, weakly verified, or unresolved requirements.

## Files Owned

- goal completion audit report.
- wave index docs.
- execution and verification logs.
- reviewer inbox files if new findings arrive.

## Acceptance Criteria

- Audit distinguishes achieved evidence from proxy signals.
- Audit includes concrete commands and artifact paths from the current branch.
- Audit does not mark the overall goal complete and does not call for completion without user approval.
- Any uncovered requirement becomes explicit follow-up work.

## Verification

- `npm run check`
- `npm run audit:submission-copy`
- `npm run audit:reviewers`
- fixture demo command from `docs/demo-script.md`
- `bash scripts/verify-scaffold.sh && git diff --check`

## Reviewer Checklist

- Does the audit cover every explicit requirement from the goal prompt?
- Does it rely on real evidence rather than intent or broad test-pass proxies?
- Are remaining gaps stated plainly?

## Stop Conditions

- The wave claims the overall goal is complete without explicit user approval.
- The audit treats passing tests as sufficient without requirement-level evidence.
