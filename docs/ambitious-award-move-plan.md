# Ambitious Award Move Plan

Captured: 2026-06-07

This plan converts the latest competitive audit into implementation moves. It is
not a license to weaken SplunkReady's product boundaries: deterministic rules
remain authoritative, LLM/SAIA output stays advisory, fixture/live parity stays
shared after the adapter, and SplunkReady does not auto-mutate Splunk.

## Sequencing Decision

The real external MCP-client recording is high-value but currently parked. Prior
attempts spent time on desktop capture without enough product value. It remains
on the checklist, but it moves behind product features that improve every judge
path without depending on a closed desktop app.

## Checklist

| Order | Move | Status | Why Now | Done When |
| --- | --- | --- | --- | --- |
| 1 | [Move 147](../moves/moves147.md) Self-hostable Splunk MCP mock server | Implemented | Closes the biggest reproducibility leak: live-mode proof without operator-owned Splunk credentials. | `npx -y splunkready@latest live-proof --live-mock --out ./live-mock --json` returns `PASS`, `mutation=false`, from a clean folder with no env vars; CI runs the mock live proof; `submission-evidence/live-mock/` ships the proof. |
| 2 | [Move 148](../moves/moves148.md) Hash-chain receipt signing and replay lineage | Implemented | Turns Readiness Receipts into verifiable, replayable audit artifacts. | `npx splunkready verify-receipt-chain --dir submission-evidence/suite-proof --public-key submission-evidence/receipt-public-key.pem --json` reports `chainValid: true` for 3+ receipts; `submission-evidence/suite-proof/receipt-chain.json` exists. |
| 3 | [Move 149](../moves/moves149.md) Interactive public certification demo | Implemented | Lets judges run a real certification action from the hosted demo instead of only inspecting static evidence. | Hosted demo route `?demo=interactive` accepts a trace JSON, grades it through a deployed certifier endpoint, and renders a real receipt with violations, evidence refs, and policy patch summary in under 3 seconds. |
| 4 | [Move 150](../moves/moves150.md) Signed multi-tenant policy registry | Implemented | Moves SplunkReady from built-in rules to named, versioned, signed policy bundles. | `npx splunkready policy-publish --policy policies/soc2-readiness.policy.json --json` validates/signs; `npx splunkready evaluate --policy pci-dss-readiness ...` emits a receipt naming policy ID/version. |
| 5 | [Move 151](../moves/moves151.md) Real external MCP-client session evidence | Parked | Still useful for MCP judging, but lower immediate leverage than product surfaces above and dependent on desktop-app capture behavior. | A redacted external-client JSON-RPC session exists, is 50+ frames, uses `splunkready_certify_mcp_transcript_content`, and summary reports `externalClientSession: VERIFIED`. |

## Move 147 Spec

### Goal

Provide a self-hostable, read-only Splunk MCP mock server that exercises the
same live adapter path as operator-owned Splunk MCP without requiring Splunk
credentials. This is not a shortcut around fixture/live parity; it is a live
transport with deterministic canned responses generated from the existing
fixture deployment.

### Required Surface

- Package subpath export: `splunkready/mock-splunk-mcp`.
- CLI command: `splunkready mock-splunk-mcp`.
- CLI flag: `--live-mock` for `live-proof`, `live-security-proof`, and
  `mcp-proof`.
- Mock state knob: `--mock-state ok|degraded|route-not-found`.
- Docker support: `Dockerfile.mock-splunk-mcp` and `docker-compose.mock.yml`.
- CI proof: run live mock proof on every PR/push.
- Evidence: `submission-evidence/live-mock/`.

### Contract

The mock server must implement realistic read-only responses for:

- `splunk_get_info`
- `splunk_get_knowledge_objects`
- `splunk_run_saved_search`
- `splunk_run_query`
- `saia_generate_spl`
- `saia_explain_spl`
- `saia_optimize_spl`
- `saia_ask_splunk_question`

The implementation should use existing fixture data and preserve realistic
latency, pagination metadata where practical, and route-not-found/degraded
failure modes that map to existing hosted-model diagnostics.

### Stop Conditions

- Do not introduce write operations against Splunk.
- Do not make SAIA output authoritative.
- Do not claim real Splunk deployment evidence from the mock path.
- Do not add a heavy dependency unless the standard MCP JSON-RPC server shape is
  insufficient.

### First Slice

The first implementation slice should prove the transport boundary, not the
entire mock:

1. Add the `mock-splunk-mcp` package subpath and CLI command.
2. Implement `initialize`, `tools/list`, and `tools/call` for
   `splunk_get_info` and `splunk_get_knowledge_objects`.
3. Add tests that initialize the server and call both tools.
4. Add a move log proving the mock is read-only and credential-free.

Only after that slice passes should `--live-mock` be wired into `live-proof`.

## Evidence Rules

For every ambitious move:

- Record exact commands and results in `logs/verification-log.md`.
- Record risk movement and residual risk in `logs/risk-register.md`.
- Do not update public claim rows until the evidence exists.
- If a source change affects public demo input, rerun Pages and currentness
  audits.
- If a source change affects npm judge paths, publish or clearly label it as
  source-only until package currentness passes.

## Next Tier After Move 157

Captured: 2026-06-07

DeepSeek's latest list is directionally useful, but several items need to be
rewritten against current repo reality and the user's constraints:

- The `.spl` package proof already exists in Move 157. The next Splunk-app move
  must be AppInspect/live-install/KV-store grade, not another static package.
- A naive `esbuild` bundle does not remove the Node.js dependency. A true
  no-Node artifact should use Node single executable application packaging or an
  equivalent release-matrix wrapper. Node's SEA support is documented in the
  official Node 22+ docs.
- The closed-client MCP recording is still useful, but the user explicitly
  rejected Claude Desktop and Cursor-as-agent work. Build a client-neutral MCP
  session recorder/composition gateway first; Antigravity or Zed can consume it
  later.
- The strongest immediate platform move is a PR certification gate, because it
  turns the already-real live-mock proof into review-surface evidence.

Research anchors:

- Node SEA: https://nodejs.org/api/single-executable-applications.html
- GitHub release assets: https://docs.github.com/en/rest/releases/assets
- Splunk AppInspect CLI/API: https://dev.splunk.com/enterprise/reference/appinspect/appinspectcliref and https://dev.splunk.com/enterprise/docs/developapps/testvalidate/appinspect/useappinspectapi

| Order | Move | Status | Why Now | Done When |
| --- | --- | --- | --- | --- |
| 1 | [Move 158](../moves/moves158.md) Live readiness PR gate | Planned | Highest leverage per day: uses live-mock proof, receipt artifacts, and GitHub review surface with no external license dependency. | A PR workflow runs `live-proof --live-mock`, strict `proof-audit`, renders a stable markdown Readiness comment, uploads artifacts, and has a tracked sample comment JSON/Markdown. |
| 2 | [Move 159](../moves/moves159.md) MCP composition recorder gateway | Planned | Replaces fragile desktop recording with a productized way to capture dual-server MCP sessions from any client, then certify the captured transcript. | A local recorder can proxy/capture Splunk MCP and SplunkReady MCP JSON-RPC frames, redact them, and emit a certifiable dual-server session artifact. |
| 3 | [Move 160](../moves/moves160.md) Standalone release artifacts | Planned | Removes Node/npm as the judge friction cap, but only if it produces real no-Node executables rather than a JS bundle. | Tag-triggered release workflow builds signed/checksummed OS assets, and a clean temp smoke runs `splunkready judge-proof` without preinstalled project dependencies. |
| 4 | [Move 161](../moves/moves161.md) AppInspect-grade Splunk app | Planned | Move 157 proves packaging; the next value jump is install/vetting evidence and optional operator-owned receipt storage. | The app package passes local AppInspect-compatible checks, includes dashboard/KV-store config as operator-owned surfaces, and has tracked install evidence or an explicit blocked reason. |
| 5 | [Move 162](../moves/moves162.md) Typed policy SDK | Planned | Turns the signed JSON policy registry into a developer platform with IDE types, tests, and package subpath exports. | `import { definePolicy } from "splunkready/policy"` works in a clean TS project; example TS policies compile, sign, and grade fixture traces in CI. |
