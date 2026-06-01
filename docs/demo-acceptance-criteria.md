# Demo Acceptance Criteria

The final demo must pass these checks before recording.

## Story Checks

- Opens with a naive Splunk MCP agent.
- Agent gives a confident but unsafe answer.
- SplunkReady exposes the unsafe trace.
- SplunkReady compiles an environment contract.
- SplunkReady exports policy patch.
- Same agent reruns with contract/policy.
- Rerun passes with evidence.

## Artifact Checks

- Failed Readiness Receipt exists.
- Policy Patch exists.
- Passing Readiness Receipt exists.
- Trace artifacts exist for both runs.
- Environment Contract exists.

## Timing Checks

- Full demo path rehearses under 3 minutes.
- Intro is under 20 seconds.
- Failure reveal is under 45 seconds.
- Contract/grade/patch sequence is under 90 seconds.
- Rerun and closing line fit remaining time.
- Video follows `docs/demo-script.md` unless an implementation finding forces a documented revision.

## Honesty Checks

- Fixture mode is disclosed if used.
- Live mode is documented separately.
- Agent is not scripted to fail/pass.
- Pass/fail grading is deterministic.
- Receipt evidence is inspectable.
- Visible failures map to rule IDs in `docs/grader-rule-catalog.md`.
- The before/after run resembles a golden trace from `docs/golden-traces.md`.
