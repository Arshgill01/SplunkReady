# SplunkReady

Certify AI agents before they touch production Splunk.

SplunkReady is a Splunk-native certification harness for teams shipping agents that can call Splunk. It does not answer alerts for the operator. It proves whether a specific agent can safely operate against a specific Splunk deployment.

## One-Sentence Pitch

Splunk is making operational data agent-ready. SplunkReady makes agents Splunk-ready.

## What It Does

The Agent Readiness Compiler compiles a fixture or live Splunk environment into an agent contract, runs realistic missions or accepts captured agent traces, grades the resulting tool trace with deterministic rules, and produces a Readiness Receipt.

The flagship demo story is security investigation readiness: the bundled deterministic specimen confidently clears possible lateral movement after using `index=*`, a stale field, and no saved search provenance. SplunkReady catches the unsafe trace, exports a reviewable policy patch, reruns the same mission, and shows a bounded pass with evidence.

## Judge-Runnable Fixture Demo

Fixture mode is the default path. It requires no Splunk credentials and does not call a live Splunk deployment.

Prerequisite: Node.js 22 or newer. If you use `nvm`, run `nvm use 22` from the repo root.

```bash
npm install
npm run build
tmp=$(mktemp -d /tmp/splunkready-demo-XXXXXX)
npm run splunkready -- demo --out "$tmp"
open "$tmp/splunkready-shell.html#certification-replay"
```

The demo command writes a complete local artifact set into `$tmp`, including:

- `splunkready-shell.html`: static Readiness Receipt UI.
- `demo-rehearsal.json`: measured rehearsal metadata and artifact list.
- `demo-rehearsal.md`: judge-readable demo summary.
- before and after Readiness Receipts that show fail -> patch -> rerun -> pass.

The primary closeout route is the certification replay:

```text
splunkready-shell.html#certification-replay
```

The same shell also includes `splunkready-shell.html#rerun-receipts` for the before/after receipt comparison.

Expected fixture outcome:

- before receipt: `NOT READY`
- after receipt: `READY`
- visible deterministic rule IDs include `SPL-001`, `SPL-003`, `KO-001`, `EVD-001`, and `ANS-001`

## Grade a Captured Agent Trace

The fixture demo is reproducible, but SplunkReady is not limited to its bundled specimen. After compiling the environment contract, pass in a schema-valid trace captured from another Splunk-connected agent:

```bash
npm run build
tmp=$(mktemp -d /tmp/splunkready-trace-XXXXXX)
npm run splunkready -- compile --out "$tmp"
npm run splunkready -- grade-trace \
  --trace path/to/captured-trace.json \
  --out "$tmp" \
  --agent-name "Captured Agent" \
  --agent-version "trace-001"
```

The command writes `trace-external.json`, deterministic violations, a score, and `receipt-external-001.json` / `.md`. It rejects traces whose `missionId` does not match the selected mission. The trace producer is outside SplunkReady; the deterministic rule engine remains the pass/fail authority.

## Live Mode

Live mode is optional and disabled by default. Normal fixture tests and the fixture demo do not require live Splunk credentials.

To exercise the live smoke path, set these environment variables locally:

```bash
export SPLUNKREADY_LIVE_ENABLED=true
export SPLUNKREADY_SPLUNK_MCP_URL="https://your-splunk-mcp.example"
export SPLUNKREADY_SPLUNK_MCP_TOKEN="..."
```

Then run:

```bash
npm run build
npm run splunkready -- live-smoke --out artifacts/live-smoke
```

Without live configuration, the live smoke command skips safely. With live configuration, it calls read-only MCP tools only and does not run searches or mutate Splunk configuration. See [docs/live-adapter.md](docs/live-adapter.md).

## Submission Strategy

SplunkReady targets the Platform & Developer Experience track. The product story is infrastructure for safer Splunk-connected agents, with security as the memorable demo scenario.

## What It Is Not

- Not a Splunk chatbot.
- Not a SOC copilot.
- Not MCP telemetry.
- Not a detection-health dashboard.
- Not a generic eval harness.
- Not an LLM judging another LLM.

## Primary Artifact

The Readiness Receipt is the product artifact. It records the environment contract version, mission suite version, trace evidence, deterministic violations, score, verdict, and policy patch summary.

## Architecture

The Agent Readiness Compiler keeps fixture and live Splunk access behind the same adapter boundary, then compiles a contract, runs missions, grades traces with deterministic rules, and emits a Readiness Receipt.

![SplunkReady architecture diagram](docs/architecture.svg)

Core flow:

1. Fixture or optional live MCP adapter exposes Splunk inventory through the shared adapter contract.
2. The compiler builds an environment contract with indexes, sourcetypes, saved searches, knowledge objects, fields, app context, and query budgets.
3. The harness runs the bundled deterministic specimen or ingests an externally captured agent trace.
4. The trace recorder/schema captures tool calls, evidence, results, and final answers.
5. Deterministic grader rules produce violations, score, verdict, and policy patch guidance.
6. The Readiness Receipt and static UI make the evidence reviewable.

## Development

Prerequisite: Node.js 22 or newer. The repo includes `.nvmrc` with `22` for local version managers.

```bash
npm install
npm test
npm run verify:scaffold
npm run check
```

## Limitations

- SplunkReady is a certification harness, not a chatbot, SOC copilot, detection-health product, or generic eval platform.
- The fixture demo uses representative Splunk fixture data; it is designed for deterministic local verification, not as a claim about every production deployment.
- Live mode is a read-only smoke path in this build. It validates adapter shape and environment compilation, but it does not run production searches.
- SplunkReady never auto-mutates Splunk. Policy patches are exported for operator review.
- LLMs may explain results or draft policy text, but deterministic grader rules decide pass/fail.
- The bundled specimen is deterministic TypeScript code for reproducible fixture demos. It is not a real LLM/MCP agent; use `grade-trace` for traces captured from external agents.

## Submission Materials

- Devpost copy: [docs/devpost-submission.md](docs/devpost-submission.md)
- Demo script: [docs/demo-script.md](docs/demo-script.md)
- Architecture diagram: [docs/architecture.svg](docs/architecture.svg)
- Live adapter safety notes: [docs/live-adapter.md](docs/live-adapter.md)
