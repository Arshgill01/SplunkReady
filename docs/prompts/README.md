# Agent Goal Prompts

These prompts are copy-paste ready inputs for `/goal` sessions.

## Files

- `main-executor-goal.md`: use for the primary implementation agent.
- `reviewer-goal.md`: use for the continuous reviewer agent.

## Operating Model

- Main executor owns implementation, commits, wave progression, and final integration.
- Reviewer is mostly read-only and writes unique files under `logs/reviewer-inbox/`.
- Main executor uses one long-running branch: `splunkready-build`.
- Main executor makes one commit per completed wave.
- Antigravity/Gemini sidecar work uses a separate worktree/branch by default.

## Launch Order

1. Start the main executor `/goal` session from the `SplunkReady` repo.
2. Start the reviewer `/goal` session from the same repo or a read-only-oriented session.
3. Main executor creates or confirms the `splunkready-build` branch.
4. Reviewer begins looping and writing inbox files.
5. Main executor checks reviewer inbox before closing every wave.

## Reviewer Inbox Naming

Use:

```text
logs/reviewer-inbox/wave-XX-YYYYMMDD-HHMM-review.md
logs/reviewer-inbox/wave-XX-YYYYMMDD-HHMM-rereview.md
```

The reviewer should create new files, not append to a shared file.

