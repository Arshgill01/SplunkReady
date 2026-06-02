# Agent Goal Prompts

These prompts are copy-paste ready inputs for `/goal` sessions.

## Files

- `main-executor-goal.md`: use for the primary implementation agent.
- `reviewer-goal.md`: use for the continuous reviewer agent.
- `main-executor-followup-consolidation-goal.md`: use for the Day 2 consolidation pass after the Day 1 build audit.
- `reviewer-followup-consolidation-goal.md`: use for the reviewer that audits the Day 2 consolidation pass.

## Follow-up Prompt Intent

Use the follow-up consolidation prompts when the project already has substantial scaffold/build work and needs a truth pass before more implementation. These prompts are intentionally stricter than the original launch prompts:

- close the current dirty wave before starting more work;
- prove what is real, fixture-only, and live-unverified;
- keep real Splunk/MCP claims evidence-backed;
- address the specimen-agent credibility risk;
- stop adding waves for their own sake;
- get reviewer audit and verification back to green.

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
