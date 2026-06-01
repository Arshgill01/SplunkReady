# Implementation Handoff

## Current State

The repository is scaffolded for execution. Implementation has not started.

## Start Here

Future implementation agent should begin with:

1. `AGENTS.md`
2. `PLAN.md`
3. `DECISIONS.md`
4. `ARCHITECTURE.md`
5. `QUALITY-BAR.md`
6. `docs/waves/WAVE-CONTRACT.md`
7. `docs/waves/wave-00-control-system.md`

## First Implementation Decision

Wave 02 must choose stack before code:

- TypeScript is likely the conservative default.
- Runtime schema validation should be mandatory.
- Fixture mode must run without Splunk credentials.
- UI should not start before schema and grader spine are stable.

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

Start Wave 00 by running:

```bash
bash scripts/verify-scaffold.sh
```

Then record the result in `logs/verification-log.md`.
