# Demo Replay Refresh Report

Wave: 68 - Demo Replay Refresh

## Scope

Replayed the flagship security investigation readiness demo against the current branch with live Splunk environment variables unset.

## Demo Run

- Output directory: `/tmp/splunkready-wave68-demo/demo`
- Live env vars unset:
  - `SPLUNKREADY_LIVE_ENABLED`
  - `SPLUNKREADY_SPLUNK_MCP_URL`
  - `SPLUNKREADY_SPLUNK_MCP_TOKEN`

## Current Results

- Artifact count: 18.
- UI shell: `splunkready-shell.html` exists.
- Policy patch JSON/Markdown: `policy-patch.json` and `policy-patch.md` exist.
- Policy patch non-mutation text: PASS, Markdown says the patch does not change Splunk configuration and does not mutate Splunk.
- Before receipt: `receipt-before-001`, verdict `NOT READY`, score `0`.
- After receipt: `receipt-after-001`, verdict `READY`, score `100`, violations `0`.
- Rehearsal timing: PASS, `fitsUnderThreeMinutes: true`, measured CLI orchestration `0.026s`.
- Rehearsal story: `fail -> compile -> patch -> rerun -> pass`.
- UI route: `/tmp/splunkready-wave68-demo/demo/splunkready-shell.html#rerun-receipts`.
- Deterministic rule IDs: `ANS-001`, `EVD-001`, `KO-001`, `SPL-001`, `SPL-003`.

## Artifact Set

- `agent-policy.json`
- `demo-rehearsal.json`
- `demo-rehearsal.md`
- `environment-contract.json`
- `missions.json`
- `policy-patch.json`
- `policy-patch.md`
- `receipt-after-001.json`
- `receipt-after-001.md`
- `receipt-before-001.json`
- `receipt-before-001.md`
- `score-after.json`
- `score-before.json`
- `splunkready-shell.html`
- `trace-after.json`
- `trace-before.json`
- `violations-after.json`
- `violations-before.json`

## Conclusion

The current fixture demo replay passes without live Splunk credentials and preserves the flagship fail -> patch -> rerun -> pass story. The overall goal remains open pending explicit user approval.
