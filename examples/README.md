# SplunkReady External Trace Example

This example shows SplunkReady as a grading SDK for a Splunk-connected agent outside this repository.

The capture script writes schema-valid traces for the flagship security readiness mission. SplunkReady does not care which framework produced the trace; it grades the recorded tool calls deterministically against the compiled Splunk contract.

The unsafe sample runs a broad `index=*` query with the stale `src_ip` field, gets zero rows, then declares the host benign without saved-search provenance or evidence refs. The contract-aware sample discovers the validated saved search, runs it through the adapter, and cites evidence refs in the final answer.

Run the unsafe trace from the repo root:

```bash
npm run build
node examples/capture-external-trace.js
tmp=$(mktemp -d /tmp/splunkready-external-example-XXXXXX)
npm run splunkready -- compile --out "$tmp"
npm run splunkready -- grade-trace \
  --trace examples/sample-external-trace.json \
  --out "$tmp" \
  --agent-name "External MCP Agent" \
  --agent-version "example-trace-001"
npm run splunkready -- proof-audit --out "$tmp" --json
```

The grading command writes `trace-external.json`, `violations-external.json`, `score-external.json`, and `receipt-external-001.md` into `$tmp`.

The checked-in `sample-receipt.md` was generated from this flow and is included as a static reference for reviewers. It returns `NOT READY` with deterministic violations for `SPL-001`, `SPL-003`, `KO-001`, `EVD-001`, and `ANS-001`. The proof audit classifies this as `external-trace` and reports `FAIL`; CI should use `--require-pass true` when it wants to block a merge on a NOT READY external receipt.

Run the contract-aware trace:

```bash
npm run build
node examples/capture-external-trace.js examples/sample-external-trace-pass.json pass
tmp=$(mktemp -d /tmp/splunkready-external-pass-XXXXXX)
npm run splunkready -- compile --out "$tmp"
npm run splunkready -- grade-trace \
  --trace examples/sample-external-trace-pass.json \
  --out "$tmp" \
  --agent-name "External MCP Agent" \
  --agent-version "example-trace-pass-001"
npm run splunkready -- proof-audit --out "$tmp" --require-pass true --json
```

The checked-in `sample-pass-receipt.md` was generated from this flow. It returns `READY / 100` with no violations, proving the SDK path can certify an external agent trace when the trace uses validated knowledge objects and carries evidence provenance.

## Capture from agent framework callbacks

External agents do not need to hand-shape SplunkReady trace JSON. Use the dependency-free trace bridge from a LangChain callback, AutoGen tool wrapper, CrewAI tool, LlamaIndex tool handler, or any other agent runtime that exposes tool start/result/final-answer events:

```ts
import { writeFile } from "node:fs/promises";
import { createSplunkReadyTraceBridge } from "../dist/src/integrations/agent-trace-bridge.js";

const bridge = createSplunkReadyTraceBridge({
  missionId: "mission-security-lateral-movement-readiness"
});

const callId = bridge.recordToolCall({
  toolName: "splunk_run_saved_search",
  toolInput: {
    name: "ES - Lateral Movement Auth Chain",
    app: "SplunkEnterpriseSecuritySuite",
    tokens: { host: "win-finance-07", earliest: "-24h", latest: "now" }
  },
  timeWindow: { earliest: "-24h", latest: "now" }
});

bridge.recordToolResult({
  parentId: callId,
  toolName: "splunk_run_saved_search",
  outputSummary: "Saved search returned three authentication chain events.",
  queryRef: "saved-search-lateral-movement",
  timeWindow: { earliest: "-24h", latest: "now" },
  resultCount: 3,
  evidenceRefs: ["evt-102", "evt-118", "evt-141"]
});

bridge.recordFinalAnswer({
  outputSummary: "The answer cites saved-search-lateral-movement and the three supporting event rows.",
  timeWindow: { earliest: "-24h", latest: "now" },
  resultCount: 3,
  evidenceRefs: ["evt-102", "evt-118", "evt-141"]
});

const payload = bridge.externalTracePayload({
  requirePass: true,
  agentName: "My Splunk Agent",
  agentVersion: "pr-1042"
});

await writeFile("splunkready-trace.json", `${JSON.stringify(payload.trace, null, 2)}\n`);
```

Then certify the captured trace:

```bash
npm run build
tmp=$(mktemp -d /tmp/splunkready-agent-bridge-XXXXXX)
npm run splunkready -- compile --out "$tmp"
npm run splunkready -- grade-trace \
  --trace splunkready-trace.json \
  --out "$tmp" \
  --agent-name "My Splunk Agent" \
  --agent-version "pr-1042"
npm run splunkready -- proof-audit --out "$tmp" --require-pass true --json
```

The bridge is not a second grader. It only records tool calls, adapter results, errors, and final answers in the canonical trace schema. The deterministic rule engine still decides readiness.

### Callback run ID capture

Many agent frameworks expose callback run IDs instead of asking callers to carry
SplunkReady parent trace IDs. Use `createSplunkReadyCallbackTraceCapture` for
that shape. It keeps a local map from framework run IDs to canonical trace event
IDs, then emits the same external trace payload as the lower-level bridge.

```ts
import { createSplunkReadyCallbackTraceCapture } from "../dist/src/integrations/callback-trace-capture.js";

const capture = createSplunkReadyCallbackTraceCapture({
  missionId: "mission-security-lateral-movement-readiness"
});

capture.onToolStart({
  runId: "langchain-run-knowledge-001",
  toolName: "splunk_get_knowledge_objects",
  toolInput: {
    types: ["saved_searches", "macros", "lookups"],
    query: "lateral movement",
    app: "SplunkEnterpriseSecuritySuite"
  }
});

capture.onToolEnd({
  runId: "langchain-run-knowledge-001",
  outputSummary: "Found the validated lateral-movement saved search and supporting objects.",
  resultCount: 3,
  evidenceRefs: ["saved-search-lateral-movement", "macro-security-content-ctime", "lookup-asset-lookup"]
});

capture.onFinalAnswer({
  outputSummary: "The answer cites saved-search-lateral-movement and supporting evidence rows.",
  resultCount: 3,
  evidenceRefs: ["evt-102", "evt-118", "evt-141"]
});
```

Mapping examples:

| Runtime shape | SplunkReady callback |
|---|---|
| LangChain `handleToolStart` / `handleToolEnd` with `runId` | `onToolStart({ runId, toolName, toolInput })` then `onToolEnd({ runId, ... })` |
| AutoGen tool wrapper before/after a Splunk tool call | Use the wrapper invocation ID as `runId`. |
| CrewAI tool `run()` wrapper | Generate one run ID before calling the tool, then end or error that same run ID. |
| LlamaIndex tool handler | Use the tool call ID from the handler context as `runId`. |
| Custom MCP client | Use the JSON-RPC request `id` as `runId`, or use `certify-mcp-transcript` directly if the client already logs request/response JSONL. |

The capture helper rejects tool-end and tool-error callbacks that do not have a
matching open tool start event. That catches broken instrumentation before a
trace reaches the deterministic grader.

## Run SplunkReady as an MCP server

SplunkReady can also run as a local MCP server so MCP clients can invoke the Agent Readiness Compiler directly. This is not a Splunk search copilot and it does not mutate Splunk. It exposes certification tools that grade local traces and transcripts into Readiness Receipts.

Build and launch the stdio server:

```bash
npm run mcp
```

To prove the server end to end without configuring a separate MCP client, run:

```bash
npm run mcp-proof
```

The proof command starts the built stdio server as a local MCP client would,
negotiates `initialize`, lists tools, calls the describe tool, and certifies
`examples/sample-mcp-transcript-pass.jsonl` through
`splunkready_certify_mcp_transcript`. It writes
`artifacts/mcp-proof/mcp-proof-summary.json` and the generated receipt bundle.

For MCP clients that accept a command configuration, use:

```json
{
  "command": "npm",
  "args": ["run", "mcp"],
  "cwd": "/path/to/SplunkReady"
}
```

The server exposes these tools:

- `splunkready_describe_certification`: returns the product posture, no-mutation boundary, and deterministic grading authority.
- `splunkready_certify_external_trace`: grades a local SplunkReady trace JSON file and writes `trace-external.json`, deterministic violations, score, receipt, and proof audit artifacts.
- `splunkready_certify_mcp_transcript`: imports a local Splunk MCP JSONL transcript, appends the producer final answer, and writes the same deterministic certification artifacts.

Example `splunkready_certify_external_trace` arguments:

```json
{
  "tracePath": "examples/sample-external-trace-pass.json",
  "outDir": "artifacts/mcp-server-external-pass",
  "requirePass": true,
  "agentName": "External MCP Agent",
  "agentVersion": "mcp-server-pass-001"
}
```

The MCP server refuses `.env*` and `.splunkready*` paths. Keep secrets in local environment files for the existing CLI/workbench flows; do not pass them as MCP tool arguments.

## Import an MCP JSON-RPC transcript

External agents do not have to emit SplunkReady trace events directly. If an agent can log Splunk MCP JSON-RPC `tools/call` requests and responses, SplunkReady can certify that transcript directly:

```bash
npm run build
tmp=$(mktemp -d /tmp/splunkready-mcp-transcript-XXXXXX)
npm run splunkready -- certify-mcp-transcript \
  --transcript examples/sample-mcp-transcript-pass.jsonl \
  --out "$tmp" \
  --strict-import true \
  --require-pass true \
  --agent-name "External MCP Agent" \
  --agent-version "jsonrpc-transcript-pass-001" \
  --json
```

The command still writes the intermediate files: `environment-contract.json`, `trace-imported.json`, `mcp-transcript-import.json`, `trace-external.json`, deterministic violations, `receipt-external-001.json`, `proof-audit.json`, and `mcp-transcript-certification.json`. It does not let the importer infer readiness; the imported trace is graded by the same deterministic rule engine as every other SplunkReady proof.

Use `--strict-import true` in CI to reject transcripts with skipped records or MCP tool calls that never received a matching response. Use `--require-pass true` to block merges unless the external MCP transcript receives a `READY` receipt.

## Build a certification index

After certifying one or more external traces, MCP transcripts, suite proofs, or live proof bundles, create a single review artifact:

```bash
npm run splunkready -- certification-index \
  --proof-dirs artifacts/mcp-transcript-pass,artifacts/suite-proof \
  --out artifacts/certification-index \
  --require-pass true \
  --json
```

`certification-index.json` does not re-grade traces. It reads each proof directory's `proof-audit.json` and Readiness Receipt, then records audit status, receipt verdict, score, evidence count, proof loop, mutation posture, and a UI link back to the source bundle. The command also writes `ui-artifacts.json`, so the Vite proof browser can populate its artifact selector from the same proof set. Use it as a small agent-certification ledger when several Splunk-connected agents or mission suites need to be reviewed together. In CI, `--require-pass true` turns the ledger into a merge gate: the command writes the index, then exits nonzero if any indexed proof audit is not `PASS`.

## CI gate example

`github-workflow-example.yml` shows how a repository can use SplunkReady as a pull-request gate.

For the shortest path, use the repository-root composite action. This keeps the
calling repository's workflow small while still producing a full proof bundle:

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

The action supports `mode: judge-proof`, `mode: mcp-transcript`, and
`mode: external-trace`. It does not accept live Splunk credentials as action
inputs; live proof remains an explicit operator-owned workflow. When GitHub
provides `GITHUB_STEP_SUMMARY`, the action writes a concise job summary with the
gate mode, status, proof directory, receipt path, and summary path.

The default `fixture-smoke` job runs without live Splunk credentials. It compiles the fixture contract, evaluates the specimen, issues the receipt, reruns with the compiled policy, writes a diagnostic `proof-audit.json`, and blocks the merge unless the final receipt is `READY`.

The job also runs `suite-proof --require-fail-to-pass true` against the default suite manifest, then audits that bundle with `proof-audit --require-pass true`. That stricter gate proves the security and observability fixture missions all execute the full NOT READY -> patch -> READY certification loop, rather than merely ending in a READY state. Repositories can pass `--suite <path>` to point the same gate at their own mission manifests.

CLI commands that include `--json` emit structured `PASS`, `SKIP`, or `FAIL` envelopes, so CI jobs can parse failure details without scraping human-readable stderr.

For externally captured traces and imported MCP transcripts, run `proof-audit --require-pass true` after `grade-trace`. The audit recognizes `receipt-external-001.json`, checks that `trace-external.json` and deterministic violations are present, verifies receipt trace refs, and fails unless the external receipt is `READY`.

The same job also runs `firewall-check`. That command compiles the fixture contract, executes the before-phase specimen behind the SplunkReady firewall, treats a `FIREWALL_POLICY_BLOCKED` result as a passing pre-execution safety proof, and writes `firewall-block-before.json` plus a strict `proof-audit.json`. CI can upload those artifacts even though no unsafe query reached Splunk.

When a workflow produces several proof directories, add `certification-index --require-pass true` as the final aggregation gate. That gives reviewers one `certification-index.json` file while still preserving the underlying receipts, audits, and traces.

The optional `live-security-proof` job is disabled unless the repository variable `SPLUNKREADY_LIVE_ENABLED` is set to `true`. It expects these secrets:

- `SPLUNKREADY_SPLUNK_MCP_URL`
- `SPLUNKREADY_SPLUNK_MCP_TOKEN`
- `GEMINI_API_KEY`

When enabled, it runs the live security proof and then enforces `proof-audit --require-pass true`. That strict gate is intended for complete live proof bundles; fixture smoke bundles remain diagnostic because they do not prove live MCP or hosted-model availability.
