# Live Proof Status

Status: live Splunk MCP proof exists locally, and the flagship live security proof is now green on the local Splunk trial after operator-approved setup. The current source-of-truth proof is `artifacts/live-security-proof`: a real Gemini-backed agent trace against live Splunk MCP that moves from `NOT READY` to `READY` without SplunkReady mutating Splunk.

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

A bounded read-only candidate scan also ran:

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run splunkready -- live-candidates --out artifacts/live-proof --candidate-limit 12
```

It checked 12 likely saved searches and found zero candidates with rows.

After that finding, SplunkReady added a generated live proof path:

```bash
set -a && source ./.splunkready-live.env && set +a
export SPLUNKREADY_LLM_ENABLED=true
export GEMINI_MODEL=gemini-3.1-flash-lite
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run splunkready -- live-proof --out artifacts/live-proof --candidate-limit 12
```

The command compiles the live contract, runs the bounded candidate scan, writes `live-derived-mission.json`, then evaluates and reruns against that generated mission. In tests, this path produces normal Readiness Receipt artifacts from a saved-search candidate with rows.

The command was also rerun against the user's real Splunk MCP endpoint after implementation:

- strategy: `internal-query-fallback`
- candidates checked: `12`
- saved-search candidates with rows: `0`
- mission: `mission-live-internal-query-readiness`
- before receipt: `READY`, score `100`, violations `0`
- after receipt: `READY`, score `100`, violations `0`
- `live-proof-summary.json`: `readyWithoutPatch: true`, `failToPass: false`

This proves live certification with real MCP, Gemini, query execution, evidence refs, and receipts. It does not prove the flagship fail-to-pass patch loop because the generated `_internal` mission was already safe enough before policy injection.

## Flagship Security Proof

After the operator-owned live security kit was installed and sample evidence was imported, the strict flagship command passed against the local live endpoint:

```bash
set -a && source ./.splunkready-live.env && set +a
export SPLUNKREADY_LLM_ENABLED=true
export GEMINI_MODEL=gemini-3.1-flash-lite
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run splunkready -- live-security-proof --out artifacts/live-security-proof --json
```

Sanitized result:

- readiness diagnostic: `READY_FOR_FLAGSHIP_LIVE_SECURITY_PROOF`
- exact saved search: `SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain`
- saved-search result count: `3`
- evidence refs: `live-evt-141`, `live-evt-118`, `live-evt-102`
- before receipt: `NOT READY`, score `60`, violations `KO-001` and `EVD-001`
- after receipt: `READY`, score `100`, violations `0`
- `live-proof-summary.json`: `strategy: saved-search-with-evidence`, `failToPass: true`, `readyWithoutPatch: false`, `mutation: false`
- `live-security-proof-summary.json`: `status: PASS`, `failToPass: true`, `readyAfterPatch: true`, `mutation: false`

This is the flagship live proof path. Earlier blocked states in this document are historical context only.

## Operational Notes

- SplunkReady still does not auto-mutate Splunk.
- The app/saved-search/sample-event setup remains an operator-approved step outside the certification run.
- Local proof artifacts under `artifacts/live-security-proof` and `artifacts/live-security-ui` are intentionally untracked because they can contain deployment-identifying inventory.
- Local TLS still uses the development-only `NODE_TLS_REJECT_UNAUTHORIZED=0` workaround for the self-signed Splunk certificate.

## Current Honest Claim

> SplunkReady has live MCP proof, live LLM trace proof, a strict flagship live security readiness proof, and a live `NOT READY -> READY` Readiness Receipt loop. The proof remains read-only from SplunkReady's perspective; all Splunk setup was operator-owned.
