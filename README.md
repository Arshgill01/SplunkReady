# SplunkReady

> **Certify AI agents before they touch production Splunk.**

[![Build Status](https://img.shields.io/badge/build-passing-success.svg)](#development)
[![Test Coverage](https://img.shields.io/badge/tests-231%20passed-success.svg)](#development)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

SplunkReady is a Splunk-native certification harness for teams shipping AI agents that can call Splunk. It does not answer alerts for operators. Instead, it proves whether a specific agent can safely operate against a specific Splunk deployment.

---

## 🌍 One-Sentence Pitch
**Splunk is making operational data agent-ready. SplunkReady makes agents Splunk-ready.**

---

## 🛠️ What It Does

The **Agent Readiness Compiler** compiles a fixture or live Splunk environment into an agent contract and readiness profile, runs realistic certification missions, grades the resulting tool trace with deterministic rules, and produces a **Readiness Receipt**.

The flagship demo story is **security investigation readiness**:
1. The naive specimen agent cleared possible lateral movement after running a broad `index=*` query, using a stale field, and citing no saved search provenance.
2. **SplunkReady** caught the unsafe trace, exported a reviewable policy patch, and blocked the agent.
3. The same mission was rerun with contract/policy injection and achieved a bounded **PASS** with strict evidence.

> [!NOTE]
> The default specimen is deterministic for local reproducibility. Set `SPLUNKREADY_LLM_ENABLED=true` to run the Gemini-backed specimen instead.

---

## 📐 Architecture

The Agent Readiness Compiler keeps fixture and live Splunk access behind the same adapter boundary. It compiles a contract, runs missions, grades traces with deterministic rules, and emits a Readiness Receipt.

![SplunkReady Architecture Diagram](docs/architecture.svg)

### Core Flow
1. **Adapter Boundary:** Fixture or optional live MCP adapter exposes Splunk inventory through the shared adapter contract.
2. **Environment Contract:** The compiler builds a contract mapping indexes, sourcetypes, saved searches, knowledge objects, fields, app context, and query budgets.
3. **Readiness Profile:** The compiler emits a profile binding deterministic rule IDs to those Splunk contract facts.
4. **Harness/Trace Capture:** The harness runs the specimen agent or imports an externally captured agent trace.
5. **Grader Engine:** Deterministic rules evaluate the recorded trace and produce violations, scores, and verdicts.
6. **Readiness Receipt:** The receipt and Vite UI make the evidence and policy patch reviewable.

---

## 🚀 Judge-Runnable Fixture Demo

Fixture mode is the default path. It requires no credentials and does not call a live Splunk instance.

### Prerequisites
- Node.js 22 or newer. (If using `nvm`, run `nvm use 22`).

### Quick Start
```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run the fixture certification demo
tmp=$(mktemp -d /tmp/splunkready-demo-XXXXXX)
npm run splunkready -- demo --out "$tmp"

# Open the Interactive Replay UI in your browser
open "$tmp/splunkready-shell.html#certification-replay"
```

The demo command writes a complete local artifact set into `$tmp`, including:
* `splunkready-shell.html`: The static Readiness Receipt UI.
* `demo-rehearsal.json`: Measured rehearsal metadata and artifact list.
* `demo-rehearsal.md`: Human-readable demo summary.
* `readiness-profile.json`: Deployment-bound rule profile showing which contract facts activated each rule.
* Before and After Readiness Receipts showing the `NOT READY` -> `READY` loop.

> [!TIP]
> The UI includes `#certification-replay` for the interactive step-by-step certification process and `#rerun-receipts` for the before/after receipt comparison.

---

## 🎛️ CLI Command Guide

SplunkReady provides a rich CLI to orchestrate environment compilation, grading, and auditing.

| Command | Key Flags | Description |
| :--- | :--- | :--- |
| `demo` | `--out <dir>` | Runs the complete fail -> patch -> rerun -> pass fixture demo. |
| `compile` | `--out <dir>` | Compiles the active adapter inventory into an environment contract. |
| `evaluate` | `--out <dir> [--firewall]` | Executes a specimen agent against the contract and records a trace. |
| `receipt` | `--out <dir>` | Grades the recorded trace and writes the initial Readiness Receipt. |
| `rerun` | `--out <dir> [--firewall]` | Injects the generated policy patch and reruns the agent evaluation. |
| `grade-trace` | `--trace <file> --out <dir>` | Grades an externally supplied agent trace against the contract. |
| `proof-audit` | `--out <dir> [--require-pass]` | Verifies the integrity of generated receipt/proof artifacts. |
| `verify-manifest`| `--out <dir>` | Re-hashes the proof bundle and verifies files against the manifest. |
| `certify-mcp-transcript` | `--transcript <file> --out <dir>` | Imports and certifies a raw JSON-RPC MCP transcript in one command. |
| `certification-index` | `--proof-dirs <dirs> --out <dir>` | Aggregates multiple proof directories into one rollup ledger. |
| `suite-proof` | `--out <dir> [--require-fail-to-pass]` | Runs multi-mission certifications across a suite manifest. |
| `live-smoke` | `--out <dir>` | Validates live Splunk MCP connectivity (read-only inventory checks). |
| `live-proof` | `--out <dir>` | Derives a mission and runs certification against a live Splunk instance. |
| `live-security-check` | — | Diagnostic check for flagship security saved searches on live Splunk. |
| `live-security-kit` | `--out <dir>` | Generates a setup app to install missing security data on live Splunk. |

---

## 🛡️ Runtime Firewall Gate

Use the `--firewall` flag on `evaluate` or `rerun` to wrap the Splunk adapter with the compiled environment contract before the specimen executes SPL queries:

```bash
npm run splunkready -- compile --out artifacts/firewall-check
npm run splunkready -- evaluate --out artifacts/firewall-check --firewall
```

When the firewall intercepts an invalid query (e.g. referencing sensitive indexes or forbidden commands), it blocks execution before it reaches Splunk, records `firewall-block-before.json`, and exits with a non-zero code. You can audit this safety proof directly:

```bash
npm run splunkready -- proof-audit --out artifacts/firewall-check --require-pass true --json
```

---

## 🔌 Capturing & Importing External Traces

You can certify external agents by exporting their tool calls to our canonical trace schema, or by importing raw MCP JSON-RPC transcripts directly.

### Grading Captured Traces
Grade a trace file captured from an external agent:
```bash
npm run build
tmp=$(mktemp -d /tmp/splunkready-trace-XXXXXX)
npm run splunkready -- compile --out "$tmp"
npm run splunkready -- grade-trace \
  --trace path/to/captured-trace.json \
  --out "$tmp" \
  --agent-name "External Agent" \
  --agent-version "trace-001"
```

### Importing Raw MCP Transcripts
If your agent logs raw JSON-RPC `tools/call` requests and responses, certify the transcript directly:
```bash
npm run splunkready -- certify-mcp-transcript \
  --transcript examples/sample-mcp-transcript-pass.jsonl \
  --out artifacts/mcp-transcript \
  --strict-import true \
  --require-pass true \
  --json
```

Use `--strict-import true` in CI to reject transcripts with mismatched requests or missing tool responses.

---

## 📈 Multi-Mission Suite Proof

To prove the harness is not limited to a single script, run the multi-mission suite:
```bash
npm run splunkready -- suite-proof --out artifacts/suite-proof --json
```
This runs the certification loop across the default manifest (`fixtures/acme-soc-dev/suites/phase-live-readiness-suite.json`), which covers two security missions and one observability mission. Use `--require-fail-to-pass true` to guarantee that every suite mission demonstrates the full fail-to-pass loop.

---

## 🌐 Live Mode (Optional)

Live mode is optional, read-only, and disabled by default. It is not required for running the fixture demo.

To enable live mode, set the configuration environment variables:
```bash
export SPLUNKREADY_LIVE_ENABLED=true
export SPLUNKREADY_SPLUNK_MCP_URL="https://your-splunk-mcp.example"
export SPLUNKREADY_SPLUNK_MCP_TOKEN="..."
```

### Live Smoke Check
```bash
npm run splunkready -- live-smoke --out artifacts/live-smoke
```
This inventories active indices and saved searches without running queries or modifying Splunk configuration.

### Guided Live Proof
```bash
export SPLUNKREADY_LLM_ENABLED=true
export GEMINI_API_KEY="..."
npm run splunkready -- live-proof --out artifacts/live-proof --candidate-limit 12
```
This scans read-only saved searches on your Splunk instance, compiles a live contract, generates a custom `live-derived-mission.json`, and runs the certification loop. It falls back to `_internal` queries if no saved searches return data.

---

## 🤖 LLM Specimen Agent

To grade a real model-driven specimen trace (instead of the deterministic specimen), export your Gemini API key and run:
```bash
export SPLUNKREADY_LLM_ENABLED=true
export GEMINI_API_KEY="..."
export GEMINI_MODEL="gemini-3.1-flash-lite"

npm run splunkready -- compile --out artifacts/llm-fixture-proof
npm run splunkready -- evaluate --out artifacts/llm-fixture-proof
npm run splunkready -- receipt --out artifacts/llm-fixture-proof
npm run splunkready -- rerun --out artifacts/llm-fixture-proof
```
In LLM mode, the initial evaluation runs without a contract injected (often leading to violations). The rerun injects the compiled policy patch. SplunkReady performs tool grading deterministically.

---

## 📋 Limitations

- **Pre-Production Certification:** SplunkReady is a certification harness and safety gate. It does not replace live monitoring, alert triaging, or general logging infrastructure.
- **Read-Only Splunk Interaction:** SplunkReady never modifies Splunk configuration, indexes, or events. Policy recommendations are exported as static policy patches for operator review.
- **Fixture Boundaries:** The default demo runs on seeded mock data for speed and deterministic local testing.
- **Flagship Live Data Prerequisites:** To complete the flagship security lateral-movement loop against a live Splunk endpoint, you must install the generated `live-security-kit` searches and events in your Splunk deployment.

---

## 📄 Submission Materials

- **Devpost Copy:** [docs/devpost-submission.md](docs/devpost-submission.md)
- **Demo Script (Under 3-minute narration):** [docs/demo-script.md](docs/demo-script.md)
- **Architecture Diagram:** [docs/architecture.svg](docs/architecture.svg)
- **Live Parity Contract:** [docs/fixture-live-parity.md](docs/fixture-live-parity.md)
- **Grader Rule Catalog:** [docs/grader-rule-catalog.md](docs/grader-rule-catalog.md)

---

## 💻 Development & Testing

SplunkReady is built with TypeScript, Zod, and Vitest.

```bash
# Run unit and integration tests
npm test

# Run scaffold verifications
npm run verify:scaffold

# Run full checks (scaffold + tests)
npm run check
```
