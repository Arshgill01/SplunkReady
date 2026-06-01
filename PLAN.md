# SplunkReady Execution Plan

Status: implemented through Wave 79 continuation QA on `splunkready-build`; overall goal remains open until explicit user approval.

## Objective

Build a production-grade hackathon project that demonstrates:

> This agent can call Splunk. SplunkReady proves whether it can be trusted here.

## Execution Strategy

Use the original 42-wave spine through Wave 41, then continue with explicitly added continuation waves and iterative QA until the user says to stop.

Each wave is intentionally small enough for one main executor to finish, verify, and hand to a reviewer loop.

The project should not be one-shot implemented. The schema and trace-grading spine must stabilize before UI or demo polish.

## Phase Map

- Phase 0: Control system and product lock, waves 00-04.
- Phase 1: Schema and adapter foundations, waves 05-11.
- Phase 2: Environment compiler and contract policy, waves 12-15.
- Phase 3: Mission generation, waves 16-19.
- Phase 4: Agent harness and trace capture, waves 20-21.
- Phase 5: Deterministic grading, waves 22-30.
- Phase 6: Receipts, policy patches, CLI, waves 31-33.
- Phase 7: UI, waves 34-37.
- Phase 8: Live path, demo, submission, waves 38-41.
- Phase 9: Post-final-QA hardening and iterative submission polish, waves 42+.

## Main Build Loop

For each wave:

1. Read the wave file.
2. Confirm expected files and stop conditions.
3. Implement only that wave.
4. Run wave-specific checks.
5. Run `scripts/verify-scaffold.sh` if docs changed.
6. Update `logs/execution-log.md`.
7. Update `logs/verification-log.md`.
8. Ask reviewer loop to inspect.
9. Resolve or waive reviewer notes before next wave.

After Wave 41, do not treat the original wave list as a stopping point. Add or execute narrowly scoped continuation waves for discovered gaps, judge-run resilience, UI sidecar polish, optional live-mode hardening, security review, demo reliability, remote cleanroom QA, artifact integrity, reviewer-audit automation, submission-copy guardrails, sidecar-output triage, goal-completion auditing, post-audit remote cleanroom QA, handoff freshness, branch-strategy handoff, scaffold-doc refresh, fresh Antigravity UI triage, post-UI remote cleanroom smoke, sidecar worktree hygiene, current-state sweeps, fresh sidecar rerun triage, post-sidecar remote cleanroom QA, remote branch handoff refreshes, current goal-audit refreshes, fresh Antigravity restart triage, post-restart remote cleanroom checks, live-smoke safety refreshes, quality-confidence refreshes, demo replay refreshes, fresh UI-sidecar semantic triage, remote cleanroom checks after UI semantic patches, goal-audit refreshes after cleanroom checkpoints, fresh UI sidecar evidence-clarity triage, remote cleanroom checks after UI evidence-clarity patches, goal-audit refreshes after remote UI cleanroom checkpoints, fresh UI-sidecar deterministic-check evidence triage, remote cleanroom checks after deterministic-check UI patches, evidence-backed certification replay UI polish, certification replay demo-route alignment, and remote cleanroom checks after demo-route alignment. Do not mark the overall goal complete until the user explicitly approves completion.

## Reviewer Loop

The reviewer should not compete with the main executor.

Reviewer tasks:

- compare implementation to the current wave file;
- inspect schema consistency;
- look for hidden LLM-judging-LLM drift;
- check fixture/live parity;
- verify demo story remains honest;
- write findings as unique files under `logs/reviewer-inbox/`.

`logs/reviewer-notes.md` is retained only as a legacy scaffold note location; reviewer handoff files belong in `logs/reviewer-inbox/`.

## Success Standard

Strict confidence must exceed 85% before submission.

Confidence is not vibe. It is scored against:

- scaffold completeness;
- schema stability;
- deterministic grader coverage;
- fixture/live parity;
- demo reproducibility;
- test coverage;
- reviewer findings resolved;
- submission requirements satisfied.

## Build Boundaries

Do not build all features. Build the smallest real vertical slice:

- one seeded environment;
- one naive specimen agent;
- one security investigation mission suite;
- one optional observability mission;
- one deterministic grader;
- one receipt flow;
- one patch/rerun path;
- fixture mode first, live mode second.
