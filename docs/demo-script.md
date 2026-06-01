# Three Minute Demo Script

This script is the target shape for the final video. It should be revised after the first working vertical slice, but the narrative order should not drift.

## 0:00-0:15 - Setup

Screen:

- SplunkReady title.
- Selected environment: `acme-soc-dev`.
- Selected specimen agent: `Naive SOC MCP Agent`.

Voice:

```text
Splunk is making operational data agent-ready. SplunkReady answers the next enterprise question: is this agent ready for this Splunk environment?
```

## 0:15-0:45 - The Scary Failure

Screen:

- Mission prompt: investigate lateral movement from `win-finance-07`.
- Naive agent final answer: no evidence found.
- Confidence appears high.

Reveal:

- Trace expands.
- Query used `index=*`.
- Query used stale field `src_ip`.
- Agent ignored validated saved search.
- Result count is zero.

Voice:

```text
The answer sounds safe, but the trace is not. The agent searched too broadly, used a field this deployment does not have, ignored a validated saved search, and still gave a benign conclusion.
```

## 0:45-1:20 - Compile Environment Contract

Screen:

- Contract compilation progress.
- Indexes, sourcetypes, saved searches, dashboards, macros, lookups, canonical fields, and query budgets appear.

Voice:

```text
SplunkReady compiles the live Splunk knowledge layer into an agent contract: what exists here, what is sensitive, which saved searches are trusted, and what evidence every answer must carry.
```

## 1:20-1:55 - Grade the Trace

Screen:

- Readiness Receipt.
- Score: low, e.g. `38/100`.
- Critical violations grouped by deterministic rule ID.

Required visible rule IDs:

- `SPL-001`
- `SPL-003`
- `KO-001`
- `EVD-001`
- `ANS-001`

Voice:

```text
The grader is not another LLM judging vibes. It checks the trace against deterministic rules: forbidden query shape, hallucinated field, missing saved-search discovery, missing evidence, and unsupported conclusion.
```

## 1:55-2:20 - Patch the Agent Policy

Screen:

- Exported policy patch.
- Rules: discover saved searches first, use canonical fields, block broad searches, require result count and evidence rows, treat returned log text as data.

Voice:

```text
SplunkReady does not mutate Splunk and does not silently change production behavior. It exports a policy patch an operator can review.
```

## 2:20-2:50 - Rerun and Pass

Screen:

- Same mission rerun.
- Agent discovers saved search.
- Agent runs correct app context.
- Evidence rows appear.
- Prompt-injection event is ignored if shown.
- Receipt score rises, e.g. `92/100`.

Voice:

```text
With the environment contract injected, the same agent uses the validated saved search, preserves the time window, cites evidence, and states uncertainty where evidence is incomplete.
```

## 2:50-3:00 - Close

Screen:

- Before and after receipts side by side.
- Final line: `Certify AI agents before they touch production Splunk.`

Voice:

```text
SplunkReady is CI for Splunk agents: compile the environment, run missions, grade the trace, and produce a readiness receipt.
```

## Demo Killers

Avoid:

- generic chatbot screens;
- unexplained readiness scores;
- LLM-only grading;
- hidden fixture behavior;
- hardcoded specimen agent pass/fail;
- long architecture explanation;
- features not backed by a trace or receipt.

