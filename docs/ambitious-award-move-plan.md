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
| 1 | [Move 147](../moves/moves147.md) Self-hostable Splunk MCP mock server | Planned | Closes the biggest reproducibility leak: live-mode proof without operator-owned Splunk credentials. | `npx -y splunkready@latest live-proof --live-mock --out ./live-mock --json` returns `PASS`, `mutation=false`, from a clean folder with no env vars; CI runs the mock live proof; `submission-evidence/live-mock/` ships the proof. |
| 2 | [Move 148](../moves/moves148.md) Hash-chain receipt signing and replay lineage | Planned | Turns Readiness Receipts into verifiable, replayable audit artifacts. | `npx splunkready verify-receipt-chain --dir submission-evidence/suite-proof --public-key submission-evidence/receipt-public-key.pem --json` reports `chainValid: true` for 3+ receipts; `submission-evidence/suite-proof/receipt-chain.json` exists. |
| 3 | [Move 149](../moves/moves149.md) Interactive public certification demo | Planned | Lets judges run a real certification action from the hosted demo instead of only inspecting static evidence. | Hosted demo route `?demo=interactive` accepts a trace JSON, grades it through a deployed certifier endpoint, and renders a real receipt with violations, evidence refs, and policy patch summary in under 3 seconds. |
| 4 | [Move 150](../moves/moves150.md) Signed multi-tenant policy registry | Planned | Moves SplunkReady from built-in rules to named, versioned, signed policy bundles. | `npx splunkready policy-publish --policy policies/soc2-readiness.policy.json --json` validates/signs; `npx splunkready evaluate --policy pci-dss-readiness ...` emits a receipt naming policy ID/version. |
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
