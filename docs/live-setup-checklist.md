# SplunkReady Live Setup Checklist

This checklist is the Phase Live gate for proving SplunkReady against a real Splunk MCP endpoint. The target command is:

```bash
npm run splunkready -- live-smoke --out artifacts/live-smoke --require-live true
```

When it passes, `artifacts/live-smoke/live-smoke-contract.json` must contain real deployment metadata from Splunk, not fixture values.

## 1. Prepare Splunk

Use a non-production Splunk Enterprise trial, Splunk Cloud trial, or another approved read-only Splunk deployment.

1. Install and start Splunk.
2. Confirm you can sign in to Splunk Web.
3. Confirm REST/API access is enabled for the deployment.
4. Confirm token authentication is enabled.
5. Install the Splunk MCP Server app from Splunkbase on the Search Head or Search Head Cluster.
6. Restart Splunk if the MCP Server app install asks for it.
7. Add `mcp_tool_execute` to the Splunk role used for this smoke run.
8. Ensure the token creator has `edit_tokens_own` plus `mcp_tool_admin`, or ask a Splunk admin to create the MCP token.

Official references:

- Splunk MCP Server setup requires API access, token authentication, the MCP Server app, and role-based access with `mcp_tool_execute`.
- Splunk MCP token creation requires an encrypted MCP token generated from the Splunk MCP Server app.
- Splunk MCP tools use the `splunk_` namespace for platform tools and `saia_` for Splunk AI Assistant for SPL tools.

## 2. Get The MCP Endpoint And Token

In Splunk Web:

1. Open the Splunk MCP Server app.
2. Generate a new encrypted MCP token.
3. Copy the token immediately; Splunk displays it once.
4. Copy the MCP server endpoint from the MCP Server app sample client configuration.

The endpoint is the value shown as `<MCP_SERVER_ENDPOINT>` in the app's sample client config. For Splunk Cloud MCP, it may look like:

```text
https://<deployment>.api.scs.splunk.com/<deployment>/mcp/v1/
```

For an on-deployment MCP Server app, use the exact endpoint shown by the Splunk MCP Server app. Do not guess the path.

## 3. Export Local Environment Variables

Export the values only in your local shell. Do not write secrets to repo files, `.env` files, screenshots, logs, fixtures, or reviewer notes.

```bash
export SPLUNKREADY_LIVE_ENABLED=true
export SPLUNKREADY_SPLUNK_MCP_URL='https://<MCP_SERVER_ENDPOINT>'
export SPLUNKREADY_SPLUNK_MCP_TOKEN='<YOUR_ENCRYPTED_MCP_TOKEN>'
export SPLUNKREADY_SPLUNK_APP='search'
export SPLUNKREADY_SPLUNK_TIMEOUT_MS=30000
```

Leave `SPLUNKREADY_SPLUNK_CAPABILITIES` unset for `live-smoke`. The command pins its own inventory-only allowlist:

- `splunk_get_info`
- `splunk_get_user_info`
- `splunk_get_indexes`
- `splunk_get_metadata`
- `splunk_get_knowledge_objects`

`live-smoke` does not call `splunk_run_query`, does not run saved searches, and does not mutate Splunk.

## 4. Verify The No-Credential Skip Path

Before using real credentials, verify the safe skip behavior:

```bash
npm run build
env -u SPLUNKREADY_LIVE_ENABLED \
  -u SPLUNKREADY_SPLUNK_MCP_URL \
  -u SPLUNKREADY_SPLUNK_MCP_TOKEN \
  npm run splunkready -- live-smoke --out artifacts/live-smoke-skip
```

Expected terminal shape:

```text
SKIP live-smoke
Live smoke skipped; missing SPLUNKREADY_LIVE_ENABLED=true, SPLUNKREADY_SPLUNK_MCP_URL, SPLUNKREADY_SPLUNK_MCP_TOKEN. No live Splunk calls were made and no live artifacts were written.
```

Expected artifact result:

- No live contract is written.
- `artifacts/live-smoke-skip/live-smoke-contract.json` should not exist.

## 5. Optional Manual MCP Sanity Check

If you want to isolate endpoint/token issues before running SplunkReady, call a single read-only MCP tool:

```bash
curl -sS -X POST "$SPLUNKREADY_SPLUNK_MCP_URL" \
  -H "Authorization: Bearer $SPLUNKREADY_SPLUNK_MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "splunkready-manual-sanity:splunk_get_info",
    "method": "tools/call",
    "params": {
      "name": "splunk_get_info",
      "arguments": {},
      "defaultApp": "search"
    }
  }'
```

Healthy response shape should include one of:

- `result.structuredContent`
- `result.output`
- `result.content[].text`
- direct `output`

Any response containing a deployment name, server/version metadata, or read-only tool list is enough to proceed.

## 6. Run Required Live Smoke

From the repo root:

```bash
npm run build
rm -rf artifacts/live-smoke
npm run splunkready -- live-smoke --out artifacts/live-smoke --require-live true
```

For a local Splunk Enterprise trial on `https://localhost:8089` with the default self-signed certificate, use this temporary local-only variant:

```bash
npm run build
rm -rf artifacts/live-smoke
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run splunkready -- live-smoke --out artifacts/live-smoke --require-live true
```

Do not use `NODE_TLS_REJECT_UNAUTHORIZED=0` for production, shared, or internet-reachable Splunk deployments. Install or trust the Splunk certificate instead.

Expected terminal shape:

```text
PASS live-smoke
artifact artifacts/live-smoke/live-smoke-contract.json
artifact artifacts/live-smoke/live-smoke-readiness-profile.json
artifact artifacts/live-smoke/live-smoke-summary.json
```

Expected files:

- `artifacts/live-smoke/live-smoke-contract.json`
- `artifacts/live-smoke/live-smoke-readiness-profile.json`
- `artifacts/live-smoke/live-smoke-summary.json`

## 7. Inspect The Proof Artifact

Run:

```bash
node -e "const fs=require('fs'); const c=JSON.parse(fs.readFileSync('artifacts/live-smoke/live-smoke-contract.json','utf8')); const s=JSON.parse(fs.readFileSync('artifacts/live-smoke/live-smoke-summary.json','utf8')); console.log(JSON.stringify({mode:c.mode,name:c.name,indexes:c.indexes.map(i=>i.name),sourcetypes:c.sourcetypes.map(st=>st.name),tools:s.allowedTools,readOnly:s.readOnlyToolsOnly,destructive:s.destructiveOperations}, null, 2));"
```

Pass criteria:

- `mode` is `live`.
- `name` is a real Splunk deployment name, not `acme-soc-dev`.
- `indexes` contains real Splunk index names.
- `sourcetypes` contains real sourcetypes if the deployment has recent metadata.
- `tools` contains only the fixed live-smoke inventory allowlist.
- `readOnly` is `true`.
- `destructive` is `false`.

## 8. Troubleshooting

If the command fails with `LIVE_ADAPTER_DISABLED`:

- Confirm `SPLUNKREADY_LIVE_ENABLED=true` is exported in the same shell.

If the command fails with `LIVE_ADAPTER_MISSING_CONFIG`:

- Confirm `SPLUNKREADY_SPLUNK_MCP_URL` and `SPLUNKREADY_SPLUNK_MCP_TOKEN` are exported.
- Confirm the token value was not copied with extra quotes, spaces, or line breaks.

If the MCP endpoint returns `401` or `403`:

- Generate a fresh encrypted token in the Splunk MCP Server app.
- Confirm the user role has `mcp_tool_execute`.
- Confirm the token creator had `edit_tokens_own` plus `mcp_tool_admin`, or that an admin-created token is being used.

If the endpoint returns `404`:

- Do not guess the URL.
- Copy the endpoint again from the Splunk MCP Server app sample config.

If `splunk_get_knowledge_objects` fails:

- Confirm Splunk platform tools are enabled in the MCP Server app.
- Confirm server-side tool management has not disabled the relevant tools.

If self-signed certs block a local non-production deployment:

- Prefer a trusted cert when possible.
- For a throwaway local trial only, configure the MCP Server app's `ssl_verify` testing setting as documented by Splunk. Do not carry that setting into production.

## 9. Optional Hosted-Model Diagnostic

After live smoke works, test whether the same MCP user can invoke Splunk AI Assistant helper tools:

```bash
rm -rf artifacts/hosted-model-diagnostic
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run splunkready -- hosted-model-diagnostic \
  --mode live \
  --out artifacts/hosted-model-diagnostic \
  --require-pass true \
  --json
```

Use `NODE_TLS_REJECT_UNAUTHORIZED=0` only for a local non-production Splunk trial with a self-signed certificate.

If the live variables are stored in an ignored operator-owned env file, pass it
explicitly instead of sourcing it in an agent transcript:

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run splunkready -- hosted-model-diagnostic \
  --mode live \
  --env-file .splunkready \
  --out artifacts/hosted-model-diagnostic \
  --require-pass true \
  --json
```

The env file parser supports `KEY=value` and `export KEY=value` lines. The
diagnostic still writes only variable names and set/missing/invalid status to
artifacts; token values are not written.

Expected terminal shape when SAIA access is available:

```json
{
  "command": "hosted-model-diagnostic",
  "status": "PASS"
}
```

Expected files:

- `artifacts/hosted-model-diagnostic/environment-contract.json`
- `artifacts/hosted-model-diagnostic/hosted-model-proof.json`
- `artifacts/hosted-model-diagnostic/hosted-model-diagnostic.json`

Pass criteria:

- `hosted-model-diagnostic.json` has `status: "PASS"`.
- `permission.status` is `OK`.
- `requiredTools` includes `saia_generate_spl`, `saia_explain_spl`, `saia_optimize_spl`, and `saia_ask_splunk_question`.
- `mutation` is `false`.
- The diagnostic did not run generated, unsafe, or optimized SPL; it only called hosted-model helper tools.

If the live variables are not exported in the current shell, the command writes
`hosted-model-proof.json` and `hosted-model-diagnostic.json` with
`status: "BLOCKED"` before making any MCP call. The `setup` block records only
variable names and `set` / `missing` / `invalid` status; it does not write token
values.

If this command fails with a hosted-model access error:

- Keep the same read-only Splunk/MCP user if possible.
- Grant that user permission or entitlement to invoke `saia_generate_spl`.
- Grant that user permission or entitlement to invoke `saia_explain_spl`.
- Grant that user permission or entitlement to invoke `saia_optimize_spl`.
- Grant that user permission or entitlement to invoke `saia_ask_splunk_question`.
- Rerun the command with `--require-pass true`.

If the diagnostic says the MCP endpoint returned not found while invoking SAIA
tools:

- Confirm the endpoint can invoke `saia_generate_spl`, `saia_explain_spl`,
  `saia_optimize_spl`, and `saia_ask_splunk_question`, not only advertise them
  in tool discovery.
- Confirm the MCP server route or app version backing hosted-model tools is
  installed and reachable.
- Rerun the command with `--require-pass true`.

This diagnostic is separate from grading. SAIA output may generate, explain, optimize, or answer questions about SPL, but deterministic SplunkReady rules still decide pass/fail.

## 10. Screenshot Requirements

Capture screenshots only after the live smoke passes:

1. Terminal showing `PASS live-smoke`.
2. A redacted view of `live-smoke-contract.json` showing `mode: live`, real index names, and real sourcetypes.
3. A redacted view of `live-smoke-summary.json` showing `readOnlyToolsOnly: true` and `destructiveOperations: false`.
4. If hosted-model access is enabled, terminal or UI showing `hosted-model-diagnostic` with `permission.status: OK`.

Never include the token, full endpoint if it is sensitive, or user-identifying fields in screenshots.

## 11. Move 1 Done Criteria

Move 1 is done only when all of these are true:

- `npm run splunkready -- live-smoke --out artifacts/live-smoke --require-live true` exits with `PASS live-smoke`.
- `artifacts/live-smoke/live-smoke-contract.json` exists.
- The contract has `mode: "live"` and real Splunk deployment metadata.
- `artifacts/live-smoke/live-smoke-summary.json` has `readOnlyToolsOnly: true` and `destructiveOperations: false`.
- Screenshots have been captured with secrets redacted.

## 12. Current Local Proof

On 2026-06-02, the local Splunk MCP endpoint passed live smoke with the local-only self-signed certificate workaround:

```bash
rm -rf artifacts/live-smoke && set -a && source ./.splunkready-live.env && set +a && NODE_TLS_REJECT_UNAUTHORIZED=0 npm run splunkready -- live-smoke --out artifacts/live-smoke --require-live true
```

Sanitized result:

- `status`: `PASS`
- `mode`: `live`
- index count: `13`
- saved search count: `100`
- sourcetype count: `0` for the `-15m` smoke metadata window
- read-only inventory tools only: `true`
- destructive operations: `false`

On 2026-06-03, the local Splunk MCP endpoint produced a live security fail-to-pass proof, but hosted-model diagnostic proof remained blocked by SAIA permission:

- before policy: `NOT READY`, score `60`, violations `2`
- after policy: `READY`, score `100`, violations `0`
- `failToPass`: `true`
- `hosted-model-proof.status`: `BLOCKED`
- blocked tools: `saia_explain_spl`, `saia_optimize_spl`

On 2026-06-07, after the operator-owned cloud connection and token were
available, the strict hosted-model diagnostic reached the live MCP endpoint with
the ignored env file and the local TLS workaround, but live SAIA proof remained
blocked at invocation time:

- `hosted-model-diagnostic.status`: `BLOCKED`
- `mutation`: `false`
- advertised tools: `saia_generate_spl`, `saia_explain_spl`,
  `saia_optimize_spl`, `saia_ask_splunk_question`
- passed tools: none
- blocked tools: `saia_generate_spl`, `saia_explain_spl`,
  `saia_optimize_spl`, `saia_ask_splunk_question`
- blocker class: the endpoint advertises hosted-model tools, but the live route
  returns not found when invoking them.
- redaction check: hosted-model proof and diagnostic errors contain
  `[REDACTED_URL]` and no raw `https://` endpoint URL.

Do not claim live SAIA PASS until this same command exits PASS with
`--require-pass true`.
