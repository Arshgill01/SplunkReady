# Live Demo Data Plan

SplunkReady now has real live MCP connectivity, live Gemini trace execution, and a guided `live-proof` command that can derive a read-only mission from the target deployment's own inventory. The remaining blocker for a flagship live security demo is still deployment content, not adapter code.

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

## Read-Only Candidate Scan

SplunkReady includes a bounded read-only candidate scan for checking whether the current live deployment already has useful saved-search evidence:

```bash
set -a && source ./.splunkready-live.env && set +a
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run splunkready -- live-candidates --out artifacts/live-proof --candidate-limit 12
```

The 2026-06-02 local scan checked 12 likely live saved searches, including Monitoring Console alerts and `search::Errors in the last 24 hours`. None returned rows or evidence refs.

This reinforces that the remaining blocker is live demo content, not agent behavior or adapter connectivity.

## Flagship Security Readiness Check

SplunkReady also includes a direct readiness diagnostic for the flagship lateral-movement story:

```bash
set -a && source ./.splunkready-live.env && set +a
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run splunkready -- live-security-check --out artifacts/live-security-check --json
```

This command is read-only. It compiles the live contract, checks for the exact saved search needed by the flagship mission, and only attempts to run that saved search when it is present:

```text
SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain
```

The 2026-06-02 local run wrote `artifacts/live-security-check/live-security-readiness.json` and reported:

- status: `BLOCKED`
- exact saved search present: `false`
- preferred `wineventlog` index present: `false`
- missing required MCP tools: none
- mutation: `false`

This means the current live endpoint is connected and tool-capable, but not ready for the flagship live security fail -> patch -> pass proof until the saved search and authentication/security data are added by an operator-approved setup step.

## Guided Live Proof Command

For a deployment that has any runnable saved-search candidate with rows, or at least `_internal` plus `splunk_run_query`, run:

```bash
set -a && source ./.splunkready-live.env && set +a
export SPLUNKREADY_LLM_ENABLED=true
export GEMINI_MODEL=gemini-3.1-flash-lite
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run splunkready -- live-proof --out artifacts/live-proof --candidate-limit 12
```

`live-proof` performs the live flow end to end:

1. compile the live environment contract;
2. scan bounded read-only saved-search candidates;
3. write `live-derived-mission.json` and `live-derived-readiness-profile.json`;
4. replace the standard mission/policy/profile artifacts with the generated mission;
5. run evaluate -> receipt -> rerun against live mode;
6. write `live-proof-summary.json` with `failToPass` and `readyWithoutPatch` flags.

If a candidate saved search returns rows, the generated mission expects saved-search discovery and saved-search execution. If no saved search returns rows but `_internal` is available, the generated mission falls back to a bounded raw-row `_internal` query proof. The command does not mutate Splunk.

## Non-Mutation Rule

SplunkReady must not auto-mutate Splunk. Any live demo data, saved search, app install, lookup, index, or event setup must be an operator-approved setup step outside the certification run.

## Option A: Preserve The Flagship Security Story

Use this when the final video must show lateral movement readiness.

SplunkReady can generate a local operator-owned setup kit for this path:

```bash
npm run splunkready -- live-security-kit --out artifacts/live-security-kit --json
```

The command writes local files only. It does not call Splunk and does not mutate any deployment. The generated kit includes:

- `SplunkEnterpriseSecuritySuite/default/savedsearches.conf` with the exact saved search `SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain`;
- `SplunkEnterpriseSecuritySuite/default/indexes.conf` with `wineventlog`;
- `SplunkEnterpriseSecuritySuite/default/props.conf` for `XmlWinEventLog:Security` CSV parsing;
- `lateral-movement-events.csv` with three evidence rows;
- `README.md` with operator install/import/rerun commands.

The app directory is intentionally named `SplunkEnterpriseSecuritySuite` because the readiness contract checks the saved-search app context, not just the saved-search display name. If Enterprise Security is already installed, merge the generated stanzas through the normal Splunk admin process instead of overwriting the app.

The generated CSV timestamps are intentionally fresh at kit creation time so the saved search's `-24h` window returns rows. Regenerate the kit immediately before importing if the local files are stale.

To inspect the current proof, security readiness diagnostic, and generated operator kit together in the Vite UI, create a UI bundle after running `live-security-proof` or `live-proof`, `live-security-check`, and `live-security-kit`:

```bash
npm run splunkready -- live-security-ui-bundle \
  --proof-dir artifacts/live-proof \
  --security-check-dir artifacts/live-security-check \
  --security-kit-dir artifacts/live-security-kit \
  --out artifacts/live-security-ui \
  --json

SPLUNKREADY_UI_ARTIFACT_DIR=artifacts/live-security-ui npm run ui:dev
```

The bundle command only copies existing JSON artifacts into one UI-ready directory. It does not call Splunk, generate fake receipts, install apps, or mutate the deployment.

When using the strict flagship path, set `--proof-dir artifacts/live-security-proof` instead of `artifacts/live-proof`.

Operator-approved setup required:

1. Create or install a read-only saved search named `ES - Lateral Movement Auth Chain` in app `SplunkEnterpriseSecuritySuite`.
2. Ensure the saved search returns at least one row for `win-finance-07` in the mission window `earliest=-24h latest=now`.
3. Ensure returned rows expose a stable evidence identifier such as `eventRef`, `_cd`, or `_raw`.
4. Re-run:

```bash
set -a && source ./.splunkready-live.env && set +a
export SPLUNKREADY_LLM_ENABLED=true
export GEMINI_MODEL=gemini-3.1-flash-lite
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run splunkready -- live-security-proof --out artifacts/live-security-proof --json
```

Expected passing signal:

- before receipt remains `NOT READY`;
- after receipt becomes `READY`;
- after trace includes `splunk_run_saved_search`;
- final answer cites the saved-search provenance, result count, and evidence refs.
- `live-proof-summary.json` feeds the Vite UI summary with `failToPass: true` and `mutation: false`.
- `live-security-proof-summary.json` has `failToPass: true`, `readyAfterPatch: true`, and `mutation: false`.

`live-security-proof` is intentionally stricter than `live-proof`: it first runs the flagship readiness diagnostic and refuses to proceed unless the exact `SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain` saved search returns evidence. It does not fall back to a generic live-derived mission.

## Option B: Use The Live-Derived Mission

Use this when the final video should prove live execution without installing Splunk Enterprise Security content.

Implementation status:

1. `live-candidates` now derives a saved-search mission when a candidate returns rows.
2. `live-candidates` now derives a bounded `_internal` mission when no candidate returns rows but `_internal` and `splunk_run_query` are available.
3. `live-proof` runs the generated mission through evaluate -> receipt -> rerun.
4. The flagship security fixture mission remains unchanged.

Tradeoff:

- This produces faster live proof with less setup.
- It is weaker for the security investigation narrative than Option A.

## Recommendation

For prize/demo quality, use Option A when the final story must be lateral movement security readiness. Use `live-proof` as the pragmatic live MCP proof path when the target Splunk deployment does not yet contain the security saved search and event data.
