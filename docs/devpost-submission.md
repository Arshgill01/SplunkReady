# Devpost Submission Draft

## Project Name

SplunkReady

## Tagline

Certify AI agents before they touch production Splunk.

## Submission Track

Primary: Platform & Developer Experience

Also eligible: Best Use of Splunk MCP Server, Best Use of Splunk Hosted Models, and Security.

## Elevator Pitch

Splunk is making operational data agent-ready. SplunkReady makes agents Splunk-ready.

SplunkReady is a Splunk-native certification harness that proves whether a specific AI agent is safe and correct enough to operate on a specific Splunk deployment. It compiles the environment, runs realistic missions, grades the trace with deterministic rules, and emits a Readiness Receipt that operators can review before an agent touches production.

## What It Does

SplunkReady's Agent Readiness Compiler turns fixture or optional live Splunk MCP inventory into an environment contract. The harness then runs a specimen agent or accepts a captured external-agent trace through `grade-trace`, records every Splunk-facing tool call, and grades the trace with deterministic rules. Those rules check for unsafe SPL shape, hallucinated fields, missing saved-search discipline, missing evidence, unsupported conclusions, prompt-injection handling, and query-budget violations.

The primary artifact is the Readiness Receipt. It contains the contract version, mission suite, trace provenance, violations, score, verdict, and policy patch summary.

## Flagship Demo

The demo uses a security investigation readiness story:

1. A naive Splunk MCP agent investigates possible lateral movement from `win-finance-07`.
2. The agent searches too broadly with `index=*`, uses a stale field, ignores a validated saved search, and gives a benign conclusion without enough evidence.
3. SplunkReady produces a failed Readiness Receipt with deterministic rule IDs.
4. SplunkReady exports a reviewable policy patch.
5. The same mission reruns with the compiled environment contract and passes with evidence-backed behavior.

The fixture demo is local and reproducible. It requires no live Splunk credentials.

The optional Phase Live path has also connected to a real local Splunk MCP endpoint and produced live MCP/Gemini trace proof. The current live limitation is documented honestly: the local trial did not contain the flagship Enterprise Security saved search or matching evidence rows, so the live security receipt remains blocked on operator-approved demo content rather than adapter code.

## Why It Matters

AI agents that can call Splunk inherit the operational risk of the Splunk environment they touch. Generic evals do not know which indexes, sourcetypes, saved searches, app contexts, canonical fields, and evidence requirements matter for a specific deployment. SplunkReady makes readiness deployment-specific and reviewable.

## What Makes It Splunk-Native

- Environment contracts include Splunk concepts such as indexes, sourcetypes, saved searches, knowledge objects, fields, app context, and query budgets.
- The live smoke path uses the same adapter contract as fixture mode.
- The grader catches Splunk-specific risks such as broad searches, stale fields, missing saved-search use, and unsupported evidence claims.
- The product does not mutate Splunk; it exports policy guidance for operator review.

## Best Use of Splunk MCP Server

SplunkReady uses the Splunk MCP interface as the certification boundary. Fixture mode and live mode converge after the adapter boundary, so the same compiler, trace recorder, grader, policy patch, and Readiness Receipt logic run regardless of whether the data came from a reproducible fixture or a live MCP endpoint.

Evidence:

- Read-only MCP tools represented in the contract: `splunk_get_info`, `splunk_get_user_info`, `splunk_get_indexes`, `splunk_get_metadata`, `splunk_get_knowledge_objects`, `splunk_run_query`, and `splunk_run_saved_search`.
- Live smoke writes `live-smoke-contract.json` and `live-smoke-readiness-profile.json` when `SPLUNKREADY_LIVE_ENABLED=true`, `SPLUNKREADY_SPLUNK_MCP_URL`, and `SPLUNKREADY_SPLUNK_MCP_TOKEN` are configured.
- The live transport sends JSON-RPC requests shaped as `{ "jsonrpc": "2.0", "id": "...", "method": "tools/call", "params": { "name": "<tool>", "arguments": { ... } } }` with bearer-token auth and timeout handling.

Read-only is intentional. SplunkReady is a certification gate before production access, so it should prove the agent is safe without changing Splunk configuration.

## Best Use of Splunk Hosted Models

The policy patch path activates Splunk AI Assistant / hosted-model tools when SPL violations are found:

- `saia_explain_spl` explains why a violating SPL query is unsafe or mismatched to the compiled contract.
- `saia_optimize_spl` proposes a corrected query shape.
- The Readiness Receipt and policy patch Markdown surface `SAIA Explanation:` and `SAIA Optimized Query:` beside the deterministic violation IDs.

The hosted model explains and suggests. It does not decide pass/fail; the deterministic rule engine remains authoritative.

## Platform & SDK Story

SplunkReady is also a grading SDK for other Splunk-connected agents. The `grade-trace` command accepts a schema-valid captured trace, validates the mission, grades it against the compiled Splunk contract, and writes an external-agent Readiness Receipt. The `examples/` directory includes a runnable capture script plus a generated sample receipt.

This matters for Platform & Developer Experience because a Splunk developer can wire any agent framework to emit the canonical trace schema, then use SplunkReady as the pre-production certification gate.

## What It Is Not

- Not a Splunk chatbot.
- Not a SOC copilot.
- Not MCP telemetry.
- Not a detection-health dashboard.
- Not a generic eval harness.
- Not an LLM judging another LLM.

## How To Run

```bash
npm install
npm run build
tmp=$(mktemp -d /tmp/splunkready-demo-XXXXXX)
npm run splunkready -- demo --out "$tmp"
open "$tmp/splunkready-shell.html#certification-replay"
```

Open `splunkready-shell.html#certification-replay` to show the fail -> rules -> patch -> rerun -> pass certification replay. The same shell includes `splunkready-shell.html#rerun-receipts` for the before and after Readiness Receipts.

## Optional Live Smoke

Live mode is disabled by default and is not required for judging the fixture demo. When configured with local credentials, the live smoke path calls read-only MCP tools only and does not run searches or mutate Splunk configuration.

```bash
npm run build
npm run splunkready -- live-smoke --out artifacts/live-smoke
```

For a strict live proof run, add `--require-live true`. The current documented live proof gap is not connectivity; it is the absence of matching live demo content for the flagship lateral-movement mission.

## Built With

- TypeScript
- Zod
- Vitest
- Splunk MCP adapter boundary
- Deterministic trace grader rules
- Gemini-backed specimen path for model-produced traces
- Splunk AI Assistant / hosted-model explain and optimize tool calls in the policy patch flow

## Limitations

This build focuses on one strong vertical slice: security investigation readiness. The live path is intentionally read-only, and the passing live security receipt still needs a Splunk deployment with the expected saved search and evidence rows. The demo fixture is representative and deterministic, not a substitute for connecting to every production deployment.
