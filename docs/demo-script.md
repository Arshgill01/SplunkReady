# Three Minute Demo Script

This script is the target shape for the final video. It should be revised after the first working vertical slice, but the narrative order should not drift.

## Rehearsal Command

From a clean fixture artifact directory:

```bash
npm run build
tmp=$(mktemp -d /tmp/splunkready-demo-XXXXXX)
npm run splunkready -- demo --out "$tmp"
open "$tmp/splunkready-shell.html#certification-replay"
```

The demo command runs the fixture path end to end:

1. compile environment contract;
2. run the deterministic fixture specimen trace;
3. generate failed Readiness Receipt and policy patch;
4. rerun the same mission with compiled policy;
5. generate passing Readiness Receipt;
6. write `splunkready-shell.html`, `demo-rehearsal.json`, and `demo-rehearsal.md`.

Primary UI route for the close: `splunkready-shell.html#certification-replay`.

Supporting receipt comparison route: `splunkready-shell.html#rerun-receipts`.

## 0:00-0:15 - Setup

Screen:

- SplunkReady title.
- Selected environment: `acme-soc-dev`.
- Selected specimen: deterministic `Naive SOC MCP Agent` fixture runner.

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
For this reproducible demo, SplunkReady compiles a representative Splunk fixture through the same adapter interface used by live MCP mode: what exists here, what is sensitive, which saved searches are trusted, and what evidence every answer must carry.
```

## 1:20-1:55 - Grade the Trace

Screen:

- Readiness Receipt.
- Score: `0/100` in the current fixture.
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
- Receipt score rises to `100/100` in the current fixture.

Voice:

```text
With the environment contract injected, the same agent uses the validated saved search, preserves the time window, cites evidence, and states uncertainty where evidence is incomplete.
```

## 2:50-3:00 - Close

Screen:

- Certification replay on the `Pass` stage.
- Before and after receipts remain available in the same shell.
- Final one-liner: `npx -y splunkready@0.1.15 judge-proof --out ./judge-proof --json`
  on screen for two seconds as the no-clone proof path.
- Final line: `Certify AI agents before they touch production Splunk.`

Voice:

```text
SplunkReady is CI for Splunk agents: compile the environment, run missions, grade the trace, and produce a readiness receipt. The full judge path is one npm command, no clone, no credentials.
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
