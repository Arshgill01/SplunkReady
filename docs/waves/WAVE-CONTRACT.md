# Wave Execution Contract

This contract applies to every wave.

## Before Starting A Wave

The main executor must:

1. Read the wave file.
2. Read `AGENTS.md`.
3. Check `logs/reviewer-inbox/`.
4. Check `logs/risk-register.md`.
5. Identify expected files to touch.
6. Confirm the wave does not conflict with previous decisions.

## During A Wave

The executor must:

- keep edits inside wave scope;
- preserve fixture/live interface parity;
- avoid hidden LLM pass/fail logic;
- avoid implementation shortcuts that make the demo scripted;
- keep receipt provenance intact;
- update docs if schemas or commands change.

## After A Wave

The executor must:

1. Run wave verification commands.
2. Run broader checks when shared contracts changed.
3. Update `logs/execution-log.md`.
4. Update `logs/verification-log.md`.
5. Request reviewer loop.
6. Resolve or waive reviewer notes.
7. Commit the completed wave on `splunkready-build`.

## Minimum Wave Artifact Standard

Each wave should leave one of:

- executable code with tests;
- validated fixture data;
- schema definitions with tests;
- generated artifacts with snapshots;
- documentation required for future implementation.

## Stop-The-Line Issues

Stop immediately if:

- a pass/fail rule depends primarily on an LLM;
- fixture and live mode diverge after adapter boundary;
- specimen agent is scripted for the demo;
- receipt claims cannot cite trace/evidence ids;
- live mode requires secrets for normal tests;
- product drifts into chatbot/copilot/dashboard territory.

## Reviewer Required Questions

- Did this wave complete its acceptance criteria?
- Did it introduce new risks?
- Did verification actually test the behavior?
- Is the implementation aligned with product lock?
- Can a future wave build on this without reinterpretation?
