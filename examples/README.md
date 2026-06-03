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
  --proof-dirs artifacts/mcp-transcript-pass,artifacts/mcp-transcript-fail,artifacts/suite-proof \
  --out artifacts/certification-index \
  --json
```

`certification-index.json` does not re-grade traces. It reads each proof directory's `proof-audit.json` and Readiness Receipt, then records audit status, receipt verdict, score, evidence count, proof loop, mutation posture, and a UI link back to the source bundle. Use it as a small agent-certification ledger when several Splunk-connected agents or mission suites need to be reviewed together.

## CI gate example

`github-workflow-example.yml` shows how a repository can use SplunkReady as a pull-request gate.

The default `fixture-smoke` job runs without live Splunk credentials. It compiles the fixture contract, evaluates the specimen, issues the receipt, reruns with the compiled policy, writes a diagnostic `proof-audit.json`, and blocks the merge unless the final receipt is `READY`.

The job also runs `suite-proof --require-fail-to-pass true` against the default suite manifest, then audits that bundle with `proof-audit --require-pass true`. That stricter gate proves the security and observability fixture missions all execute the full NOT READY -> patch -> READY certification loop, rather than merely ending in a READY state. Repositories can pass `--suite <path>` to point the same gate at their own mission manifests.

CLI commands that include `--json` emit structured `PASS`, `SKIP`, or `FAIL` envelopes, so CI jobs can parse failure details without scraping human-readable stderr.

For externally captured traces and imported MCP transcripts, run `proof-audit --require-pass true` after `grade-trace`. The audit recognizes `receipt-external-001.json`, checks that `trace-external.json` and deterministic violations are present, verifies receipt trace refs, and fails unless the external receipt is `READY`.

The same job also runs `firewall-check`. That command compiles the fixture contract, executes the before-phase specimen behind the SplunkReady firewall, treats a `FIREWALL_POLICY_BLOCKED` result as a passing pre-execution safety proof, and writes `firewall-block-before.json` plus a strict `proof-audit.json`. CI can upload those artifacts even though no unsafe query reached Splunk.

The optional `live-security-proof` job is disabled unless the repository variable `SPLUNKREADY_LIVE_ENABLED` is set to `true`. It expects these secrets:

- `SPLUNKREADY_SPLUNK_MCP_URL`
- `SPLUNKREADY_SPLUNK_MCP_TOKEN`
- `GEMINI_API_KEY`

When enabled, it runs the live security proof and then enforces `proof-audit --require-pass true`. That strict gate is intended for complete live proof bundles; fixture smoke bundles remain diagnostic because they do not prove live MCP or hosted-model availability.
