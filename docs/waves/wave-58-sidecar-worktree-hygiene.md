# Wave 58 - Sidecar Worktree Hygiene

## Goal

Inventory Antigravity/Gemini sidecar worktrees and tmux windows so future waves do not confuse isolated sidecar output with main-branch implementation state.

## Scope

- Inspect registered git worktrees for Antigravity sidecars.
- Inspect related tmux windows in the current `Splunk` session.
- Document which sidecar outputs were rejected, partially integrated, or left untouched.
- Do not delete sidecar worktrees or kill sidecar tmux windows without explicit human approval.
- Do not change product behavior.

## Files Owned

- sidecar hygiene report.
- wave index docs.
- current-state handoff/status docs.
- execution and verification logs.
- reviewer inbox files if new findings arrive.

## Acceptance Criteria

- Main `splunkready-build` worktree remains clean before and after the inventory.
- All known Antigravity sidecar worktrees are listed with branch, base commit, and dirty status.
- The report distinguishes integrated Wave 56 UI polish from rejected broad rewrites.
- Future cleanup policy is explicit and non-destructive.
- Goal remains open pending explicit user approval.

## Verification

- `git status --short --branch`
- `git worktree list --porcelain`
- sidecar `git status --short --branch` and `git diff --stat`
- `tmux list-windows -t Splunk`
- `npm run audit:reviewers`
- `bash scripts/verify-scaffold.sh && git diff --check`
- `npm run check`

## Reviewer Checklist

- Does the report avoid deleting sidecar work without approval?
- Does it clearly separate main-branch commits from isolated sidecar state?
- Does it preserve the product lock and avoid UI scope drift?
- Are verification commands recorded in the logs?

## Stop Conditions

- The wave attempts to force-delete worktrees or kill tmux windows without approval.
- The wave merges unreviewed sidecar output.
- The wave changes SplunkReady behavior instead of documenting sidecar hygiene.
