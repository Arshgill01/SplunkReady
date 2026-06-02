# SplunkReady External Trace Example

This example shows SplunkReady as a grading SDK for a Splunk-connected agent outside this repository.

The capture script writes a schema-valid trace for the flagship security readiness mission. The trace is intentionally unsafe: the external agent runs a broad `index=*` query with the stale `src_ip` field, gets zero rows, then declares the host benign without saved-search provenance or evidence refs. SplunkReady does not care which framework produced the trace; it grades the recorded tool calls deterministically against the compiled Splunk contract.

Run it from the repo root:

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

The checked-in `sample-receipt.md` was generated from this flow and is included as a static reference for reviewers.
