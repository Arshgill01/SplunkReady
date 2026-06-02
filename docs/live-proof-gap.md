# Live Proof Status

Status: live Splunk MCP proof exists locally, but the flagship live mission is not yet a passing readiness demo.

## What Is Proven

On 2026-06-02, SplunkReady successfully connected to the user's local Splunk MCP endpoint through `.splunkready-live.env`.

The live smoke command passed and wrote live inventory artifacts:

```bash
rm -rf artifacts/live-smoke
set -a && source ./.splunkready-live.env && set +a
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run splunkready -- live-smoke --out artifacts/live-smoke --require-live true
```

Sanitized result:

- `mode`: `live`
- indexes: `13`
- saved searches: `100`
- read-only inventory tools only: `true`
- destructive operations: `false`

The Gemini specimen also ran through the live adapter, not fixture mode:

```bash
rm -rf artifacts/live-proof
set -a && source ./.splunkready-live.env && set +a
export SPLUNKREADY_LLM_ENABLED=true
export GEMINI_MODEL=gemini-3.1-flash-lite
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run splunkready -- compile --mode live --out artifacts/live-proof
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run splunkready -- evaluate --mode live --out artifacts/live-proof
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run splunkready -- receipt --mode live --out artifacts/live-proof
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run splunkready -- rerun --mode live --out artifacts/live-proof
```

Sanitized result:

- contract mode: `live`
- MCP tools in contract: `splunk_get_info`, `splunk_get_user_info`, `splunk_get_indexes`, `splunk_get_metadata`, `splunk_get_knowledge_objects`, `splunk_run_query`, `splunk_run_saved_search`, `saia_explain_spl`, `saia_optimize_spl`
- before policy: `NOT READY`, score `60`, violations `KO-001` and `EVD-001`
- after policy: `NOT READY`, score `60`, violations `KO-001` and `EVD-001`
- live execution included `splunk_get_knowledge_objects` and `splunk_run_saved_search`
- no Splunk mutation was performed

## Remaining Gap

The live endpoint is real, but the current flagship mission is still fixture-shaped:

- The mission expects `SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain`.
- The live trial deployment did not expose that saved search in the compiled live contract.
- The LLM therefore selected a generic live saved search, `search:Errors in the last 24 hours`.
- That saved search returned `0` rows and no evidence refs for the lateral-movement story.
- The deterministic grader correctly kept the receipt `NOT READY`.

This is not a live adapter failure. It is a live mission/data compatibility gap.

## Next Required Action

To produce the final live fail-to-pass demo, choose one of these paths:

1. Prepare the live Splunk deployment with the security mission's expected saved search and event data, after explicit operator approval. SplunkReady must not auto-mutate Splunk.
2. Add a live-compatible mission that targets saved searches and data already present in the trial deployment, then grade that mission end to end.

Until one of those is done, the honest claim is:

> SplunkReady has live MCP proof and live LLM trace proof, but not yet a passing live security-readiness receipt.
