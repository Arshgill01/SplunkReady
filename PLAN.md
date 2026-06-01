# SplunkReady Execution Plan

Status: scaffold complete, implementation not started.

## Objective

Build a production-grade hackathon project that demonstrates:

> This agent can call Splunk. SplunkReady proves whether it can be trusted here.

## Execution Strategy

Use 42 waves. Each wave is intentionally small enough for one main executor to finish, verify, and hand to a reviewer loop.

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

## Reviewer Loop

The reviewer should not compete with the main executor.

Reviewer tasks:

- compare implementation to the current wave file;
- inspect schema consistency;
- look for hidden LLM-judging-LLM drift;
- check fixture/live parity;
- verify demo story remains honest;
- write findings into `logs/reviewer-notes.md`.

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

