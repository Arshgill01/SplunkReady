# SplunkReady Submission Evidence

Regenerated for Move 78 on 2026-06-06 and extended with Move 80/82/92 MCP workbench and client-walkthrough evidence, Move 100 published-package evidence, Move 103 public judge-proof evidence, Move 109 raw MCP client-session evidence, Move 111 MCP resource-template evidence, Move 112 inline MCP transcript certification evidence, Move 113 hosted-model MCP access evidence, Move 147 live-mock MCP evidence, and Move 148 signed receipt-chain plus deterministic replay evidence.

This directory is the judge-facing evidence pack. It is tracked in git so it can be inspected from a clean clone without access to ignored local `artifacts/`, `.splunkready*` env files, live credentials, or private deployment details.

## Contents

- `suite-proof/`: credential-free multi-mission fixture proof. It includes the full proof bundle, compiler diagnostics, strict `proof-audit.json`, `proof-manifest.json`, `proof-manifest-verification.json`, signed `receipt-chain.json`, and deterministic `receipt-replay.json`.
- `receipt-public-key.pem`: public Ed25519 key for verifying the tracked suite proof receipt-chain signature. The private key is not tracked.
- `live-mock/`: credential-free live-mode proof generated through `live-proof --live-mock`. It exercises the live adapter normalization boundary against the fixture-backed mock Splunk MCP transport and produces a saved-search fail-to-pass proof with `mode: live` and `mutation: false`.
- `mcp-proof/`: credential-free MCP proof. It starts the local SplunkReady stdio MCP server, records the raw JSON-RPC client session, discovers tools/resources/resource templates/prompts, reads a templated Readiness Receipt resource, exposes a dual-server Splunk MCP + SplunkReady MCP client kit, certifies a captured Splunk MCP JSON-RPC transcript through both path-based and inline-content MCP tools, checks hosted-model SAIA access through the MCP server in fixture mode, writes a client walkthrough showing existing Splunk MCP investigation followed by SplunkReady certification, and verifies the nested transcript proof manifests.
- `public-proof-export/`: redacted derivative export generated from a managed workbench run. It includes the public export manifest, summary, audit, receipts, traces, redacted source proof manifest, and manifest verification. It is intentionally not the unredacted source proof.
- `screenshots/`: Playwright screenshots for the packaged workbench fixture run, trace timeline, MCP proof view, verified public proof export UI, hosted public judge-proof view, and interactive hosted certification route. The earlier Vite-backed fixture screenshot is retained as historical evidence but is not the primary refreshed screenshot.
- `claim-ledger.md`: public claim to evidence mapping.
- `evidence-pack-sha256.txt`: SHA-256 hashes for this tracked evidence pack.

## Primary Verification

Run these from the repository root:

```bash
npm run splunkready -- proof-audit --out submission-evidence/suite-proof --require-pass true --json
npm run splunkready -- verify-manifest --out submission-evidence/suite-proof --json
npm run splunkready -- verify-receipt-chain --dir submission-evidence/suite-proof --public-key submission-evidence/receipt-public-key.pem --json
npm run splunkready -- receipt-replay --dir submission-evidence/suite-proof --json
npm run live-mock-proof
npm run splunkready -- verify-manifest --out submission-evidence/mcp-proof/mcp-transcript-certification --json
npm run splunkready -- verify-manifest --out submission-evidence/mcp-proof/mcp-inline-transcript-certification --json
npm run splunkready -- verify-manifest --out submission-evidence/public-proof-export --json
shasum -a 256 -c submission-evidence/evidence-pack-sha256.txt
npm run audit:submission-copy
git diff --check
```

Expected proof status:

- suite status: `PASS`
- suite mode: `fixture`
- mutation: `false`
- mission count: `3`
- domains: `security`, `observability`
- fail-to-pass missions: `3`
- READY-after-patch missions: `3`
- final evidence refs: `15`
- manifest verification: `PASS`
- receipt-chain verification: `PASS`
- receipt-chain signature: `VERIFIED`, `ed25519`
- receipt replay: `PASS`, replayed receipts `6`
- compiler diagnostics: present
- live-mock status: `PASS`
- live-mock mode: `live`
- live-mock mutation: `false`
- live-mock proof loop: `fail-to-pass`
- live-mock derived strategy: `saved-search-with-evidence`
- live-mock before verdict: `NOT READY`
- live-mock after verdict: `READY`
- MCP proof status: `PASS`
- MCP tools: `6`
- MCP resources: `13`
- MCP resource templates: `1`
- MCP prompts: `6`
- dual-server MCP client kit: `splunkready://client-config/splunk-and-splunkready`
- MCP client walkthrough: `PASS`
- MCP client session: `PASS`, `25` request/response pairs
- MCP live-mock session: `PASS`
- MCP template receipt read: `splunkready://receipts/pass`
- MCP inline transcript certification: `PASS`
- MCP hosted-model access: `PASS`, permission `OK`, mutation `false`
- certified Splunk MCP tools: `splunk_get_knowledge_objects`, `splunk_run_saved_search`
- public judge proof status: `PASS`
- public judge proof mutation: `false`
- public judge proof LLM authority: `deterministic-rule-engine`

## Redaction Boundary

The `public-proof-export/` bundle is a sanitized derivative generated from managed workbench run `run-2026-06-05T19-00-20-455Z-b5613154`, with export run `run-2026-06-05T19-01-15-496Z-3a4d3125`.

Its manifest reports `redactionStatus: REDACTED` and aggregate hash `00a41db000a4bb2ad7d470edcf5aaa724b3ab3ecd31626f7cf7696d1ccf358e9`.

## Screenshot Notes

Included refreshed screenshots were captured with Playwright before tracking:

- `screenshots/workbench-packaged-fixture.png`: packaged `npm run workbench` fixture run, `job-1 / succeeded`, `READY / 100/100`.
- `screenshots/workbench-trace-timeline.png`: Trace view showing ordered before/after rows for the fixture run.
- `screenshots/workbench-mcp-proof.png`: MCP view showing `mcp-proof-summary.json` loaded through the packaged workbench, including Splunk MCP boundary tools, the dual-server client config resource, resources/prompts, raw MCP client-session evidence, deterministic authority, and `Mutation no`.
- `screenshots/public-proof-export-proof-browser.png`: Runs view showing the redacted public proof export panel and manifest verification `PASS`.
- `screenshots/public-judge-proof-proof-browser.png`: Hosted GitHub Pages proof browser view for the credential-free judge proof bundle, showing `PASS`, `Mutation no`, and advisory-only LLM evidence with deterministic rule-engine authority.
- `screenshots/interactive-demo.png`: Hosted-style public demo route opened at `?demo=interactive`, then certified the bundled security trace in-browser and rendered `PASS`, `READY`, score `100`, `receipt-interactive-001`, a receipt hash, evidence refs, and `Mutation false`.
