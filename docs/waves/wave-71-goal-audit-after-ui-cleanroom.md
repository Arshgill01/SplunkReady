# Wave 71 - Goal Audit After UI Cleanroom

## Goal

Refresh the prompt-to-artifact goal completion audit against the current pushed Wave 70 state without marking the overall goal complete.

## Scope

- Re-run current verification commands for product copy, reviewer state, full tests, build, and fixture demo.
- Inspect current remote branch evidence from Wave 70.
- Update the goal completion audit with current Wave 71 evidence.
- Preserve the explicit user-approval blocker.
- Do not call `update_goal`.
- Do not change implementation behavior.

## Files Owned

- `docs/goal-completion-audit.md`
- wave index docs.
- current-state handoff docs.
- execution and verification logs.
- reviewer inbox files if new findings arrive.

## Acceptance Criteria

- The audit restates the objective as concrete deliverables.
- The audit maps explicit product, safety, branch, reviewer, demo, UI sidecar, remote cleanroom, and verification requirements to current evidence.
- Fresh demo evidence shows fail -> patch -> rerun -> pass.
- The audit identifies missing explicit user approval as the blocker to goal completion.
- Goal remains open pending explicit user approval.

## Verification

- `npm run check`
- `npm run audit:submission-copy`
- `npm run audit:reviewers`
- `npm run build`
- fixture demo command with live Splunk env vars unset.
- demo artifact inspection command.
- `bash scripts/verify-scaffold.sh && git diff --check`

## Reviewer Checklist

- Does the audit cite current Wave 70/Wave 71 evidence rather than stale Wave 63 artifacts?
- Does it avoid treating passing checks as completion without explicit approval?
- Does it preserve product boundaries and safety rules?
- Does it account for the fresh Antigravity UI sidecar and remote cleanroom verification?
- Does it avoid calling the goal complete?

## Stop Conditions

- The wave marks the overall goal complete.
- The wave calls `update_goal`.
- The audit weakens deterministic grading, fixture/live parity, or user-approval requirements.
