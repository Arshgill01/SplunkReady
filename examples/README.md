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
```

The grading command writes `trace-external.json`, `violations-external.json`, `score-external.json`, and `receipt-external-001.md` into `$tmp`.

The checked-in `sample-receipt.md` was generated from this flow and is included as a static reference for reviewers. It returns `NOT READY` with deterministic violations for `SPL-001`, `SPL-003`, `KO-001`, `EVD-001`, and `ANS-001`.

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
```

The checked-in `sample-pass-receipt.md` was generated from this flow. It returns `READY / 100` with no violations, proving the SDK path can certify an external agent trace when the trace uses validated knowledge objects and carries evidence provenance.

## CI gate example

`github-workflow-example.yml` shows how a repository can use SplunkReady as a pull-request gate.

The default `fixture-smoke` job runs without live Splunk credentials. It compiles the fixture contract, evaluates the specimen, issues the receipt, reruns with the compiled policy, writes a diagnostic `proof-audit.json`, and blocks the merge unless the final receipt is `READY`.

The job also runs `suite-proof --require-fail-to-pass true` against the default suite manifest. That stricter gate proves the security and observability fixture missions all execute the full NOT READY -> patch -> READY certification loop, rather than merely ending in a READY state. Repositories can pass `--suite <path>` to point the same gate at their own mission manifests.

CLI commands that include `--json` emit structured `PASS`, `SKIP`, or `FAIL` envelopes, so CI jobs can parse failure details without scraping human-readable stderr.

The same job also runs `firewall-check`. That command compiles the fixture contract, executes the before-phase specimen behind the SplunkReady firewall, treats a `FIREWALL_POLICY_BLOCKED` result as a passing pre-execution safety proof, and writes `firewall-block-before.json` plus a strict `proof-audit.json`. CI can upload those artifacts even though no unsafe query reached Splunk.

The optional `live-security-proof` job is disabled unless the repository variable `SPLUNKREADY_LIVE_ENABLED` is set to `true`. It expects these secrets:

- `SPLUNKREADY_SPLUNK_MCP_URL`
- `SPLUNKREADY_SPLUNK_MCP_TOKEN`
- `GEMINI_API_KEY`

When enabled, it runs the live security proof and then enforces `proof-audit --require-pass true`. That strict gate is intended for complete live proof bundles; fixture smoke bundles remain diagnostic because they do not prove live MCP or hosted-model availability.
