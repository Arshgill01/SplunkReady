# SplunkReady Submission Evidence

Regenerated for Move 78 on 2026-06-06 and extended with Move 80/82/92 MCP workbench and client-walkthrough evidence, Move 100 published-package evidence, Move 103 public judge-proof evidence, Move 109 raw MCP client-session evidence, Move 111 MCP resource-template evidence, Move 112 inline MCP transcript certification evidence, Move 113 hosted-model MCP access evidence, Move 147 live-mock MCP evidence, Move 148 signed receipt-chain plus deterministic replay evidence, Move 150 signed policy-registry evidence, Move 157 Splunk app package evidence, Move 158 PR-gate evidence, Move 159 MCP composition-recorder evidence, Move 163 MCP recorder-gateway evidence, Move 164 AppInspect MCP composition evidence, Move 165 live Splunk app install evidence, Move 166 operator receipt-store evidence, and Move 167 Splunkbase readiness evidence.

This directory is the judge-facing evidence pack. It is tracked in git so it can be inspected from a clean clone without access to ignored local `artifacts/`, `.splunkready*` env files, live credentials, or private deployment details.

## Contents

- `suite-proof/`: credential-free multi-mission fixture proof. It includes the full proof bundle, compiler diagnostics, strict `proof-audit.json`, `proof-manifest.json`, `proof-manifest-verification.json`, signed `receipt-chain.json`, and deterministic `receipt-replay.json`.
- `receipt-public-key.pem`: public Ed25519 key for verifying the tracked suite proof receipt-chain signature. The private key is not tracked.
- `live-mock/`: credential-free live-mode proof generated through `live-proof --live-mock`. It exercises the live adapter normalization boundary against the fixture-backed mock Splunk MCP transport and produces a saved-search fail-to-pass proof with `mode: live` and `mutation: false`.
- `ci-pr-gate/`: credential-free live readiness PR-gate sample. It contains the same live-mock proof shape plus `pr-comment.md` and `ci-pr-gate.json`, the deterministic artifacts used by `.github/workflows/live-certification-gate.yml`.
- `mcp-proof/`: credential-free MCP proof. It starts the local SplunkReady stdio MCP server, records the raw JSON-RPC client session, discovers tools/resources/resource templates/prompts, reads a templated Readiness Receipt resource, exposes a dual-server Splunk MCP + SplunkReady MCP client kit, certifies a captured Splunk MCP JSON-RPC transcript through both path-based and inline-content MCP tools, checks hosted-model SAIA access through the MCP server in fixture mode, writes a client walkthrough showing existing Splunk MCP investigation followed by SplunkReady certification, runs the MCP recorder gateway against mock Splunk MCP plus SplunkReady MCP, writes a redacted dual-server recorder session with preserved server IDs, records an advisory Splunk AppInspect MCP composition proof for the current `.spl` package, and verifies the nested transcript proof manifests.
- `policy-registry/`: signed default, SOC2, and PCI DSS policy bundles. Each installed policy includes `policy.json` and an Ed25519-backed `policy-manifest.json` with `deterministicAuthority: true` and `mutation: false`.
- `splunk-app-package/`: credential-free `.spl` package proof that embeds the public artifact workbench in a static Splunk app shell. It includes the package archive and manifest with hash, file list, official packaging references, `mutation: false`, `noCredentialFiles: true`, `noPythonHandlers: true`, and `noScriptedInputs: true`.
- `splunk-app-install/`: redacted operator-approved proof that the `.spl` package was installed/upgraded and probed on the local operator-owned Splunk server.
- `splunk-receipt-store/`: redacted operator-approved proof that six public-safe signed receipt summaries were written into the installed Splunk app KV Store and read back through `splunkready_receipts_lookup`.
- `splunkbase-readiness/`: AppInspect precertification output plus a Splunkbase/Splunk Cloud readiness checklist. It records 0 AppInspect errors, 0 failures, the expected KV Store warning, live install proof, receipt-store proof, and the remaining external blockers. It is not a public Splunkbase listing claim.
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
npm run pr-gate:sample
npm run splunkready -- verify-manifest --out submission-evidence/mcp-proof/mcp-transcript-certification --json
npm run splunkready -- verify-manifest --out submission-evidence/mcp-proof/mcp-inline-transcript-certification --json
npm run splunkready -- policy-publish --policy policies/soc2-readiness.policy.json --json
npm run splunkready -- evaluate --out artifacts/policy-eval --policy pci-dss-readiness --json
npm run splunk-app:package
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
- PR gate status: `PASS`
- PR gate mutation: `false`
- PR gate proof loop: `fail-to-pass`
- PR gate comment marker: `splunkready-live-readiness-pr-gate`
- MCP proof status: `PASS`
- MCP tools: `6`
- MCP resources: `13`
- MCP resource templates: `1`
- MCP prompts: `6`
- dual-server MCP client kit: `splunkready://client-config/splunk-and-splunkready`
- MCP client walkthrough: `PASS`
- MCP client session: `PASS`, `25` request/response pairs
- MCP composition recorder: `PASS`, `9` pass-through gateway frames, servers `splunk`, `splunkready`
- MCP composition recorder redaction: `PASS`
- MCP composition recorder certification: `PASS`, strict import skipped records `0`
- AppInspect MCP composition: `PASS`, server `AppInspect MCP Server 2.14.7`, tool `inspect_app`, validation `SUCCESS`, failures `0`, errors `0`, warnings `5`
- MCP live-mock session: `PASS`
- MCP template receipt read: `splunkready://receipts/pass`
- MCP inline transcript certification: `PASS`
- MCP hosted-model access: `PASS`, permission `OK`, mutation `false`
- certified Splunk MCP tools: `splunk_get_knowledge_objects`, `splunk_run_saved_search`
- public judge proof status: `PASS`
- public judge proof mutation: `false`
- public judge proof LLM authority: `deterministic-rule-engine`
- signed policy registry: default, SOC2, and PCI DSS policy manifests present
- policy registry signatures: `ed25519`, `SIGNED`
- policy evaluation receipt identity: `pci-dss-readiness`
- Splunk app package status: `PASS`
- Splunk app package mutation: `false`
- Splunk app package overview view: `SplunkReady/default/data/ui/views/splunkready_overview.xml`
- Splunk app package receipt collection: `splunkready_receipts`
- Splunk app package receipt lookup: `splunkready_receipts_lookup`
- Splunk app package credential files: none
- Splunk app package Python handlers: none
- Splunk app package scripted inputs: none
- Operator live Splunk app install proof: `PASS`
- Operator live Splunk app install mutation class: `operator-approved-app-install`
- Operator live Splunk app install probes: app metadata, launcher view, overview view, nav, receipt collection, receipt lookup
- Operator live Splunk app install redaction: no endpoint, username, password, or token values written
- Splunkbase readiness status: `ACTION_REQUIRED`
- Splunkbase readiness AppInspect result: 0 errors, 0 failures, 1 expected KV Store warning
- Splunkbase readiness local evidence: package, live install, and receipt-store checks pass
- Splunkbase listing claim: not made until external Splunkbase review is complete

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
