# SplunkReady

[![npm version](https://badge.fury.io/js/splunkready.svg)](https://www.npmjs.com/package/splunkready)

Certify AI agents before they touch production Splunk.

SplunkReady is a Splunk-native certification harness and local workbench for
teams shipping agents that can call Splunk. It does not answer alerts for the
operator. It proves whether a specific agent can safely operate against a
specific Splunk deployment.

## TL;DR

SplunkReady certifies Splunk-connected agents with deterministic Readiness Receipts. No clone, no credentials:

```bash
npx -y splunkready@0.1.14 judge-proof --out ./judge-proof --json
```

From a clone:

```bash
npm install
npm run platform-proof
npm run judge-proof
```

Fast hosted launch packet:

- `https://arshgill01.github.io/SplunkReady/?artifacts=artifacts%2Fmcp-proof#mcp-proof`
- `submission-evidence/judge-launch/judge-launch.md`
- `submission-evidence/judge-launch/judge-launch.json`

Live Splunk evidence:

- `submission-evidence/official-splunk-mcp-live/official-splunk-mcp-live-summary.json`
- `submission-evidence/official-splunk-mcp-live/official-splunk-mcp-live-session.redacted.jsonl`
- `submission-evidence/real-splunk-proof-audit/real-splunk-proof-audit.json`
- `submission-evidence/live-hosted-model-status/live-hosted-model-status.json`
- Official `Splunk_MCP_Server` calls are captured from the operator-owned live
  endpoint.
- After operator-authorized SAIA enablement, live Splunk AI Assistant hosted-model calls pass.
  Covered tools: generate, explain, optimize, and ask-splunk-question.

`npm run platform-proof` writes:

- `artifacts/platform-devex-proof/platform-devex-proof.json`
- a markdown summary
- a fixture demo bundle
- a `judge-proof` bundle
- a strict MCP transcript certification using `--strict-import true --require-pass true`

MCP proof:

```bash
npm run mcp-proof
```

Fastest MCP judging path:

- Hosted route: `https://arshgill01.github.io/SplunkReady/?artifacts=artifacts%2Fmcp-proof#mcp-proof`
- Scorecard: `submission-evidence/mcp-proof/mcp-category-scorecard.json`
- Audit command: `node scripts/audit-mcp-category-evidence.mjs --out submission-evidence/mcp-proof --require-strong`
- Boundary:
  - Splunk MCP is the investigation/data plane.
  - SplunkReady is the deterministic readiness gate.
  - Captured Splunk MCP behavior becomes a Readiness Receipt.

Developer workflow surfaces:

- PR gate sample: `npm run pr-gate:sample`
- GitHub Action: `action.yml`
- Trace bridge and external-trace examples: [examples/README.md](examples/README.md)
- Published typed policy SDK: `import { policy } from "splunkready/policy"`
  (see [`src/policy-sdk/README.md`](src/policy-sdk/README.md) and
  [`policies/README.md`](policies/README.md)).
- Local package boundary: this subpath is in current local `splunkready@0.1.14` builds and is clean-install verified.

Start with [submission-evidence/JUDGE-PATH.md](submission-evidence/JUDGE-PATH.md)
for the short evidence trail. The rest of `submission-evidence/`, `moves/`, and
`logs/reviewer-inbox/` preserve audit history; they are not the first-read
onboarding path.

## One-Sentence Pitch

Splunk is making operational data agent-ready. SplunkReady makes agents Splunk-ready.

## What It Does

The Agent Readiness Compiler:

- compiles a fixture or live Splunk environment into an agent contract;
- derives a readiness profile;
- runs missions or accepts captured agent traces;
- grades tool traces with deterministic rules;
- produces a signed Readiness Receipt.

Flagship story: security investigation readiness.

- Before: the bundled specimen clears possible lateral movement after using `index=*`, a stale field, and no saved search provenance.
- Compiler result: SplunkReady catches the unsafe trace and exports a reviewable policy patch.
- After: the same mission reruns with bounded Splunk behavior and evidence-backed pass criteria.
- Default: deterministic specimen for local reproducibility.
- Optional: set `SPLUNKREADY_LLM_ENABLED=true` to run the Gemini-backed specimen.

### Policy SDK Quickstart

This SDK subpath is present in current local `splunkready@0.1.14` builds and has been clean-install verified.

```ts
import { policy } from "splunkready/policy";

const builtins = await policy.list();
// [
//   { id: "default-readiness", ... },
//   { id: "pci-dss-readiness",  ... },
//   { id: "soc2-readiness",      ... }
// ]
const bundle = await policy.load("pci-dss-readiness");
const binding = policy.bindToMission(bundle, mission);
if (!binding.compatible) {
  throw new Error(`policy gaps: ${binding.missionRulesNotInPolicy.join(", ")}`);
}
```

The SDK also exposes `signPolicy`, `verifyPolicyManifest`, `hashPolicy`,
`requiredRuleIds`, `criticalRules`, and `checkCompatibility`. See
[`src/policy-sdk/README.md`](src/policy-sdk/README.md) for the full API.

The tracked evidence pack is in [submission-evidence/](submission-evidence/README.md):

- self-verifiable three-mission fixture proof;
- redacted public proof export;
- credential-free Splunk app package proof;
- manually inspected workbench screenshots;
- claim ledger mapping public claims to evidence paths.

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
npx -y splunkready@0.1.14 judge-proof --out ./judge-proof --json
```

The repo-linked GitHub Packages mirror is `@arshgill01/splunkready@0.1.7`;
that registry path requires GitHub package authentication. The npmjs command
above is the unauthenticated judge path.

Package claim boundary:

- Clean temp smoke: the command must return `PASS` with `mutation: false`.
- Public audit: `npm run audit:public-package-currentness`.
- Published `0.1.14`: judge proof, MCP surface, `live-proof --live-mock`, and signed policy-registry smoke tests pass.
- Current source: package-input commits include `splunkready/policy`.
- Public npm claim: source-current after `0.1.14` publish and passing currentness audit.

### Standalone Release Artifact

Move 170 adds a no-Node release artifact path for GitHub Releases.

Current macOS arm64 smoke:

- built with Node SEA;
- includes executable plus bundled `fixtures/` and `policies/`;
- extracted into a clean temp folder;
- smoked with:

```bash
splunkready judge-proof --out ./judge-proof --json
```

Evidence:

- Current OS: `submission-evidence/standalone-release/standalone-release-current-os.json`
- Matrix: `submission-evidence/standalone-release/standalone-release-matrix.json`
- Public release: `https://github.com/Arshgill01/SplunkReady/releases/tag/v0.1.7`
- Public release evidence: `submission-evidence/standalone-release/standalone-release-github-release.json`

The current-OS evidence records:

- `status: "PASS"`
- target `macos-arm64`
- smoke `PASS`
- stdout command `judge-proof`
- 67 generated artifacts
- `mutation: false`

The matrix evidence shows Linux, macOS, and Windows runners each built,
smoked, and uploaded standalone artifacts.

Public download smoke:

```bash
curl -fsSLO https://github.com/Arshgill01/SplunkReady/releases/download/v0.1.7/splunkready-macos-arm64.tar.gz
curl -fsSLO https://github.com/Arshgill01/SplunkReady/releases/download/v0.1.7/splunkready-macos-arm64.tar.gz.sha256
shasum -a 256 -c splunkready-macos-arm64.tar.gz.sha256
tar -xzf splunkready-macos-arm64.tar.gz
./splunkready judge-proof --out ./judge-proof --json
```

Public-download smoke evidence:

- `submission-evidence/standalone-release/standalone-release-public-download-smoke.json`
- reports `PASS`
- writes 67 generated artifacts
- keeps `mutation: false`
- requires no Node, npm, `npx`, repo checkout, Splunk credentials, or live mutation

CI users who do not want a Node setup step can install the standalone binary
through the repository sub-action:

```yaml
- uses: Arshgill01/SplunkReady/setup-splunkready@v0.1.7
  with:
    version: v0.1.7

- run: splunkready judge-proof --out "$RUNNER_TEMP/splunkready-proof" --json
```

The setup action:

- downloads the public release archive for the runner;
- verifies the SHA-256 checksum;
- adds the binary directory to `PATH`;
- is tracked at `submission-evidence/setup-splunkready-action/setup-splunkready-action.json`;
- records the supported targets, checksum boundary, no-Node/no-npm consumer job, and credential-free mutation boundary.

Tag boundary: The `v0.1.7` tag includes `setup-splunkready/action.yml`; older tag `v0.1.6` does not.

`npm run judge-proof` writes a credential-free proof bundle to `artifacts/judge-proof`:

- builds the TypeScript runtime;
- runs the multi-mission fixture fail -> patch -> rerun -> pass suite;
- writes `compiler-diagnostics.json` / `.md`;
- audits the suite and verifies its manifest;
- runs and verifies the firewall pre-execution proof;
- writes `certification-index.json` plus `ui-artifacts.json`.

It does not call live Splunk and does not mutate Splunk.

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
npm run audit:npm-release-preflight -- --out submission-evidence/npm-release-preflight/npm-release-preflight.json
npm run audit:public-package-currentness -- --out submission-evidence/public-package-currentness
npm run audit:release-alignment
```

That preflight checks package metadata, dry-run pack contents, npm registry
state, and local npm authentication. It prints `PUBLISHED` for the current
released version, `READY` for a bumped unpublished version, and `BLOCKED` when
the package is otherwise ready but the machine is not logged in to npm. The
currentness audit checks the public registry, runs the latest published
`judge-proof` from a clean temp folder, and verifies whether the published
package can initialize the SplunkReady MCP stdio server.
The release-alignment audit converts source-currentness drift into the exact
next publish action. Current evidence is
`submission-evidence/release-alignment/release-alignment.json`; after the
`0.1.14` release it should report that public npm latest matches the local
package and that published probes pass.

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

What `npm run mcp-proof` does:

- Starts the built SplunkReady stdio MCP server.
- Negotiates `initialize`.
- Lists non-destructive certification tools, resources, and prompts.
- Discovers the templated Readiness Receipt resource.
- Reads certification posture and MCP-client configuration.
- Reads client templates:
  - `splunkready://client-config/claude-desktop`
  - `splunkready://client-config/cursor`
  - `splunkready://client-config/antigravity`
  - `splunkready://client-config/zed`
- Reads hosted-model workflow resources:
  - `splunkready://workflows/hosted-model-diagnostic`
  - `splunkready_hosted_model_diagnostic`

What it certifies:

- checked-in passing MCP JSON-RPC transcript via `splunkready_certify_mcp_transcript`;
- direct-content transcript path via `splunkready_certify_mcp_transcript_content`;
- fixture-mode hosted-model advisory access via `splunkready_check_hosted_model_access`;
- two-server Splunk MCP plus SplunkReady MCP composition via `splunkready_review_mcp_composition`.

What it writes:

- `artifacts/mcp-proof/mcp-proof-summary.json`
- `artifacts/mcp-proof/mcp-proof-summary.md`
- generated Readiness Receipt artifacts
- `dual-server-session.jsonl` through the `compositionRecorder` block
- `appInspectComposition` evidence when `--live-mock` is used for AppInspect MCP composition

Important evidence blocks:

- `splunkMcpBoundary`
  - certified `splunk_*` tools
  - saved-search execution
  - evidence refs and receipt link
  - deterministic authority
- `compositionRecorder`
  - redacted dual-server session
  - preserved `serverId` values for Splunk MCP and SplunkReady MCP
- `appInspectComposition`
  - starts `uvx splunk-appinspect[mcp] mcp-server`
  - calls `inspect_app`
  - records AppInspect as advisory static validation
- `agentDrivenWorkflow`
  - MCP client investigates with Splunk MCP
  - captures JSON-RPC
  - calls SplunkReady MCP for certification
  - explains the receipt without overriding it
- `operatorLiveHostedModelStatus`
  - records the live SAIA blocker class
  - uses a redacted operator-owned diagnostic artifact when present

Current AppInspect evidence:

- validation `SUCCESS`
- 0 package failures
- 0 errors
- 1 warning
- not claimed as Splunkbase approval

Boundary:

- Fixture-only by default.
- Credential-free.
- Non-mutating.
- SplunkReady certifies captured Splunk MCP behavior.
- SplunkReady is not a Splunk search copilot.

Category-facing summary:

- `submission-evidence/mcp-proof/mcp-category-scorecard.json`
- `submission-evidence/mcp-proof/mcp-category-scorecard.md`

The scorecard combines:

- SplunkReady MCP surface
- mock Splunk MCP session
- dual-server recorder transcript
- AppInspect MCP composition
- hosted-model MCP diagnostic
- strong Zed external-client evidence

It reports `PASS`, score `100`, `VERIFIED_STRONG`, 15 Zed frames, zero
warnings, zero failures, deterministic authority, and `mutation: false`.

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
signed policy-registry commands, and the `mcp-recorder` gateway. Newer
current-source subpaths, including `splunkready/policy`, require the next npm
release and a clean public-package currentness audit before they are public npm
claims.

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

The command:

- builds the TypeScript runtime and Vite UI;
- starts one localhost-only server;
- prints the local URL, artifact root, fixture capability, live capability, and
  SAIA status;
- opens on the usable certification replay, not a marketing page.

No live Splunk credentials are required for the fixture path.

For UI development with Vite middleware, use:

```bash
npm run workbench:dev
```

The workbench API and UI are served from the same local origin. Live actions
remain disabled unless the live environment variables in the Live Mode section
are set in the shell that starts the server.

## Public Demo Export

For a credential-free static demo export:

```bash
npm run public-demo:build
npm run audit:public-demo-export
```

The export writes `artifacts/public-demo` from:

- the built Vite workbench;
- tracked submission evidence;
- the rendered architecture diagram.

The audit checks:

- required proof bundles;
- the default MCP proof route;
- the public LLM deliberation artifact route;
- no secret-named files;
- no symlinks;
- `mutation=false`.

To deploy that export through GitHub Pages, enable Pages for the repository and
run the `Public Demo Pages` workflow manually.

The workflow:

- builds `artifacts/public-demo`;
- runs `audit:public-demo-export`;
- uploads the Pages artifact;
- deploys without live Splunk or Gemini secrets.

Do not claim a public URL until that workflow has completed and the Pages URL
has been opened successfully.

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

The command writes:

- `submission-evidence/splunk-app-package/SplunkReady-0.1.7.spl`
- `submission-evidence/splunk-app-package/splunk-app-package-manifest.json`

Package boundary:

- Static.
- Credential-free.
- No default-path writes.

It contains no:

- `local/` directory;
- Python REST handlers;
- scripted inputs or modular inputs;
- saved searches;
- tokens;
- default-path Splunk write operations.

Install proof:

- Evidence: `submission-evidence/splunk-app-install/splunk-app-install-proof.json`
- Scope: operator-approved install or upgrade of the same `.spl`
- Verified:
  - app metadata
  - views and navigation
  - `splunkready_receipts`
  - `splunkready_receipts_lookup`
- Redaction:
  - endpoint values are not written
  - username values are not written
  - password and token values are not written
- Boundary:
  - this is install evidence only
  - this is not a Splunkbase approval claim

Browser-render proof:

- Evidence: `submission-evidence/splunk-app-web-proof/splunk-app-web-proof.json`
- Runs against operator-owned Splunk Web
- Verifies the installed launcher route
- Opens the static workbench receipt route:
  `/en-US/static/app/SplunkReady/splunkready/index.html?artifacts=artifacts%2Fpublic-proof-export#receipt`
- Detects the overview dashboard panels
- Captures `submission-evidence/screenshots/splunk-app-web-proof.png`
- Redaction:
  - endpoint values are not written
  - username values are not written
  - secret and cookie values are not written

Receipt store proof:

- Evidence: `submission-evidence/splunk-receipt-store/splunk-receipt-store-proof.json`
- Requires explicit `--confirm-write true`
- Writes six public-safe receipt summaries into the installed app's KV Store
- Reads them back through `splunkready_receipts_lookup`
- Does not upload:
  - raw traces
  - raw Splunk events
  - endpoints
  - usernames
  - passwords or tokens

Splunkbase readiness:

- Report: `submission-evidence/splunkbase-readiness/splunkbase-readiness.json`
- Records:
  - current `.spl` package SHA
  - AppInspect precertification result
  - live install proof
  - receipt-store proof
  - official Splunk submission references
- Tracks packaged listing assets:
  - `appIcon.png` 36x36
  - `appIcon_2x.png` 72x72
  - `screenshot.png` 623x350
- Current local evidence:
  - 0 errors
  - 0 failures
  - one expected KV Store warning
- Boundary:
  - no "Available on Splunkbase" badge is claimed
  - public listing requires publisher-account submission and Splunk approval

Operator-ready portal copy:

- `submission-evidence/splunkbase-readiness/splunkbase-listing-dossier.json`
- `docs/splunkbase-listing-dossier.md`
- Includes listing text, release notes, support-contact blocker, package SHA,
  AppInspect result, and the no-badge guardrail

## Grade a Captured Agent Trace

The fixture demo is reproducible, but SplunkReady is not limited to its bundled
specimen.

After compiling the environment contract, pass in a schema-valid trace captured
from another Splunk-connected agent:

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

The compile command also writes `readiness-profile.json`, which binds active
rule IDs to the compiled Splunk contract.

The trace grading command writes:

- `trace-external.json`
- deterministic violations
- a score
- `receipt-external-001.json`
- `receipt-external-001.md`

It rejects traces whose `missionId` does not match the selected mission. The
trace producer is outside SplunkReady; the deterministic rule engine remains the
pass/fail authority.

For external-agent CI, `proof-audit --require-pass true` recognizes
`receipt-external-001.json` as an `external-trace` proof and fails the gate
unless the deterministic receipt is `READY`.

Each audit also writes `proof-manifest.json`, a SHA-256 manifest for the proof
bundle files. That lets shared artifacts be checked without re-running the
agent. `verify-manifest` re-hashes the bundle and fails if any audited artifact
was changed, removed, or added after the manifest was created.

To add replay lineage over all receipt artifacts in a bundle:

```bash
npm run splunkready -- verify-receipt \
  --dir submission-evidence/suite-proof \
  --public-key submission-evidence/receipt-public-key.pem \
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
receipt hashes. `verify-receipt-chain` remains supported as a compatibility
alias for the same verifier.

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

See [examples/README.md](examples/README.md) for:

- runnable external-trace capture scripts;
- generated sample receipts for `NOT READY` external agent traces;
- generated sample receipts for `READY / 100` external agent traces.

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

This single gate writes:

- compiled contract;
- imported canonical trace;
- deterministic violations;
- external receipt;
- proof audit;
- `mcp-transcript-certification.json`.

`--strict-import true` rejects incomplete JSON-RPC logs. `--require-pass true`
blocks CI unless the external MCP agent receives a deterministic `READY`
receipt.

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

The command writes `certification-index.json`, a compact ledger of:

- proof directories;
- audit status;
- receipt verdicts and scores;
- evidence counts;
- mutation posture;
- proof-manifest hashes;
- UI links back to each proof bundle.

It also writes `ui-artifacts.json`, which lets the Vite app populate its
artifact selector from the generated proof set instead of a hardcoded demo list.

Use `--require-pass true` in CI to fail the job if any indexed proof audit is
`WARN` or `FAIL`.

## Multi-Mission Fixture Proof

To prove the harness is not a single scripted mission, run the suite proof:

```bash
npm run build
npm run splunkready -- suite-proof --out artifacts/suite-proof --json
npm run splunkready -- suite-proof --out artifacts/suite-proof-ci --require-fail-to-pass true --json
npm run splunkready -- proof-audit --out artifacts/suite-proof-ci --require-pass true --json
npm run splunkready -- suite-proof \
  --suite fixtures/acme-soc-dev/suites/phase-live-readiness-suite.json \
  --out artifacts/suite-proof-custom \
  --require-fail-to-pass true \
  --json
```

`suite-proof` runs the fixture fail -> patch -> rerun -> pass loop across a
suite manifest.

Default suite:

- `fixtures/acme-soc-dev/suites/phase-live-readiness-suite.json`
- two security missions
- one observability mission

It writes each mission's normal artifacts plus `suite-proof-summary.json` /
`.md`, including:

- proof-loop classification;
- domains covered;
- evidence counts;
- suite manifest provenance;
- `mutation: false`.

This path is credential-free and does not call live Splunk.

Use `--require-fail-to-pass true` in CI when a READY receipt is not enough and
every mission must prove the full certification loop. `proof-audit
--require-pass true` also understands suite bundles and checks the suite
summary, mutation posture, fail-to-pass count, READY-after-patch count, and
evidence refs.

## Runtime Firewall Gate

Use `--firewall` to wrap the Splunk adapter with the compiled policy before
the specimen can run SPL.

Supported commands:

- `evaluate`
- `rerun`
- `live-proof`
- `live-security-proof`

```bash
npm run splunkready -- compile --out artifacts/firewall-check
npm run splunkready -- evaluate --out artifacts/firewall-check --firewall
```

When the firewall blocks a query, SplunkReady rejects it before Splunk
execution and exits nonzero.

It writes:

- `firewall-block-before.json` or `firewall-block-after.json`
- blocked query
- deterministic rule IDs
- tool name
- phase
- `mutation: false`

You can audit that bundle directly:

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

Without live configuration, the live smoke command skips safely.

With live configuration, it:

- calls read-only MCP tools only;
- writes `live-smoke-contract.json`;
- writes `live-smoke-readiness-profile.json`;
- does not run searches;
- does not mutate Splunk configuration.

See [docs/live-adapter.md](docs/live-adapter.md) and
[docs/live-setup-checklist.md](docs/live-setup-checklist.md).

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

`live-proof`:

- compiles the live contract;
- scans bounded read-only saved-search candidates;
- writes `live-derived-mission.json`;
- runs evaluate -> receipt -> rerun against that generated mission;
- writes `live-proof-summary.json`.

The summary includes the explicit `proofLoop` classification:

- `fail-to-pass`
- `ready-without-patch`
- not ready after rerun

If no saved search returns rows but `_internal` is available, it falls back to a
bounded `_internal` query mission.

It does not create indexes, install apps, write saved searches, or mutate
Splunk.

For the flagship security story, `live-security-proof` is stricter.

It requires:

- the lateral-movement saved search;
- evidence rows discovered by `live-security-check`;
- the live Gemini specimen fail -> patch -> rerun -> pass loop.

It writes `live-security-proof-summary.json`. The readiness JSON records:

- `proofMode.fallbackAllowed: false`
- setup requirements
- fallback policy

A fresh Splunk trial without the exact saved search is a clear `BLOCKED`
diagnostic, not a hidden `_internal` downgrade.

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

In LLM mode:

- `evaluate` prompts the model without compiled Splunk contract injection;
- `rerun` injects the compiled policy and contract;
- SplunkReady still executes tool calls through the adapter;
- the deterministic grader still decides pass/fail.

Current real-Splunk LLM evidence is tracked under
`submission-evidence/real-splunk-stress-llm-layer/`:

- `llm-deliberation-before.json`
- `llm-deliberation-after.json`
- `llm-claim-audit-before.json`
- `llm-claim-audit-after.json`
- `screenshots/workbench-llm-deliberation.png`

See [docs/llm-specimen-agent.md](docs/llm-specimen-agent.md).

## Submission Strategy

SplunkReady targets the Platform & Developer Experience track.

The product story is infrastructure for safer Splunk-connected agents. The
security investigation is the memorable demo scenario.

## What It Is Not

- Not a Splunk chatbot.
- Not a SOC copilot.
- Not MCP telemetry.
- Not a detection-health dashboard.
- Not a generic eval harness.
- Not an LLM judging another LLM.

## Primary Artifact

The Readiness Receipt is the product artifact.

It records:

- environment contract version;
- mission suite version;
- trace evidence;
- deterministic violations;
- score;
- verdict;
- policy patch summary.

The score is severity-weighted and thresholded by deterministic blockers, not
hardcoded to `0` or `100`.

The calibration artifact under `submission-evidence/readiness-score-calibration/`
shows READY `100`, NEEDS REVIEW `88`, and NOT READY `59` examples from the same
scorer.

The companion readiness profile records why the rule surface is active for this
Splunk deployment.

## Architecture

The Agent Readiness Compiler keeps fixture and live Splunk access behind the
same adapter boundary.

It then:

- compiles a contract;
- runs missions;
- grades traces with deterministic rules;
- emits a Readiness Receipt.

See [architecture_diagram.md](architecture_diagram.md) for the root architecture
diagram and [docs/architecture.svg](docs/architecture.svg) for the rendered
visual. `npm run public-demo:build` exports the rendered visual at the stable
public-demo path `artifacts/public-demo/architecture.svg`.

Core flow:

1. Fixture or optional live MCP adapter exposes Splunk inventory through the
   shared adapter contract.
2. The compiler builds an environment contract with indexes, sourcetypes,
   saved searches, knowledge objects, fields, app context, and query budgets.
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

- SplunkReady is a certification harness, not a chatbot, SOC copilot,
  detection-health product, or generic eval platform.
- The fixture demo uses representative Splunk fixture data. It is designed for
  deterministic local verification, not as a claim about every production
  deployment.
- Live mode is read-only from SplunkReady's side. The live smoke path only
  inventories Splunk; `live-proof` and `live-security-proof` run bounded
  read-only searches through MCP.
- SplunkReady never auto-mutates Splunk. Policy patches are exported for operator review.
- LLMs may explain results or draft policy text, but deterministic grader rules decide pass/fail.
- The default bundled specimen is deterministic TypeScript code for
  reproducible fixture demos.
- The env-gated Gemini specimen produces fixture and live traces.
- The strict flagship live security proof requires operator-owned Splunk setup
  data because SplunkReady does not install apps, indexes, saved searches, or
  events automatically.

## Submission Materials

- Official rubric grounding: [docs/hackathon-rubric.md](docs/hackathon-rubric.md)
- Devpost copy: [docs/devpost-submission.md](docs/devpost-submission.md)
- Demo script: [docs/demo-script.md](docs/demo-script.md)
- Architecture diagram: [architecture_diagram.md](architecture_diagram.md) and rendered [docs/architecture.svg](docs/architecture.svg)
- Evidence pack: [submission-evidence/](submission-evidence/README.md)
- Claim ledger: [submission-evidence/claim-ledger.md](submission-evidence/claim-ledger.md)
- Live adapter safety notes: [docs/live-adapter.md](docs/live-adapter.md)
- Live setup checklist: [docs/live-setup-checklist.md](docs/live-setup-checklist.md)
- LLM specimen agent: [docs/llm-specimen-agent.md](docs/llm-specimen-agent.md)
