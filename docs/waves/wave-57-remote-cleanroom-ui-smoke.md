# Wave 57 - Remote Cleanroom UI Smoke

## Goal

Verify the pushed `splunkready-build` branch in a fresh remote cleanroom after the Wave 56 UI sidecar integration.

## Scope

- Clone `origin/splunkready-build` into a temporary directory.
- Install dependencies without relying on the main worktree.
- Run project checks and reviewer audit from the clone.
- Generate the fixture demo with live Splunk environment variables unset.
- Confirm the generated UI shell contains the Wave 56 navigation hooks.

## Files Owned

- remote cleanroom report.
- wave index docs.
- execution and verification logs.
- reviewer inbox files if new findings arrive.

## Acceptance Criteria

- Remote clone checks pass from the pushed branch.
- Fixture demo runs without live Splunk credentials.
- Generated shell keeps receipt-first content and Wave 56 navigation behavior.
- No main-worktree generated artifacts are left dirty.
- Goal remains open pending explicit user approval.

## Verification

- remote `npm ci --ignore-scripts`
- remote `npm run check`
- remote `npm run audit:reviewers`
- remote `npm run build`
- remote fixture demo with live Splunk env vars unset
- generated shell hook inspection

## Reviewer Checklist

- Does the report identify the remote commit and cleanroom path?
- Did the clone verify the pushed branch rather than local uncommitted files?
- Did fixture demo run without live Splunk credentials?
- Are UI hook checks tied to generated artifact content, not source-only assumptions?

## Stop Conditions

- Cleanroom requires live Splunk credentials.
- Verification relies on uncommitted local worktree changes.
- Generated demo artifacts contradict the receipt-first product story.
