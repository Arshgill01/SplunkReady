# SplunkReady

[![npm version](https://badge.fury.io/js/splunkready.svg)](https://www.npmjs.com/package/splunkready)

Certify AI agents before they touch production Splunk.

SplunkReady is a Splunk-native certification harness and local workbench for teams shipping agents that can call Splunk. It does not answer alerts for the operator. It proves whether a specific agent can safely operate against a specific Splunk deployment.

## One-Sentence Pitch

Splunk is making operational data agent-ready. SplunkReady makes agents Splunk-ready.

## What It Does

The Agent Readiness Compiler compiles a fixture or live Splunk environment into an agent contract and readiness profile, runs realistic missions or accepts captured agent traces, grades the resulting tool trace with deterministic rules, and produces a Readiness Receipt.

The flagship demo story is security investigation readiness: the bundled specimen confidently clears possible lateral movement after using `index=*`, a stale field, and no saved search provenance. SplunkReady catches the unsafe trace, exports a reviewable policy patch, reruns the same mission, and shows a bounded pass with evidence. The default specimen is deterministic for local reproducibility; set `SPLUNKREADY_LLM_ENABLED=true` to run the Gemini-backed specimen instead.

The tracked evidence pack is in [submission-evidence/](submission-evidence/README.md). It includes a self-verifiable three-mission fixture proof, a redacted public proof export, a credential-free Splunk app package proof, manually inspected workbench screenshots, and a claim ledger that maps public claims to evidence paths.

## Judge-Runnable Fixture Demo

Fixture mode is the default path. It requires no Splunk credentials and does not call a live Splunk deployment.

Prerequisite: Node.js 22 or newer. If you use `nvm`, run `nvm use 22` from the repo root.

For the fastest local proof, run:

```bash
npm install
npm run judge-proof
```

The currently published no-clone judge path is:

```bash
npx -y splunkready@0.1.5 judge-proof --out ./judge-proof --json
```

The repo-linked GitHub Packages mirror is `@arshgill01/splunkready@0.1.7`;
that registry path requires GitHub package authentication, so the npmjs command
above remains the unauthenticated judge path.

That command is smoke-tested from a clean temp folder and must return `PASS`
with `mutation: false`. The public package currentness audit also proves the
published MCP tool surface, credential-free `live-proof --live-mock`, and signed
policy-registry flow before the package is called current.

### Standalone Release Artifact

Move 170 adds a no-Node release artifact path for GitHub Releases. On the
current macOS arm64 runner, the standalone archive is built with Node SEA,
includes the executable plus bundled `fixtures/` and `policies/`, then is
extracted into a clean temp folder and smoked with:

```bash
splunkready judge-proof --out ./judge-proof --json
```

The tracked current-OS evidence is
`submission-evidence/standalone-release/standalone-release-current-os.json`.
It reports `status: "PASS"`, target `macos-arm64`, smoke `PASS`, stdout command
`judge-proof`, 67 generated artifacts, and `mutation: false`. The release
workflow dispatch evidence at
`submission-evidence/standalone-release/standalone-release-matrix.json` shows
Linux, macOS, and Windows runners each built, smoked, and uploaded standalone
artifacts. The public `v0.1.7` GitHub Release publishes those standalone
archives, SHA-256 checksum files, and per-platform manifests at
https://github.com/Arshgill01/SplunkReady/releases/tag/v0.1.7; tracked evidence
is in
`submission-evidence/standalone-release/standalone-release-github-release.json`.
The macOS arm64 archive was also downloaded back from that public URL,
checksum-verified, extracted in a clean temp folder, and run with:

```bash
curl -fsSLO https://github.com/Arshgill01/SplunkReady/releases/download/v0.1.7/splunkready-macos-arm64.tar.gz
curl -fsSLO https://github.com/Arshgill01/SplunkReady/releases/download/v0.1.7/splunkready-macos-arm64.tar.gz.sha256
shasum -a 256 -c splunkready-macos-arm64.tar.gz.sha256
tar -xzf splunkready-macos-arm64.tar.gz
./splunkready judge-proof --out ./judge-proof --json
```

That public-download smoke is tracked at
`submission-evidence/standalone-release/standalone-release-public-download-smoke.json`
and reports `PASS`, 67 generated artifacts, and `mutation: false` without
Node, npm, `npx`, a repo checkout, Splunk credentials, or live mutation.

CI users who do not want a Node setup step can install the standalone binary
through the repository sub-action:

```yaml
- uses: Arshgill01/SplunkReady/setup-splunkready@v0.1.7
  with:
    version: v0.1.7

- run: splunkready judge-proof --out "$RUNNER_TEMP/splunkready-proof" --json
```

The setup action downloads the public release archive for the runner, verifies
the SHA-256 checksum, and adds the binary directory to `PATH`. The tracked
evidence at
`submission-evidence/setup-splunkready-action/setup-splunkready-action.json`
records the supported release targets, checksum boundary, no-Node/no-npm
consumer job, and credential-free mutation boundary. The `v0.1.7` tag includes
`setup-splunkready/action.yml`; older tag `v0.1.6` does not.

`npm run judge-proof` builds the TypeScript runtime and writes a credential-free proof bundle to `artifacts/judge-proof`. The bundle runs the multi-mission fixture fail -> patch -> rerun -> pass suite, writes `compiler-diagnostics.json` / `.md` showing deterministic rule activation and resolution from readiness profiles and receipts, audits the suite, verifies its manifest, runs the firewall pre-execution proof, verifies that manifest, and writes a strict `certification-index.json` plus `ui-artifacts.json` for the workbench artifact selector. It does not call live Splunk and does not mutate Splunk.

### Credential-Free Mock Splunk MCP

The mock Splunk MCP server exercises the same read-only live adapter boundary
without operator-owned Splunk credentials:

```bash
npm run build
node dist/src/cli.js mock-splunk-mcp --mock-state ok
```

Use `--mock-state degraded` to add advisory hosted-model warnings, or
`--mock-state route-not-found` to simulate SAIA route failures while keeping
Splunk search tools available. Docker packaging is available for local CI
smokes:

```bash
docker build -f Dockerfile.mock-splunk-mcp -t splunkready/mock-splunk-mcp:local .
docker compose -f docker-compose.mock.yml config
```

The mock path is fixture-backed live-mode evidence. It is not a claim that a
real Splunk deployment was contacted.

The pull-request gate uses the same credential-free live-mock path and renders a
review comment from real receipt artifacts:

```bash
npm run pr-gate:sample
```

The sample evidence is tracked under `submission-evidence/ci-pr-gate/`. On pull
requests, `.github/workflows/live-certification-gate.yml` runs the proof,
renders `pr-comment.md`, uploads the artifact bundle, and updates one
SplunkReady bot comment when GitHub permissions allow it.

The MCP proof can also capture a mock Splunk MCP session alongside the
SplunkReady MCP certification loop:

```bash
npm run mcp-proof
```

The lower-level recorder gateway can also be run directly as a stdio MCP server:

```bash
npm run splunkready -- mcp-recorder --server splunk=mock-splunk-mcp --server splunkready=mcp --out artifacts/mcp-recorder
```

The judge bundle also records `llmActivation` and `llmEvidence` in
`judge-proof-summary.json`. With no LLM environment enabled, that evidence stays
`NOT_REQUESTED` so the command remains credential-free and makes no model calls.
When `SPLUNKREADY_LLM_ENABLED=true` is set, the same `judge-proof` command
includes the Gemini-produced fixture trace in the judge-facing bundle while
keeping deterministic grading authoritative. The convenience script below sets
the same path up for judging sessions:

```bash
export SPLUNKREADY_LLM_ENABLED=true
export GEMINI_API_KEY="..."
export GEMINI_MODEL="gemini-3.1-flash-lite"
npm run judge-proof:llm
```

That opt-in path writes `artifacts/judge-proof/llm-proof/llm-proof-summary.json`
and records `llmEvidence.status: "PASS"` when the model-produced before/after
trace moves from `NOT READY` to `READY` under deterministic rules.

For local package-style use after a clone, build once and link the checked-out
package:

```bash
npm run build
npm link
splunkready judge-proof --out artifacts/judge-proof --json
```

The `splunkready` bin resolves the bundled default fixture, mission, and suite
paths even when it is run from outside the repository root. The package is also
published on npm, so developers can install it globally when they want a local
`splunkready` command:

```bash
npm install -g splunkready
splunkready judge-proof --out ./judge-proof --json
```

The canonical gate still runs a package readiness audit with
`npm pack --dry-run`. To re-check current publication state and registry/auth
readiness for the next version, run:

```bash
npm run audit:npm-release-preflight
npm run audit:public-package-currentness -- --out submission-evidence/public-package-currentness
```

That preflight checks package metadata, dry-run pack contents, npm registry
state, and local npm authentication. It prints `PUBLISHED` for the current
released version, `READY` for a bumped unpublished version, and `BLOCKED` when
the package is otherwise ready but the machine is not logged in to npm. The
currentness audit checks the public registry, runs the latest published
`judge-proof` from a clean temp folder, and verifies whether the published
package can initialize the SplunkReady MCP stdio server.

To prove a real model-produced fixture trace while keeping deterministic
grading authoritative, export a Gemini key and run:

```bash
export GEMINI_API_KEY="..."
export GEMINI_MODEL="gemini-3.1-flash-lite"
npm run llm-proof
```

`npm run llm-proof` builds the runtime, forces the Gemini-backed specimen for
the proof run, generates a failing pre-policy trace and a passing policy-guided
rerun trace, then writes `artifacts/llm-proof/llm-proof-summary.json`. The
summary records `llmRole: "trace-producer"` and
`passFailAuthority: "deterministic-rule-engine"` so the AI story is visible
without turning the model into the judge. Use `npm run judge-proof:llm` when the
LLM proof should be attached to the main judge proof bundle.

To prove the local MCP certification server path, run:

```bash
npm run mcp-proof
```

`npm run mcp-proof` starts the built SplunkReady stdio MCP server, negotiates
`initialize`, lists non-destructive certification tools, resources, and prompts,
discovers a templated Readiness Receipt resource, reads the certification
posture resource and MCP-client configuration, reads external-client templates
for Claude Desktop, Cursor, Antigravity, and Zed at
`splunkready://client-config/claude-desktop`,
`splunkready://client-config/cursor`,
`splunkready://client-config/antigravity`, and
`splunkready://client-config/zed`, fetches reusable transcript and Splunk MCP
certification-loop prompts, reads
`splunkready://workflows/hosted-model-diagnostic`, fetches
`splunkready_hosted_model_diagnostic`, then certifies the checked-in passing
MCP JSON-RPC transcript through
`splunkready_certify_mcp_transcript` and also proves the direct-content MCP
tool `splunkready_certify_mcp_transcript_content`. It also calls
`splunkready_check_hosted_model_access` so the MCP proof includes SAIA
hosted-model generate/explain/optimize/ask access as fixture-mode advisory
evidence, then calls `splunkready_review_mcp_composition` to deterministically
score the two-server Splunk MCP plus SplunkReady MCP composition. If a redacted
operator-owned live hosted-model diagnostic artifact is
present, the proof also records `operatorLiveHostedModelStatus` so public MCP
evidence distinguishes fixture PASS from the current live SAIA blocker class
without copying endpoints or tokens. It writes
`artifacts/mcp-proof/mcp-proof-summary.json` / `.md` plus the generated
Readiness Receipt artifacts. The summary includes a `splunkMcpBoundary` block
that names the certified `splunk_*` tools, records saved-search execution,
preserves evidence refs, points at the generated receipt, and states that
deterministic rules remained authoritative. It also includes a
`compositionRecorder` block that writes a redacted dual-server MCP session to
`dual-server-session.jsonl`, preserves `serverId` for the existing Splunk MCP
and SplunkReady MCP sides, and, when `--live-mock` is used, captures a real
pass-through recorder-gateway session against the mock Splunk MCP server plus
the SplunkReady MCP server. It certifies that recorder transcript through the
same deterministic transcript importer with zero skipped records. It also includes an
`appInspectComposition` block when `--live-mock` is used for AppInspect MCP composition. That block starts the Splunk AppInspect MCP server through `uvx splunk-appinspect[mcp] mcp-server`,
calls `inspect_app` against the tracked `.spl` package, and records AppInspect
as advisory static validation while SplunkReady remains the deterministic
Readiness Receipt authority. Current evidence reports AppInspect validation
`SUCCESS` with 0 package failures, 0 errors, and 1 warning; it is not claimed
as Splunkbase approval.
It also includes an
`agentDrivenWorkflow` block showing the intended loop: an MCP client
investigates with Splunk MCP, captures the JSON-RPC transcript, calls
SplunkReady MCP for certification, then explains the Readiness Receipt without
overriding it. This is still fixture-only, credential-free, and non-mutating; it
proves SplunkReady as an MCP certification interface for captured Splunk MCP
behavior, not as a Splunk search copilot.

For external MCP clients, the checked-out source can start the stdio server
with:

```bash
npm run mcp
```

The client-config resources use `npm run mcp` with a `/path/to/SplunkReady`
placeholder for SplunkReady. Antigravity uses
`~/.gemini/antigravity/mcp_config.json` with `mcpServers`; Zed uses
`~/.config/zed/settings.json` with `context_servers`. The existing Splunk MCP
side uses an `npx -y mcp-remote` template with
`${SPLUNKREADY_SPLUNK_MCP_URL}` and `${SPLUNKREADY_SPLUNK_MCP_TOKEN}`
placeholders copied from the Splunk MCP Server app sample client configuration.
The published public npm package supports the no-clone `judge-proof` command,
the `splunkready mcp` entrypoint, credential-free `live-proof --live-mock`,
signed policy-registry commands, and the `mcp-recorder` gateway once the public
package currentness audit reports `CURRENT`.

The release gate also packs the current source into a clean temp project and
requires the installed package to complete both `npx splunkready judge-proof`
and an MCP `initialize` through `npx splunkready mcp`:

```bash
npm run audit:package-installability
```

For the single-mission static replay shell, run:

```bash
npm install
npm run build
tmp=$(mktemp -d /tmp/splunkready-demo-XXXXXX)
npm run splunkready -- demo --out "$tmp"
open "$tmp/splunkready-shell.html#certification-replay"
```

The demo command writes a complete local artifact set into `$tmp`, including:

- `splunkready-shell.html`: static Readiness Receipt UI.
- `demo-rehearsal.json`: measured rehearsal metadata and artifact list.
- `demo-rehearsal.md`: judge-readable demo summary.
- `readiness-profile.json`: deployment-bound rule profile showing which Splunk contract facts activated each readiness rule.
- before and after Readiness Receipts that show fail -> patch -> rerun -> pass.

The primary closeout route is the certification replay:

```text
splunkready-shell.html#certification-replay
```

The same shell also includes `splunkready-shell.html#rerun-receipts` for the before/after receipt comparison.

Expected fixture outcome:

- before receipt: `NOT READY`
- after receipt: `READY`
- visible deterministic rule IDs include `SPL-001`, `SPL-003`, `KO-001`, `EVD-001`, and `ANS-001`

## Local Workbench

For the interactive workbench, run one local command:

```bash
npm run workbench
```

The command builds the TypeScript runtime and Vite UI, starts one localhost-only server, and prints the local URL, artifact root, fixture capability, live capability, and SAIA status. The first screen is the usable certification replay; no live Splunk credentials are required for the fixture path.

For UI development with Vite middleware, use:

```bash
npm run workbench:dev
```

The workbench API and UI are served from the same local origin. Live actions remain disabled unless the live environment variables in the Live Mode section are set in the shell that starts the server.

## Public Demo Export

For a credential-free static demo export:

```bash
npm run public-demo:build
npm run audit:public-demo-export
```

The export writes `artifacts/public-demo` from the built Vite workbench plus tracked submission evidence. The audit checks required proof bundles, the default MCP proof route, the public LLM deliberation artifact route, no secret-named files, no symlinks, and `mutation=false`.

To deploy that export through GitHub Pages, enable Pages for the repository and run the `Public Demo Pages` workflow manually. The workflow builds `artifacts/public-demo`, runs `audit:public-demo-export`, uploads the Pages artifact, and deploys without live Splunk or Gemini secrets. Do not claim a public URL until that workflow has completed and the Pages URL has been opened successfully.

Verified hosted demo:

```text
https://arshgill01.github.io/SplunkReady/?artifacts=artifacts%2Fmcp-proof#mcp-proof
```

Hosted judge-proof receipt view:

```text
https://arshgill01.github.io/SplunkReady/?artifacts=artifacts%2Fjudge-proof#proof-browser
```

Hosted LLM deliberation view:

```text
https://arshgill01.github.io/SplunkReady/?artifacts=artifacts%2Freal-splunk-stress-llm-layer#llm-deliberation
```

The hosted currentness audit records the deployed source commit and asset names
in `submission-evidence/hosted-demo-currentness/hosted-demo-currentness.json`.
The hosted LLM route screenshot is tracked at
`submission-evidence/screenshots/hosted-demo-llm-deliberation.png`.

## Splunk App Package Proof

To build an inspectable Splunk app shell around the public artifact workbench:

```bash
npm run splunk-app:package
```

The command writes `submission-evidence/splunk-app-package/SplunkReady-0.1.7.spl`
and `submission-evidence/splunk-app-package/splunk-app-package-manifest.json`.
The package is static and credential-free: it contains no `local/` directory,
Python REST handlers, scripted inputs, modular inputs, saved searches, tokens,
or default-path Splunk write operations. The tracked operator-approved live
install proof is `submission-evidence/splunk-app-install/splunk-app-install-proof.json`;
it installed/upgraded the same `.spl`, verified app metadata, views, nav,
`splunkready_receipts`, and `splunkready_receipts_lookup`, and redacts endpoint,
username, password, and token values. This is not a Splunkbase approval claim.
The browser-render proof at
`submission-evidence/splunk-app-web-proof/splunk-app-web-proof.json` logs into
operator-owned Splunk Web, verifies the installed launcher route, opens the
static workbench receipt route
`/en-US/static/app/SplunkReady/splunkready/index.html?artifacts=artifacts%2Fpublic-proof-export#receipt`,
detects the overview dashboard panels, and captures
`submission-evidence/screenshots/splunk-app-web-proof.png` without writing
endpoint, username, secret, or cookie values.
The receipt store proof is
`submission-evidence/splunk-receipt-store/splunk-receipt-store-proof.json`; it
uses an explicit `--confirm-write true` operator gate to write six public-safe
receipt summaries into the installed app's KV Store and read them back through
`splunkready_receipts_lookup`. It does not upload raw traces, raw Splunk events,
endpoints, usernames, passwords, or tokens.

The Splunkbase readiness report is
`submission-evidence/splunkbase-readiness/splunkbase-readiness.json`. It records
the current `.spl` package SHA, AppInspect precertification result, live install
proof, receipt-store proof, official Splunk submission references, exact
packaged listing assets (`appIcon.png` 36x36, `appIcon_2x.png` 72x72, and
`screenshot.png` 623x350), and remaining external blockers. Current local
evidence is AppInspect-clean with 0 errors, 0 failures, and one expected KV Store
warning, but SplunkReady does not claim an "Available on Splunkbase" badge until
the package is submitted through a publisher account and publicly listed.
The operator-ready portal copy is tracked in
`submission-evidence/splunkbase-readiness/splunkbase-listing-dossier.json` and
`docs/splunkbase-listing-dossier.md`; it binds the listing text, release notes,
support-contact blocker, package SHA, AppInspect result, and the no-badge
guardrail into a verifier-backed dossier.

## Grade a Captured Agent Trace

The fixture demo is reproducible, but SplunkReady is not limited to its bundled specimen. After compiling the environment contract, pass in a schema-valid trace captured from another Splunk-connected agent:

```bash
npm run build
tmp=$(mktemp -d /tmp/splunkready-trace-XXXXXX)
npm run splunkready -- compile --out "$tmp"
npm run splunkready -- grade-trace \
  --trace path/to/captured-trace.json \
  --out "$tmp" \
  --agent-name "Captured Agent" \
  --agent-version "trace-001"
npm run splunkready -- proof-audit \
  --out "$tmp" \
  --require-pass true \
  --json
npm run splunkready -- verify-manifest \
  --out "$tmp" \
  --json
```

The compile command also writes `readiness-profile.json`, which binds active rule IDs to the compiled Splunk contract. The trace grading command writes `trace-external.json`, deterministic violations, a score, and `receipt-external-001.json` / `.md`. It rejects traces whose `missionId` does not match the selected mission. The trace producer is outside SplunkReady; the deterministic rule engine remains the pass/fail authority.

For external-agent CI, `proof-audit --require-pass true` recognizes `receipt-external-001.json` as an `external-trace` proof and fails the gate unless the deterministic receipt is `READY`. Each audit also writes `proof-manifest.json`, a SHA-256 manifest for the proof bundle files so shared artifacts can be checked without re-running the agent. `verify-manifest` re-hashes the bundle and fails if any audited artifact was changed, removed, or added after the manifest was created.

To add replay lineage over all receipt artifacts in a bundle:

```bash
npm run splunkready -- verify-receipt-chain \
  --dir submission-evidence/suite-proof \
  --json
npm run splunkready -- receipt-replay \
  --dir submission-evidence/suite-proof \
  --json
```

This writes `receipt-chain.json`, a deterministic SHA-256 chain over every
schema-valid `receipt-*.json` artifact in the directory tree. The chain report
records `mutation: false` and keeps deterministic grading as the authority; it
does not make any model or Splunk calls. `receipt-replay` writes
`receipt-replay.json` by re-deriving receipts from the proof bundle's compiled
contract, mission, trace, and violation artifacts, then comparing canonical
receipt hashes.

For a signed local chain, initialize a key pair outside tracked evidence and
sign the bundle:

```bash
tmp=$(mktemp -d /tmp/splunkready-signing-XXXXXX)
npm run splunkready -- keys init --out "$tmp" --json
npm run splunkready -- sign-receipt \
  --dir submission-evidence/suite-proof \
  --private-key "$tmp/receipt-private-key.local.pem" \
  --public-key "$tmp/receipt-public-key.pem" \
  --json
```

The submission evidence commits only
`submission-evidence/receipt-public-key.pem`, never the private key.

### Signed Policy Registry

SplunkReady policies are named, versioned JSON bundles that select existing
deterministic grader rules. They make readiness standards shareable without
turning policy JSON, LLM output, or SAIA output into the pass/fail judge.

Publish a signed policy manifest:

```bash
npm run splunkready -- policy-publish \
  --policy policies/soc2-readiness.policy.json \
  --json
```

Evaluate the default fixture mission against a named policy and record policy
identity in the Readiness Receipt:

```bash
npm run splunkready -- compile --out artifacts/policy-eval --json
npm run splunkready -- evaluate \
  --out artifacts/policy-eval \
  --policy pci-dss-readiness \
  --json
npm run splunkready -- receipt --out artifacts/policy-eval --json
```

The receipt will include `policy.id: "pci-dss-readiness"` plus the policy
version and canonical policy hash. The tracked examples are
`policies/default.policy.json`, `policies/soc2-readiness.policy.json`, and
`policies/pci-dss-readiness.policy.json`; signed installed copies are tracked in
`submission-evidence/policy-registry/`. See
[docs/policy-authoring.md](docs/policy-authoring.md) for the authoring contract.
For a compact smoke path, the important step is
`evaluate --policy pci-dss-readiness` before generating the receipt.

See [examples/README.md](examples/README.md) for runnable external-trace capture scripts and generated sample receipts for both `NOT READY` and `READY / 100` external agent traces.

If an external agent only logs Splunk MCP JSON-RPC calls, certify the transcript directly:

```bash
npm run splunkready -- certify-mcp-transcript \
  --transcript examples/sample-mcp-transcript-pass.jsonl \
  --out artifacts/mcp-transcript \
  --strict-import true \
  --require-pass true \
  --agent-name "External MCP Agent" \
  --agent-version "jsonrpc-transcript-001" \
  --json
```

This single gate writes the full evidence chain: compiled contract, imported canonical trace, deterministic violations, external receipt, proof audit, and `mcp-transcript-certification.json`. `--strict-import true` rejects incomplete JSON-RPC logs; `--require-pass true` blocks CI unless the external MCP agent receives a deterministic `READY` receipt.

To use the same transcript gate as a GitHub Action step:

```yaml
- uses: Arshgill01/SplunkReady@splunkready-build
  id: splunkready
  with:
    mode: mcp-transcript
    transcript: traces/splunk-mcp.jsonl
    out-dir: artifacts/splunkready-mcp-gate
    agent-name: External MCP Agent
    agent-version: pr-${{ github.event.pull_request.number }}
    strict-import: "true"
    require-pass: "true"

- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: splunkready-proof
    path: ${{ steps.splunkready.outputs.out-dir }}

- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: splunkready-diagnostics
    path: ${{ steps.splunkready.outputs.diagnostics-path }}
```

The repository-root `action.yml` is a composite action. It installs and builds
SplunkReady from the action checkout, writes proof artifacts into the caller
workspace, and exposes `out-dir`, `receipt-path`, and `summary-path` outputs.
It also exposes `diagnostics-path`: `compiler-diagnostics.json` for
`judge-proof`, or `readiness-profile.json` for transcript/trace gates. The
action writes a short GitHub job summary with the selected mode, status, proof
directory, receipt path, summary path, and diagnostics path. Pin it to a tag or
commit for production CI.

To exercise the same certification path through the stdio MCP server itself:

```bash
npm run mcp-proof
```

That command writes an MCP proof summary with explicit Splunk MCP boundary
evidence, MCP resource-template discovery, hosted-model diagnostic
resource/prompt discovery, Claude Desktop and Cursor MCP client config
resources, inline transcript certification, deterministic MCP composition
review, a redacted dual-server recorder session at
`dual-server-session.jsonl`, recorder-gateway inline and path certification
receipts when run with `--live-mock`, fixture hosted-model access,
operator-live hosted-model status when a redacted live diagnostic exists, the
uploaded transcript copy, `trace-imported.json`, `trace-external.json`,
`receipt-external-001.json`, `proof-audit.json`, and the transcript
certification summary under `artifacts/mcp-proof/`.

For operator-owned live SAIA checks, `hosted-model-proof` and
`hosted-model-diagnostic` accept `--env-file <path>` so ignored
`.splunkready*` files can supply live variables without printing token values.
If Splunk AI Assistant uses a separate cloud MCP endpoint, set
`SPLUNKREADY_SAIA_ENDPOINT` and `SPLUNKREADY_SAIA_TOKEN`; SplunkReady keeps core
Splunk MCP calls on `SPLUNKREADY_SPLUNK_MCP_URL` and routes only `saia_*`
hosted-model calls to the SAIA target. `SPLUNKREADY_SAIA_MCP_URL` /
`SPLUNKREADY_SAIA_MCP_TOKEN`, `SAIA_MCP_URL` / `SAIA_MCP_TOKEN`, and
`SPLUNK_AI_ASSISTANT_MCP_URL` / `SPLUNK_AI_ASSISTANT_MCP_TOKEN` are accepted
aliases when the values are copied from an MCP client configuration. Dedicated
SAIA/cloud routes can also set `SPLUNKREADY_SAIA_REALM` and
`SPLUNKREADY_SAIA_TENANT` when the remote MCP gateway requires those headers.

To summarize several proof bundles for one environment, generate a certification index:

```bash
npm run splunkready -- certification-index \
  --proof-dirs artifacts/mcp-transcript,artifacts/suite-proof,artifacts/live-security-ui \
  --out artifacts/certification-index \
  --require-pass true \
  --json
```

The command writes `certification-index.json`, a compact ledger of proof directories, audit status, receipt verdicts, scores, evidence counts, mutation posture, proof-manifest hashes, and UI links back to each proof bundle. It also writes `ui-artifacts.json`, which lets the Vite app populate its artifact selector from the generated proof set instead of a hardcoded demo list. Use `--require-pass true` in CI to fail the job if any indexed proof audit is `WARN` or `FAIL`.

## Multi-Mission Fixture Proof

To prove the harness is not a single scripted mission, run the suite proof:

```bash
npm run build
npm run splunkready -- suite-proof --out artifacts/suite-proof --json
npm run splunkready -- suite-proof --out artifacts/suite-proof-ci --require-fail-to-pass true --json
npm run splunkready -- proof-audit --out artifacts/suite-proof-ci --require-pass true --json
npm run splunkready -- suite-proof --suite fixtures/acme-soc-dev/suites/phase-live-readiness-suite.json --out artifacts/suite-proof-custom --require-fail-to-pass true --json
```

`suite-proof` runs the fixture fail -> patch -> rerun -> pass loop across a suite manifest, defaulting to `fixtures/acme-soc-dev/suites/phase-live-readiness-suite.json`: two security missions and one observability mission. It writes each mission's normal artifacts plus `suite-proof-summary.json` / `.md`, with proof-loop classification, domains covered, evidence counts, suite manifest provenance, and `mutation: false`. This path is credential-free and does not call live Splunk. Use `--require-fail-to-pass true` in CI when a READY receipt is not enough and every mission must prove the full certification loop. `proof-audit --require-pass true` also understands suite bundles and checks the suite summary, mutation posture, fail-to-pass count, READY-after-patch count, and evidence refs.

## Runtime Firewall Gate

Use `--firewall` on `evaluate`, `rerun`, `live-proof`, or `live-security-proof` to wrap the Splunk adapter with the compiled policy before the specimen can run SPL:

```bash
npm run splunkready -- compile --out artifacts/firewall-check
npm run splunkready -- evaluate --out artifacts/firewall-check --firewall
```

When the firewall blocks a query, SplunkReady rejects it before Splunk execution, writes `firewall-block-before.json` or `firewall-block-after.json`, and exits nonzero. The block report records the query, deterministic rule IDs, tool name, phase, and `mutation: false`. You can audit that bundle directly:

```bash
npm run splunkready -- proof-audit --out artifacts/firewall-check --require-pass true --json
```

This is a pre-execution safety gate. It does not replace Readiness Receipts; it prevents provably unsafe SPL from reaching Splunk.

## Live Mode

Live mode is optional and disabled by default. Normal fixture tests and the fixture demo do not require live Splunk credentials.

To exercise the live smoke path, set these environment variables locally:

```bash
export SPLUNKREADY_LIVE_ENABLED=true
export SPLUNKREADY_SPLUNK_MCP_URL="https://your-splunk-mcp.example"
export SPLUNKREADY_SPLUNK_MCP_TOKEN="..."
```

Then run:

```bash
npm run build
npm run splunkready -- live-smoke --out artifacts/live-smoke
```

Without live configuration, the live smoke command skips safely. With live configuration, it calls read-only MCP tools only, writes `live-smoke-contract.json` plus `live-smoke-readiness-profile.json`, and does not run searches or mutate Splunk configuration. See [docs/live-adapter.md](docs/live-adapter.md) and [docs/live-setup-checklist.md](docs/live-setup-checklist.md).

To derive and certify a live mission from the target deployment's own saved-search/index inventory:

```bash
export SPLUNKREADY_LIVE_ENABLED=true
export SPLUNKREADY_SPLUNK_MCP_URL="https://your-splunk-mcp.example"
export SPLUNKREADY_SPLUNK_MCP_TOKEN="..."
export SPLUNKREADY_LLM_ENABLED=true
export GEMINI_API_KEY="..."
export GEMINI_MODEL="gemini-3.1-flash-lite"
npm run build
npm run splunkready -- live-proof --out artifacts/live-proof --candidate-limit 12
```

`live-proof` compiles the live contract, scans bounded read-only saved-search candidates, writes `live-derived-mission.json`, then runs evaluate -> receipt -> rerun against that generated mission. It also writes `live-proof-summary.json`, including the explicit `proofLoop` classification (`fail-to-pass`, `ready-without-patch`, or not ready after rerun). If no saved search returns rows but `_internal` is available, it falls back to a bounded `_internal` query mission. It does not create indexes, install apps, write saved searches, or mutate Splunk.

For the flagship security story, `live-security-proof` is stricter: it first requires the lateral-movement saved search and evidence rows discovered by `live-security-check`, then runs the live Gemini specimen through the fail -> patch -> rerun -> pass loop and writes `live-security-proof-summary.json`. The readiness JSON now records `proofMode.fallbackAllowed: false`, setup requirements, and a fallback policy. A fresh Splunk trial without the exact saved search is a clear `BLOCKED` diagnostic, not a hidden `_internal` downgrade.

## LLM Specimen Agent

The normal fixture demo keeps the deterministic specimen as the default. To run
the one-command LLM proof, export a Gemini key:

```bash
export GEMINI_API_KEY="..."
export GEMINI_MODEL="gemini-3.1-flash-lite"
npm run llm-proof
```

To manually step through the same model-driven specimen trace, enable LLM mode:

```bash
export SPLUNKREADY_LLM_ENABLED=true
export GEMINI_API_KEY="..."
export GEMINI_MODEL="gemini-3.1-flash-lite"
npm run build
npm run splunkready -- compile --out artifacts/llm-fixture-proof
npm run splunkready -- evaluate --out artifacts/llm-fixture-proof
npm run splunkready -- receipt --out artifacts/llm-fixture-proof
npm run splunkready -- rerun --out artifacts/llm-fixture-proof
```

In LLM mode, `evaluate` prompts the model without compiled Splunk contract injection. `rerun` injects the compiled policy and contract. SplunkReady still executes tool calls through the adapter and the deterministic grader still decides pass/fail. The current real-Splunk LLM evidence is tracked under `submission-evidence/real-splunk-stress-llm-layer/`, including `llm-deliberation-before.json`, `llm-deliberation-after.json`, `llm-claim-audit-before.json`, `llm-claim-audit-after.json`, and the rendered workbench screenshot `screenshots/workbench-llm-deliberation.png` in the submission evidence pack. See [docs/llm-specimen-agent.md](docs/llm-specimen-agent.md).

## Submission Strategy

SplunkReady targets the Platform & Developer Experience track. The product story is infrastructure for safer Splunk-connected agents, with security as the memorable demo scenario.

## What It Is Not

- Not a Splunk chatbot.
- Not a SOC copilot.
- Not MCP telemetry.
- Not a detection-health dashboard.
- Not a generic eval harness.
- Not an LLM judging another LLM.

## Primary Artifact

The Readiness Receipt is the product artifact. It records the environment contract version, mission suite version, trace evidence, deterministic violations, score, verdict, and policy patch summary. The score is severity-weighted and thresholded by deterministic blockers, not hardcoded to `0` or `100`; the calibration artifact under `submission-evidence/readiness-score-calibration/` shows READY `100`, NEEDS REVIEW `88`, and NOT READY `59` examples from the same scorer. The companion readiness profile records why the rule surface is active for this Splunk deployment.

## Architecture

The Agent Readiness Compiler keeps fixture and live Splunk access behind the same adapter boundary, then compiles a contract, runs missions, grades traces with deterministic rules, and emits a Readiness Receipt.

See [architecture_diagram.md](architecture_diagram.md) for the root architecture diagram.

Core flow:

1. Fixture or optional live MCP adapter exposes Splunk inventory through the shared adapter contract.
2. The compiler builds an environment contract with indexes, sourcetypes, saved searches, knowledge objects, fields, app context, and query budgets.
3. The compiler emits a readiness profile binding deterministic rule IDs to those Splunk contract facts.
4. The harness runs the bundled deterministic specimen or ingests an externally captured agent trace.
5. The trace recorder/schema captures tool calls, evidence, results, and final answers.
6. Deterministic grader rules produce violations, score, verdict, and policy patch guidance.
7. The Readiness Receipt and static UI make the evidence reviewable.

## Development

Prerequisite: Node.js 22 or newer. The repo includes `.nvmrc` with `22` for local version managers.

```bash
npm install
npm test
npm run verify:scaffold
npm run check
```

## Limitations

- SplunkReady is a certification harness, not a chatbot, SOC copilot, detection-health product, or generic eval platform.
- The fixture demo uses representative Splunk fixture data; it is designed for deterministic local verification, not as a claim about every production deployment.
- Live mode is read-only from SplunkReady's side. The live smoke path only inventories Splunk; `live-proof` and `live-security-proof` run bounded read-only searches through MCP.
- SplunkReady never auto-mutates Splunk. Policy patches are exported for operator review.
- LLMs may explain results or draft policy text, but deterministic grader rules decide pass/fail.
- The default bundled specimen is deterministic TypeScript code for reproducible fixture demos. The env-gated Gemini specimen produces fixture and live traces. The strict flagship live security proof requires operator-owned Splunk setup data because SplunkReady does not install apps, indexes, saved searches, or events automatically.

## Submission Materials

- Official rubric grounding: [docs/hackathon-rubric.md](docs/hackathon-rubric.md)
- Devpost copy: [docs/devpost-submission.md](docs/devpost-submission.md)
- Demo script: [docs/demo-script.md](docs/demo-script.md)
- Architecture diagram: [architecture_diagram.md](architecture_diagram.md)
- Evidence pack: [submission-evidence/](submission-evidence/README.md)
- Claim ledger: [submission-evidence/claim-ledger.md](submission-evidence/claim-ledger.md)
- Live adapter safety notes: [docs/live-adapter.md](docs/live-adapter.md)
- Live setup checklist: [docs/live-setup-checklist.md](docs/live-setup-checklist.md)
- LLM specimen agent: [docs/llm-specimen-agent.md](docs/llm-specimen-agent.md)
