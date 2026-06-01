# Devpost Submission Draft

## Project Name

SplunkReady

## Tagline

Certify AI agents before they touch production Splunk.

## Submission Track

Platform & Developer Experience

## Elevator Pitch

Splunk is making operational data agent-ready. SplunkReady makes agents Splunk-ready.

SplunkReady is a Splunk-native certification harness that proves whether a specific AI agent is safe and correct enough to operate on a specific Splunk deployment. It compiles the environment, runs realistic missions, grades the trace with deterministic rules, and emits a Readiness Receipt that operators can review before an agent touches production.

## What It Does

SplunkReady's Agent Readiness Compiler turns fixture or optional live Splunk MCP inventory into an environment contract. The harness then runs a specimen agent through security investigation readiness missions and records every Splunk-facing tool call. Deterministic grader rules check the trace for unsafe SPL shape, hallucinated fields, missing saved-search discipline, missing evidence, unsupported conclusions, prompt-injection handling, and query-budget violations.

The primary artifact is the Readiness Receipt. It contains the contract version, mission suite, trace provenance, violations, score, verdict, and policy patch summary.

## Flagship Demo

The demo uses a security investigation readiness story:

1. A naive Splunk MCP agent investigates possible lateral movement from `win-finance-07`.
2. The agent searches too broadly with `index=*`, uses a stale field, ignores a validated saved search, and gives a benign conclusion without enough evidence.
3. SplunkReady produces a failed Readiness Receipt with deterministic rule IDs.
4. SplunkReady exports a reviewable policy patch.
5. The same mission reruns with the compiled environment contract and passes with evidence-backed behavior.

The fixture demo is local and reproducible. It requires no live Splunk credentials.

## Why It Matters

AI agents that can call Splunk inherit the operational risk of the Splunk environment they touch. Generic evals do not know which indexes, sourcetypes, saved searches, app contexts, canonical fields, and evidence requirements matter for a specific deployment. SplunkReady makes readiness deployment-specific and reviewable.

## What Makes It Splunk-Native

- Environment contracts include Splunk concepts such as indexes, sourcetypes, saved searches, knowledge objects, fields, app context, and query budgets.
- The live smoke path uses the same adapter contract as fixture mode.
- The grader catches Splunk-specific risks such as broad searches, stale fields, missing saved-search use, and unsupported evidence claims.
- The product does not mutate Splunk; it exports policy guidance for operator review.

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
open "$tmp/splunkready-shell.html"
```

Open `splunkready-shell.html#rerun-receipts` to show the before and after Readiness Receipts.

## Optional Live Smoke

Live mode is disabled by default and is not required for judging the fixture demo. When configured with local credentials, the live smoke path calls read-only MCP tools only and does not run searches or mutate Splunk configuration.

```bash
npm run build
npm run splunkready -- live-smoke --out artifacts/live-smoke
```

## Built With

- TypeScript
- Zod
- Vitest
- Splunk MCP adapter boundary
- Deterministic trace grader rules

## Limitations

This build focuses on one strong vertical slice: security investigation readiness. The live path is intentionally a read-only smoke path. The demo fixture is representative and deterministic, not a substitute for connecting to every production deployment.
