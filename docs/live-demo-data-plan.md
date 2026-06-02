# Live Demo Data Plan

SplunkReady now has real live MCP connectivity and live Gemini trace execution. The remaining blocker for a passing live demo is deployment content, not adapter code.

## Current Live Finding

The local live proof wrote artifacts under `artifacts/live-proof` with:

- contract mode: `live`
- indexes: `13`
- saved searches: `100`
- tools: inventory tools, `splunk_run_query`, `splunk_run_saved_search`, `saia_explain_spl`, `saia_optimize_spl`
- before receipt: `NOT READY`, score `60`, violations `KO-001` and `EVD-001`
- after receipt: `NOT READY`, score `60`, violations `KO-001` and `EVD-001`

The live trial does not currently contain the flagship mission's expected saved search:

```text
SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain
```

The rerun therefore used an available generic saved search:

```text
search:Errors in the last 24 hours
```

That returned zero rows and no evidence refs. The deterministic grader correctly refused to issue a `READY` receipt.

## Non-Mutation Rule

SplunkReady must not auto-mutate Splunk. Any live demo data, saved search, app install, lookup, index, or event setup must be an operator-approved setup step outside the certification run.

## Option A: Preserve The Flagship Security Story

Use this when the final video must show lateral movement readiness.

Operator-approved setup required:

1. Create or install a read-only saved search named `ES - Lateral Movement Auth Chain` in app `SplunkEnterpriseSecuritySuite`.
2. Ensure the saved search returns at least one row for `win-finance-07` in the mission window `earliest=-24h latest=now`.
3. Ensure returned rows expose a stable evidence identifier such as `eventRef`, `_cd`, or `_raw`.
4. Re-run:

```bash
set -a && source ./.splunkready-live.env && set +a
export SPLUNKREADY_LLM_ENABLED=true
export GEMINI_MODEL=gemini-3.1-flash-lite
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run splunkready -- compile --mode live --out artifacts/live-proof
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run splunkready -- evaluate --mode live --out artifacts/live-proof
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run splunkready -- receipt --mode live --out artifacts/live-proof
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run splunkready -- rerun --mode live --out artifacts/live-proof
```

Expected passing signal:

- before receipt remains `NOT READY`;
- after receipt becomes `READY`;
- after trace includes `splunk_run_saved_search`;
- final answer cites the saved-search provenance, result count, and evidence refs.

## Option B: Add A Live-Compatible Mission

Use this when the final video should prove live execution without installing Splunk Enterprise Security content.

Implementation required:

1. Add a mission that targets a saved search already present in the live trial, such as `search::Errors in the last 24 hours`.
2. Adjust the mission prompt, checks, and expected evidence to match the actual deployment content.
3. Keep the flagship security fixture mission unchanged.
4. Label the mission clearly as a live trial proof mission, not the flagship security investigation story.

Tradeoff:

- This produces faster live proof with less setup.
- It is weaker for the security investigation narrative than Option A.

## Recommendation

For prize/demo quality, use Option A. It preserves the product story: SplunkReady certifies an AI agent against the actual Splunk deployment contract before the agent is trusted in production.
