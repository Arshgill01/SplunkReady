# SplunkReady

Certify AI agents before they touch production Splunk.

SplunkReady is a Splunk-native certification harness and local workbench for teams shipping agents that can call Splunk. It does not answer alerts for the operator. It proves whether a specific agent can safely operate against a specific Splunk deployment.

## One-Sentence Pitch

Splunk is making operational data agent-ready. SplunkReady makes agents Splunk-ready.

## What It Does

The Agent Readiness Compiler compiles a fixture or live Splunk environment into an agent contract and readiness profile, runs realistic missions or accepts captured agent traces, grades the resulting tool trace with deterministic rules, and produces a Readiness Receipt.

The flagship demo story is security investigation readiness: the bundled specimen confidently clears possible lateral movement after using `index=*`, a stale field, and no saved search provenance. SplunkReady catches the unsafe trace, exports a reviewable policy patch, reruns the same mission, and shows a bounded pass with evidence. The default specimen is deterministic for local reproducibility; set `SPLUNKREADY_LLM_ENABLED=true` to run the Gemini-backed specimen instead.

The tracked evidence pack is in [submission-evidence/](submission-evidence/README.md). It includes a self-verifiable three-mission fixture proof, a redacted public proof export, manually inspected workbench screenshots, and a claim ledger that maps public claims to evidence paths.

## Judge-Runnable Fixture Demo

Fixture mode is the default path. It requires no Splunk credentials and does not call a live Splunk deployment.

Prerequisite: Node.js 22 or newer. If you use `nvm`, run `nvm use 22` from the repo root.

For the fastest local proof, run:

```bash
npm install
npm run judge-proof
```

`npm run judge-proof` builds the TypeScript runtime and writes a credential-free proof bundle to `artifacts/judge-proof`. The bundle runs the multi-mission fixture fail -> patch -> rerun -> pass suite, audits the suite, verifies its manifest, runs the firewall pre-execution proof, verifies that manifest, and writes a strict `certification-index.json` plus `ui-artifacts.json` for the workbench artifact selector. It does not call live Splunk and does not mutate Splunk.

For local package-style use after a clone, build once and link the checked-out
package:

```bash
npm run build
npm link
splunkready judge-proof --out artifacts/judge-proof --json
```

The `splunkready` bin resolves the bundled default fixture, mission, and suite
paths even when it is run from outside the repository root. The package remains
private in this repository until a registry publishing decision is made.

To prove the local MCP certification server path, run:

```bash
npm run mcp-proof
```

`npm run mcp-proof` starts the built SplunkReady stdio MCP server, negotiates
`initialize`, lists non-destructive certification tools, calls
`splunkready_describe_certification`, then certifies the checked-in passing MCP
JSON-RPC transcript through `splunkready_certify_mcp_transcript`. It writes
`artifacts/mcp-proof/mcp-proof-summary.json` / `.md` plus the generated
Readiness Receipt artifacts. This is still fixture-only, credential-free, and
non-mutating; it proves SplunkReady as an MCP certification server, not a Splunk
search copilot.

For the single-mission static replay shell, run:

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
- `readiness-profile.json`: deployment-bound rule profile showing which Splunk contract facts activated each readiness rule.
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

## Local Workbench

For the interactive workbench, run one local command:

```bash
npm run workbench
```

The command builds the TypeScript runtime and Vite UI, starts one localhost-only server, and prints the local URL, artifact root, fixture capability, live capability, and SAIA status. The first screen is the usable certification replay; no live Splunk credentials are required for the fixture path.

For UI development with Vite middleware, use:

```bash
npm run workbench:dev
```

The workbench API and UI are served from the same local origin. Live actions remain disabled unless the live environment variables in the Live Mode section are set in the shell that starts the server.

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
npm run splunkready -- proof-audit \
  --out "$tmp" \
  --require-pass true \
  --json
npm run splunkready -- verify-manifest \
  --out "$tmp" \
  --json
```

The compile command also writes `readiness-profile.json`, which binds active rule IDs to the compiled Splunk contract. The trace grading command writes `trace-external.json`, deterministic violations, a score, and `receipt-external-001.json` / `.md`. It rejects traces whose `missionId` does not match the selected mission. The trace producer is outside SplunkReady; the deterministic rule engine remains the pass/fail authority.

For external-agent CI, `proof-audit --require-pass true` recognizes `receipt-external-001.json` as an `external-trace` proof and fails the gate unless the deterministic receipt is `READY`. Each audit also writes `proof-manifest.json`, a SHA-256 manifest for the proof bundle files so shared artifacts can be checked without re-running the agent. `verify-manifest` re-hashes the bundle and fails if any audited artifact was changed, removed, or added after the manifest was created.

See [examples/README.md](examples/README.md) for runnable external-trace capture scripts and generated sample receipts for both `NOT READY` and `READY / 100` external agent traces.

If an external agent only logs Splunk MCP JSON-RPC calls, certify the transcript directly:

```bash
npm run splunkready -- certify-mcp-transcript \
  --transcript examples/sample-mcp-transcript-pass.jsonl \
  --out artifacts/mcp-transcript \
  --strict-import true \
  --require-pass true \
  --agent-name "External MCP Agent" \
  --agent-version "jsonrpc-transcript-001" \
  --json
```

This single gate writes the full evidence chain: compiled contract, imported canonical trace, deterministic violations, external receipt, proof audit, and `mcp-transcript-certification.json`. `--strict-import true` rejects incomplete JSON-RPC logs; `--require-pass true` blocks CI unless the external MCP agent receives a deterministic `READY` receipt.

To use the same transcript gate as a GitHub Action step:

```yaml
- uses: Arshgill01/SplunkReady@splunkready-build
  id: splunkready
  with:
    mode: mcp-transcript
    transcript: traces/splunk-mcp.jsonl
    out-dir: artifacts/splunkready-mcp-gate
    agent-name: External MCP Agent
    agent-version: pr-${{ github.event.pull_request.number }}
    strict-import: "true"
    require-pass: "true"

- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: splunkready-proof
    path: ${{ steps.splunkready.outputs.out-dir }}
```

The repository-root `action.yml` is a composite action. It installs and builds
SplunkReady from the action checkout, writes proof artifacts into the caller
workspace, and exposes `out-dir`, `receipt-path`, and `summary-path` outputs.
It also writes a short GitHub job summary with the selected mode, status, proof
directory, receipt path, and summary path. Pin it to a tag or commit for
production CI.

To exercise the same certification path through the stdio MCP server itself:

```bash
npm run mcp-proof
```

That command writes an MCP proof summary, the uploaded transcript copy,
`trace-imported.json`, `trace-external.json`, `receipt-external-001.json`,
`proof-audit.json`, and the transcript certification summary under
`artifacts/mcp-proof/`.

To summarize several proof bundles for one environment, generate a certification index:

```bash
npm run splunkready -- certification-index \
  --proof-dirs artifacts/mcp-transcript,artifacts/suite-proof,artifacts/live-security-ui \
  --out artifacts/certification-index \
  --require-pass true \
  --json
```

The command writes `certification-index.json`, a compact ledger of proof directories, audit status, receipt verdicts, scores, evidence counts, mutation posture, proof-manifest hashes, and UI links back to each proof bundle. It also writes `ui-artifacts.json`, which lets the Vite app populate its artifact selector from the generated proof set instead of a hardcoded demo list. Use `--require-pass true` in CI to fail the job if any indexed proof audit is `WARN` or `FAIL`.

## Multi-Mission Fixture Proof

To prove the harness is not a single scripted mission, run the suite proof:

```bash
npm run build
npm run splunkready -- suite-proof --out artifacts/suite-proof --json
npm run splunkready -- suite-proof --out artifacts/suite-proof-ci --require-fail-to-pass true --json
npm run splunkready -- proof-audit --out artifacts/suite-proof-ci --require-pass true --json
npm run splunkready -- suite-proof --suite fixtures/acme-soc-dev/suites/phase-live-readiness-suite.json --out artifacts/suite-proof-custom --require-fail-to-pass true --json
```

`suite-proof` runs the fixture fail -> patch -> rerun -> pass loop across a suite manifest, defaulting to `fixtures/acme-soc-dev/suites/phase-live-readiness-suite.json`: two security missions and one observability mission. It writes each mission's normal artifacts plus `suite-proof-summary.json` / `.md`, with proof-loop classification, domains covered, evidence counts, suite manifest provenance, and `mutation: false`. This path is credential-free and does not call live Splunk. Use `--require-fail-to-pass true` in CI when a READY receipt is not enough and every mission must prove the full certification loop. `proof-audit --require-pass true` also understands suite bundles and checks the suite summary, mutation posture, fail-to-pass count, READY-after-patch count, and evidence refs.

## Runtime Firewall Gate

Use `--firewall` on `evaluate`, `rerun`, `live-proof`, or `live-security-proof` to wrap the Splunk adapter with the compiled policy before the specimen can run SPL:

```bash
npm run splunkready -- compile --out artifacts/firewall-check
npm run splunkready -- evaluate --out artifacts/firewall-check --firewall
```

When the firewall blocks a query, SplunkReady rejects it before Splunk execution, writes `firewall-block-before.json` or `firewall-block-after.json`, and exits nonzero. The block report records the query, deterministic rule IDs, tool name, phase, and `mutation: false`. You can audit that bundle directly:

```bash
npm run splunkready -- proof-audit --out artifacts/firewall-check --require-pass true --json
```

This is a pre-execution safety gate. It does not replace Readiness Receipts; it prevents provably unsafe SPL from reaching Splunk.

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

Without live configuration, the live smoke command skips safely. With live configuration, it calls read-only MCP tools only, writes `live-smoke-contract.json` plus `live-smoke-readiness-profile.json`, and does not run searches or mutate Splunk configuration. See [docs/live-adapter.md](docs/live-adapter.md) and [docs/live-setup-checklist.md](docs/live-setup-checklist.md).

To derive and certify a live mission from the target deployment's own saved-search/index inventory:

```bash
export SPLUNKREADY_LIVE_ENABLED=true
export SPLUNKREADY_SPLUNK_MCP_URL="https://your-splunk-mcp.example"
export SPLUNKREADY_SPLUNK_MCP_TOKEN="..."
export SPLUNKREADY_LLM_ENABLED=true
export GEMINI_API_KEY="..."
export GEMINI_MODEL="gemini-3.1-flash-lite"
npm run build
npm run splunkready -- live-proof --out artifacts/live-proof --candidate-limit 12
```

`live-proof` compiles the live contract, scans bounded read-only saved-search candidates, writes `live-derived-mission.json`, then runs evaluate -> receipt -> rerun against that generated mission. It also writes `live-proof-summary.json`, including the explicit `proofLoop` classification (`fail-to-pass`, `ready-without-patch`, or not ready after rerun). If no saved search returns rows but `_internal` is available, it falls back to a bounded `_internal` query mission. It does not create indexes, install apps, write saved searches, or mutate Splunk.

For the flagship security story, `live-security-proof` is stricter: it first requires the lateral-movement saved search and evidence rows discovered by `live-security-check`, then runs the live Gemini specimen through the fail -> patch -> rerun -> pass loop and writes `live-security-proof-summary.json`. The readiness JSON now records `proofMode.fallbackAllowed: false`, setup requirements, and a fallback policy. A fresh Splunk trial without the exact saved search is a clear `BLOCKED` diagnostic, not a hidden `_internal` downgrade.

## LLM Specimen Agent

The normal fixture demo keeps the deterministic specimen as the default. To grade a real model-driven specimen trace, export a Gemini key and enable LLM mode:

```bash
export SPLUNKREADY_LLM_ENABLED=true
export GEMINI_API_KEY="..."
export GEMINI_MODEL="gemini-3.1-flash-lite"
npm run build
npm run splunkready -- compile --out artifacts/llm-fixture-proof
npm run splunkready -- evaluate --out artifacts/llm-fixture-proof
npm run splunkready -- receipt --out artifacts/llm-fixture-proof
npm run splunkready -- rerun --out artifacts/llm-fixture-proof
```

In LLM mode, `evaluate` prompts the model without compiled Splunk contract injection. `rerun` injects the compiled policy and contract. SplunkReady still executes tool calls through the adapter and the deterministic grader still decides pass/fail. See [docs/llm-specimen-agent.md](docs/llm-specimen-agent.md).

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

The Readiness Receipt is the product artifact. It records the environment contract version, mission suite version, trace evidence, deterministic violations, score, verdict, and policy patch summary. The companion readiness profile records why the rule surface is active for this Splunk deployment.

## Architecture

The Agent Readiness Compiler keeps fixture and live Splunk access behind the same adapter boundary, then compiles a contract, runs missions, grades traces with deterministic rules, and emits a Readiness Receipt.

See [architecture_diagram.md](architecture_diagram.md) for the root architecture diagram.

Core flow:

1. Fixture or optional live MCP adapter exposes Splunk inventory through the shared adapter contract.
2. The compiler builds an environment contract with indexes, sourcetypes, saved searches, knowledge objects, fields, app context, and query budgets.
3. The compiler emits a readiness profile binding deterministic rule IDs to those Splunk contract facts.
4. The harness runs the bundled deterministic specimen or ingests an externally captured agent trace.
5. The trace recorder/schema captures tool calls, evidence, results, and final answers.
6. Deterministic grader rules produce violations, score, verdict, and policy patch guidance.
7. The Readiness Receipt and static UI make the evidence reviewable.

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
- Live mode is read-only from SplunkReady's side. The live smoke path only inventories Splunk; `live-proof` and `live-security-proof` run bounded read-only searches through MCP.
- SplunkReady never auto-mutates Splunk. Policy patches are exported for operator review.
- LLMs may explain results or draft policy text, but deterministic grader rules decide pass/fail.
- The default bundled specimen is deterministic TypeScript code for reproducible fixture demos. The env-gated Gemini specimen produces fixture and live traces. The strict flagship live security proof requires operator-owned Splunk setup data because SplunkReady does not install apps, indexes, saved searches, or events automatically.

## Submission Materials

- Devpost copy: [docs/devpost-submission.md](docs/devpost-submission.md)
- Demo script: [docs/demo-script.md](docs/demo-script.md)
- Architecture diagram: [architecture_diagram.md](architecture_diagram.md)
- Evidence pack: [submission-evidence/](submission-evidence/README.md)
- Claim ledger: [submission-evidence/claim-ledger.md](submission-evidence/claim-ledger.md)
- Live adapter safety notes: [docs/live-adapter.md](docs/live-adapter.md)
- Live setup checklist: [docs/live-setup-checklist.md](docs/live-setup-checklist.md)
- LLM specimen agent: [docs/llm-specimen-agent.md](docs/llm-specimen-agent.md)
