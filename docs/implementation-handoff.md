# Implementation Handoff

## Current State

SplunkReady is implemented through Wave 81 continuation QA on the long-running `splunkready-build` branch. The build includes the fixture-first certification flow, deterministic grader, Readiness Receipts, policy patch and rerun path, static UI shell with bounded receipt-navigation polish, optional read-only live smoke path, submission copy guardrails, reviewer audit automation, goal completion audit, post-audit remote cleanroom verification, branch-strategy handoff, scaffold-doc refresh, fresh Antigravity UI triage, post-UI remote cleanroom smoke, sidecar worktree hygiene, current-state sweep documentation, fresh Antigravity sidecar triage runs, post-sidecar remote cleanroom QA, remote branch handoff refresh evidence, a refreshed prompt-to-artifact goal audit, fresh Antigravity restart triage, a post-restart remote cleanroom check at Wave 64 commit `fc4daa7`, a current live-smoke safety refresh, a quality-confidence refresh against `QUALITY-BAR.md`, a fresh demo replay refresh, a fresh Antigravity UI semantic triage for before-phase receipt rendering, remote cleanroom verification after that UI semantic patch, the refreshed prompt-to-artifact goal completion audit at Wave 71, fresh Antigravity evidence-clarity UI triage at Wave 72, remote cleanroom verification after the Wave 72 UI evidence-clarity patch, a refreshed prompt-to-artifact goal audit after that remote cleanroom checkpoint, fresh Antigravity deterministic-check evidence triage at Wave 75, remote cleanroom verification after the deterministic-check UI patch, an evidence-backed certification replay UI polish wave, certification replay demo-route alignment, remote cleanroom verification after that demo-route alignment, a refreshed prompt-to-artifact goal audit against current demo-route cleanroom evidence, and a fresh Antigravity-backed Forensic Compiler Dossier UI iteration.

## Start Here

Future continuation agents should begin with:

1. `AGENTS.md`
2. `PLAN.md`
3. `DECISIONS.md`
4. `ARCHITECTURE.md`
5. `QUALITY-BAR.md`
6. `docs/waves/WAVE-CONTRACT.md`
7. the latest wave file under `docs/waves/`

## Implementation Decisions Already Made

Wave 02 selected the implementation stack. Current core choices:

- TypeScript is the implementation language.
- Runtime schema validation is mandatory.
- Fixture mode runs without Splunk credentials.
- UI work follows the schema, grader, receipt, and artifact spine and is currently implemented as a static TypeScript-generated artifact shell.

## Main Executor Rule

The main executor owns implementation. Reviewer is read-only unless explicitly assigned a tiny, bounded patch.

The main executor uses one long-running branch named `splunkready-build` and makes one commit per completed wave by default.

## Parallelism Rule

Parallelize:

- review;
- docs audit;
- source research;
- UI critique;
- test-case drafting.

Use Antigravity/Gemini with `agy --dangerously-skip-permissions` only as a bounded sidecar from a clean side worktree/branch unless the user explicitly approves otherwise.

Do not parallelize:

- schema spine;
- adapter interface;
- grader rule engine;
- receipt schema.

## Next Concrete Step

Continue with the next narrow wave. Start from a clean `splunkready-build` checkout, read the latest wave file, check `logs/reviewer-inbox/`, then run the wave-specific verification. The current broad health check is:

```bash
npm run check
```

Then record the exact result in `logs/verification-log.md`.
