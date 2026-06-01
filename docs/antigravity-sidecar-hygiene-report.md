# Antigravity Sidecar Hygiene Report

Wave: 58 - Sidecar Worktree Hygiene

## Purpose

This report records the current Antigravity/Gemini sidecar state so future agents do not mistake isolated worktree output for the `splunkready-build` implementation.

No sidecar worktree was deleted and no sidecar tmux window was killed in this wave.

## Main Branch State

- Main worktree: `/Users/arshdeepsingh/Developer/SplunkReady`
- Branch: `splunkready-build`
- HEAD at inventory time: `79e62c9 wave-57: verify ui cleanroom smoke`
- Status at inventory time: clean and tracking `origin/splunkready-build`

## Registered Sidecar Worktrees

| Worktree | Branch | HEAD | Status | Main-Branch Decision |
| --- | --- | --- | --- | --- |
| `/private/tmp/splunkready-antigravity-ui` | `antigravity-ui-critique-wave39` | `a2cffb1` | untracked `.antigravitycli/` only | Historical sidecar; no main-branch integration pending. |
| `/private/tmp/splunkready-antigravity-ui-again` | `antigravity-ui-again` | `a2cffb1` | modified `src/ui/shell.ts`, untracked `.antigravitycli/`, `.playwright-cli/` | Broad UI rewrite remains isolated. |
| `/private/tmp/splunkready-antigravity-ui-fresh-20260601-161837` | `antigravity-ui-fresh-20260601-161837` | `72558b0` | modified `src/ui/shell.ts`, `tests/ui/shell.test.ts`, untracked `.antigravitycli/` | Broad UI output remains isolated. |
| `/private/tmp/splunkready-antigravity-ui-fresh-20260601-165040` | `antigravity-ui-fresh-20260601-165040` | `c058698` | modified `src/ui/shell.ts`, untracked `.antigravitycli/` | Rejected in Wave 50; broad dark/slate rewrite not merged. |
| `/private/tmp/splunkready-antigravity-ui-fresh-20260601-172602` | `antigravity-ui-fresh-20260601-172602` | `0f24eea` | modified `src/ui/shell.ts`, `tests/ui/shell.test.ts`, untracked `.antigravitycli/` | Partially accepted in Wave 56; only bounded navigation polish was reimplemented and verified on main. |

## tmux Windows

The `Splunk` tmux session still has Antigravity windows:

- `Splunk:4` / `agy-ui-again`
- `Splunk:5` / `agy-ui-fresh`
- `Splunk:6` / `agy-ui-fresh-1650`
- `Splunk:7` / `agy-ui-fresh-1726`

These windows are intentionally left running or present because the user explicitly asked to spin up a fresh Antigravity instance. Closing them is a separate operational cleanup decision.

## Cleanup Policy

- Do not merge sidecar worktree changes directly into `splunkready-build`.
- Do not delete sidecar worktrees or kill tmux windows without explicit user approval.
- If cleanup is approved later, use non-destructive git worktree removal only after confirming no desired diff remains.
- Future UI waves should continue using bounded sidecar triage reports and main-branch tests instead of treating sidecar diffs as authoritative.

## Current Integration Summary

- Wave 50 rejected a broad dark/slate UI rewrite and added UI drift guards.
- Wave 56 partially accepted the fresh `Splunk:7` sidecar by reimplementing small navigation affordances on main:
  - sidebar/table hover states;
  - hash-aware sidebar active state;
  - reduced-motion-aware smooth in-page navigation.
- Wave 57 verified the pushed branch from a remote cleanroom after the Wave 56 UI integration.

## Risk

The sidecar worktrees remain dirty by design. The main risk is operator confusion, not main-branch contamination. This report mitigates that by recording the boundary and by requiring explicit approval before cleanup or merge actions.
