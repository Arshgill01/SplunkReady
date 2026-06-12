# Devpost Submission Draft

## Project Name

SplunkReady

[![npm version](https://badge.fury.io/js/splunkready.svg)](https://www.npmjs.com/package/splunkready)

## Tagline

Certify AI agents before they touch production Splunk.

## Submission Track

Platform & Developer Experience

Security is the flagship use case. Splunk MCP and hosted-model integrations support the platform story, but the submission copy should not claim multiple mutually exclusive prize targets.

## Elevator Pitch

Splunk is making operational data agent-ready. SplunkReady makes agents Splunk-ready.

SplunkReady is a Splunk-native certification workbench for teams shipping AI agents that can call Splunk. The Agent Readiness Compiler compiles a fixture or live Splunk environment into a deployment-specific contract, records agent behavior as a tool trace, grades that trace with deterministic rules, and emits a Readiness Receipt before the agent is allowed near production.

## What It Does

SplunkReady answers one operational question: is this agent ready for this Splunk deployment?

The workbench can run a reproducible fixture certification, inspect proof runs, verify manifests, export redacted public proof bundles, and accept externally captured traces or MCP transcripts. The primary artifact is the Readiness Receipt: contract version, mission suite, trace provenance, deterministic violations, score, verdict, evidence refs, and policy patch summary.

The tracked evidence pack is in `submission-evidence/`:

- `real-splunk-proof-audit/` is the strict 9-check audit of the real Splunk
  Enterprise 10.4.0 stress replay. Fresh disposable container, operator-scoped
  setup, security stressors, deployment-derived readiness, deterministic
  fail-to-pass receipts (`NOT READY 60` -> `READY 100`), live evidence refs,
  MCP bridge session, official Splunk MCP boundary language, and
  advisory-only LLM behavior. This is the recommended first-read for
  Platform & Developer Experience.
- `suite-proof/` proves three credential-free missions across security and observability.
- `public-proof-export/` shows the redacted derivative export boundary.
- `splunk-app-package/` contains an inspectable, credential-free Splunk app package shell for the public artifact workbench.
- `screenshots/` shows the packaged workbench, Vite-backed workbench, and public proof export UI.
- `claim-ledger.md` maps public claims to concrete evidence paths and verification commands.

## Flagship Demo

The demo uses security investigation readiness. A naive Splunk-facing agent investigates possible lateral movement, searches too broadly, uses the wrong field, ignores validated saved-search provenance, and gives an unsupported answer. SplunkReady catches the unsafe trace with deterministic rule IDs, exports a reviewable policy patch, reruns the mission, and produces a READY receipt with evidence refs.

The local fixture path requires no live Splunk credentials. The currently
published clean-folder judge command is:

```bash
npx -y splunkready@0.1.9 judge-proof --out ./judge-proof --json
```

That clean-folder command is smoke-tested from a temp folder, returns `PASS`,
records `mutation: false`, and writes the judge proof bundle without requiring a
repository clone. The public-package currentness audit also verifies the
published MCP tool surface, credential-free `live-proof --live-mock`, and signed
policy-registry commands. The tracked currentness audit in
`submission-evidence/public-package-currentness/` records that npm latest is
`0.1.7` and the smoke probes pass, while current source has later package-input
commits that need the next npm release before the package is source-current.

The current source also has a no-Node standalone release path. Move 170 builds a
Node SEA executable for the current runner, bundles `fixtures/` and `policies/`
into the archive, extracts that archive into a clean temp folder, and smokes
`splunkready judge-proof --out ./judge-proof --json`. The tracked evidence at
`submission-evidence/standalone-release/standalone-release-current-os.json`
reports current target `macos-arm64`, smoke `PASS`, 67 generated artifacts, and
`mutation: false`. The workflow-dispatch evidence at
`submission-evidence/standalone-release/standalone-release-matrix.json` proves
Linux, macOS, and Windows runners each built, smoked, and uploaded standalone
artifacts. The public `v0.1.7` GitHub Release now publishes the Linux, macOS,
and Windows standalone archives, SHA-256 checksum files, and per-platform
manifests at
https://github.com/Arshgill01/SplunkReady/releases/tag/v0.1.7. The tracked
release evidence is
`submission-evidence/standalone-release/standalone-release-github-release.json`.
The macOS arm64 archive was also downloaded from that public release URL,
checksum-verified with its published `.sha256` file, extracted into a clean temp
folder, and run as `./splunkready judge-proof --out ./judge-proof --json`
without Node, npm, `npx`, a repo checkout, Splunk credentials, or live
mutation.
The tracked public-download smoke at
`submission-evidence/standalone-release/standalone-release-public-download-smoke.json`
reports `PASS`, 67 generated artifacts, and `mutation: false`.
The repository also ships `setup-splunkready`, a GitHub Action subpath for
non-Node CI jobs. The `v0.1.7` tag downloads the public standalone release asset from `v0.1.7`, verifies the SHA-256 checksum, adds the binary to
`PATH`, and lets the next step run
`splunkready judge-proof --out "$RUNNER_TEMP/splunkready-proof" --json`
without `actions/setup-node` or `npm ci`. The tracked evidence is
`submission-evidence/setup-splunkready-action/setup-splunkready-action.json`.

The credential-free hosted workbench is available at:

```text
https://arshgill01.github.io/SplunkReady/?artifacts=artifacts%2Fmcp-proof#mcp-proof
```

The hosted judge-proof receipt view is available at:

```text
https://arshgill01.github.io/SplunkReady/?artifacts=artifacts%2Fjudge-proof#proof-browser
```

For the full local workbench from a clone:

```bash
npm install
npm run workbench
```

The command builds the runtime and UI, starts one localhost-only workbench origin, and prints the local URL, artifact root, fixture capability, live capability, and SAIA status.

The repository also ships a credential-free live readiness PR gate. The workflow
uses the mock Splunk MCP live adapter path, produces a NOT READY -> READY
Readiness Receipt sequence, uploads the PR-gate artifacts, and posts a stable
SplunkReady comment when pull-request permissions allow it. The tracked sample
is in `submission-evidence/ci-pr-gate/`.

The MCP proof also includes a client-neutral dual-server recorder artifact at
`submission-evidence/mcp-proof/dual-server-session.jsonl`. It preserves
`serverId` for the existing Splunk MCP investigation frames and the SplunkReady
certification frames, redacts endpoint/token/local-path material, then certifies
the recorder transcript with strict import and zero skipped records. In
`--live-mock` mode that artifact is produced by the `mcp-recorder` pass-through
gateway against mock Splunk MCP plus SplunkReady MCP, not by a closed desktop
client recording.

For MCP-specific judging, the compact artifact is
`submission-evidence/mcp-proof/mcp-category-scorecard.json`. It is now loaded
by the hosted default MCP route and required by the public-demo export audit.
The scorecard frames Splunk MCP as the investigation/data plane and SplunkReady
as the deterministic readiness gate around captured Splunk MCP behavior. Current
evidence reports `PASS`, score `100`, `VERIFIED_STRONG`, 15 Zed external-client
frames, zero warnings, zero failures, deterministic authority, and
`mutation: false`, while still preserving the live hosted-model entitlement
boundary instead of overclaiming it.

The same MCP proof records an AppInspect MCP composition artifact at
`submission-evidence/mcp-proof/appinspect-mcp-composition.json`. It invokes
`uvx splunk-appinspect[mcp] mcp-server`, calls `inspect_app` against the tracked
`.spl` package, and keeps AppInspect as advisory static validation only.
SplunkReady remains the deterministic receipt authority. Current evidence
reports validation `SUCCESS` with 0 package failures, 0 errors, and 1 warning;
it does not claim Splunkbase approval.

The tracked Splunk app package evidence is
`submission-evidence/splunk-app-package/SplunkReady-0.1.7.spl`. It embeds the
public artifact workbench as static Splunk app content, defines an optional
operator-owned `splunkready_receipts` KV Store collection plus
`splunkready_receipts_lookup`, ships `splunkready_overview.xml` for bundled
evidence and operator-populated receipt rows, and intentionally avoids
credentials, Python handlers, scripted inputs, and default-path Splunk write
operations. The tracked operator-approved live install proof at
`submission-evidence/splunk-app-install/splunk-app-install-proof.json` verifies
the installed app metadata, launcher view, overview view, nav, KV Store
collection, and lookup while redacting endpoint, username, password, and token
values. `submission-evidence/splunk-receipt-store/splunk-receipt-store-proof.json`
then uses an explicit operator-approved write to populate six public-safe
receipt summary rows and verify readback through `splunkready_receipts_lookup`.
It does not upload raw traces, raw Splunk events, endpoints, usernames,
passwords, or tokens. This is not a Splunkbase approval claim.
`submission-evidence/splunk-app-web-proof/splunk-app-web-proof.json` adds a
real Splunk Web browser-render proof: Playwright logs into the operator-owned
server, verifies the installed SplunkReady launcher, opens the static receipt
route
`/en-US/static/app/SplunkReady/splunkready/index.html?artifacts=artifacts%2Fpublic-proof-export#receipt`,
checks the overview dashboard panels, and saves
`submission-evidence/screenshots/splunk-app-web-proof.png` without storing
endpoint, username, secret, or cookie values.
`submission-evidence/splunkbase-readiness/splunkbase-readiness.json` is the
current Splunkbase readiness checklist: it ties the package, AppInspect
precertification, live install proof, receipt-store proof, official Splunk
submission references, exact packaged listing assets (`appIcon.png` 36x36,
`appIcon_2x.png` 72x72, `screenshot.png` 623x350), and remaining
publisher-account/listing blockers into one artifact. The package is not claimed as publicly listed on Splunkbase until the external Splunkbase review has actually completed.
The operator-ready listing dossier is tracked at
`submission-evidence/splunkbase-readiness/splunkbase-listing-dossier.json` and
`docs/splunkbase-listing-dossier.md`; it gives the publisher portal copy,
release notes, support-contact blocker, package checksum, and no-badge
guardrails without claiming Splunkbase approval.

For a strict CLI evidence gate:

```bash
npm run splunkready -- proof-audit --out submission-evidence/suite-proof --require-pass true --json
npm run splunkready -- verify-manifest --out submission-evidence/suite-proof --json
```

## Judging Criteria

### Technical Implementation

SplunkReady has a real TypeScript implementation, schema-validated artifacts, a deterministic grader, a local HTTP workbench, fixture/live adapter parity, external trace intake, MCP transcript certification, proof audits, and proof manifests. The broad repository gate is:

```bash
npm run check
```

The Move 21 evidence pack verifies in place from tracked files.

### Use Of Splunk

Splunk concepts are first-class in the contract and grader: indexes, sourcetypes, saved searches, knowledge objects, canonical fields, app context, evidence requirements, and query budgets. Live mode uses the Splunk MCP adapter boundary when operator-owned env vars are configured, while fixture mode keeps the demo reproducible for judges.

SplunkReady does not mutate Splunk. It exports policy guidance for operator review.

### Originality

This is not a chatbot, SOC copilot, telemetry dashboard, detection-health dashboard, or generic eval harness. It is a pre-production certification harness: a deployment-specific receipt proving whether an agent can safely use Splunk here.

### Practical Value

Teams adopting Splunk-connected agents need a gate between "the model can call a tool" and "the model is safe for this deployment." SplunkReady turns that gate into a reviewable receipt, a manifest-verifiable proof bundle, and a local workbench that developers and operators can inspect together.

## Splunk MCP Integration

The Splunk MCP interface is the certification boundary for live mode. Fixture and live paths converge after the adapter, so the same compiler, mission runner, trace recorder, grader, policy patch, and receipt logic run regardless of whether the source is a local fixture or a live MCP endpoint.

SplunkReady's MCP value is not that it replaces Splunk MCP. It uses Splunk MCP as the source of real agent/tool behavior, then exposes a local certification MCP server so other MCP clients can discover posture resources, reuse certification prompts, request deterministic Readiness Receipts for captured traces and transcripts, and call `splunkready_review_mcp_composition` to score the two-server Splunk MCP plus SplunkReady MCP workflow.

The judge-visible MCP scorecard makes that boundary explicit: existing Splunk
MCP tools perform discovery and saved-search execution, while SplunkReady grades
the captured transcript, preserves evidence refs, and emits the receipt. The
category claim is composition and certification, not replacement of Splunk MCP
or hidden mutation of Splunk.

Live mode is optional and disabled by default. The tracked evidence pack does not include raw live artifacts or credentials. Live claims should be treated as conditional unless the operator generates and sanitizes a separate live evidence export.

## Hosted-Model Integration

SplunkReady supports hosted-model style assistance through `saia_generate_spl`, `saia_explain_spl`, `saia_optimize_spl`, and `saia_ask_splunk_question` when those tools are available. The assistance is advisory: it can generate candidate SPL, explain unsafe SPL, suggest a corrected query shape, and answer Splunk/SPL guidance questions, but deterministic rules remain the pass/fail authority.

The tracked evidence pack does not claim live hosted-model entitlement. The workbench reports SAIA status at startup, and hosted-model diagnostic workflows can prove availability when operator credentials permit it.

## What It Is Not

- Not a Splunk chatbot.
- Not a SOC copilot.
- Not MCP telemetry.
- Not a detection-health dashboard.
- Not a generic eval harness.
- Not an LLM judging another LLM.

## Built With

- TypeScript
- Zod
- Vitest
- Vite
- Published npm CLI: `npm install -g splunkready` or `npx -y splunkready@0.1.9 judge-proof`
- Splunk MCP adapter boundary
- Deterministic trace grader rules
- Local workbench API and UI
- Readiness Receipt, proof audit, and proof manifest artifacts

## Evidence Links

- Evidence pack: `submission-evidence/README.md`
- Claim ledger: `submission-evidence/claim-ledger.md`
- Hosted MCP proof: `https://arshgill01.github.io/SplunkReady/?artifacts=artifacts%2Fmcp-proof#mcp-proof`
- Hosted judge proof: `https://arshgill01.github.io/SplunkReady/?artifacts=artifacts%2Fjudge-proof#proof-browser`
- Architecture diagram: `architecture_diagram.md`
- Dev verification: `npm run check`
