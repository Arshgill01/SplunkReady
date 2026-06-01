# Wave 68 - Demo Replay Refresh

## Goal

Replay the flagship fixture demo against the current branch and refresh evidence that the fail -> patch -> rerun -> pass story still works without live Splunk credentials.

## Scope

- Build the current TypeScript output.
- Run `npm run splunkready -- demo` with live Splunk env vars unset.
- Inspect generated demo artifacts for receipt verdicts, scores, deterministic rule IDs, UI shell, policy patch, and rehearsal timing.
- Record the demo output path and facts in a focused report.
- Do not require live Splunk credentials.
- Do not change implementation behavior.
- Do not call `update_goal`.

## Files Owned

- demo replay refresh report.
- wave index docs.
- current-state handoff docs.
- execution and verification logs.
- reviewer inbox files if new findings arrive.

## Acceptance Criteria

- Fresh demo run produces the expected artifact set.
- Before receipt is `NOT READY` with score `0`.
- After receipt is `READY` with score `100`.
- Policy patch artifacts exist and state that Splunk is not mutated.
- Rehearsal reports under-three-minute fit.
- Deterministic violation rule IDs are present.
- Goal remains open pending explicit user approval.

## Verification

- `npm run build`
- fixture demo command with live Splunk env vars unset.
- demo artifact inspection command.
- `npm run audit:reviewers`
- `bash scripts/verify-scaffold.sh && git diff --check`

## Reviewer Checklist

- Does the report cite current demo artifacts rather than stale historical paths?
- Does the demo story remain fail -> patch -> rerun -> pass?
- Are deterministic rule IDs visible?
- Does normal demo verification require no live Splunk credentials?
- Does the wave avoid claiming final completion?

## Stop Conditions

- Demo requires live Splunk credentials.
- Receipts no longer show fail -> patch -> rerun -> pass.
- Policy patch text implies automatic Splunk mutation.
