# Risk Register

## Active Risks

### R001 LLM-Judging-LLM Drift

Risk: grader becomes vague AI scoring.

Mitigation: deterministic checks decide pass/fail; LLMs explain and patch.

### R002 Fake Specimen Agent

Risk: demo agent is scripted to fail/pass.

Mitigation: bundled deterministic specimen is labeled honestly; external trace grading exists; the Gemini-backed specimen produces model-driven traces; and external agents can now import Splunk MCP JSON-RPC transcripts into canonical trace events before deterministic grading.

### R003 Fixture/Live Divergence

Risk: fixture demo does not represent live MCP path.

Mitigation: shared adapter interface, shared schemas, and Wave 84 readiness profiles compiled from the same fixture/live contract boundary.

### R004 Generic Dashboard Drift

Risk: UI becomes cards and scores without provenance.

Mitigation: receipt and trace evidence are primary.

### R005 Splunk Feature Collision

Risk: product looks like MCP telemetry, ES triage, or detection testing.

Mitigation: keep pre-production agent certification as boundary.

## Wave 41 Closure Assessment

Status: no blocker risk remains for the current final-QA gate.

- R001 LLM-Judging-LLM Drift: controlled. Deterministic grader tests pass, and LLMs are not used as the primary pass/fail judge.
- R002 Fake Specimen Agent: controlled. The specimen agent and trace fixtures are executable, and the demo shows before/after behavior through receipts and traces.
- R003 Fixture/Live Divergence: controlled with continued monitoring. Fixture and live paths share the adapter boundary; Wave 44 remains planned for optional live operator hardening.
- R004 Generic Dashboard Drift: controlled with continued monitoring. UI claims are backed by receipt, trace, and violation data; Wave 43 remains planned for Antigravity/Gemini UI sidecar polish.
- R005 Splunk Feature Collision: controlled. README and submission copy keep SplunkReady positioned as pre-production agent certification, not a chatbot, SOC copilot, MCP telemetry, or detection-health product.

Residual risks are not blockers for Wave 41, but they remain active monitoring items for Wave 42+ continuation work.

## Phase Live Risk Update - 2026-06-02

### R006 Live Security Content Gap

Risk: the live Splunk trial proves MCP connectivity but does not contain Enterprise Security saved searches or demo lateral-movement events, so the flagship security mission cannot yet produce a live fail -> patch -> pass receipt.

Mitigation: keep the fixture security story intact; add live-compatible missions only when they are explicitly labeled; pursue either operator-approved demo content, a live mission generator, or a firewall gateway before claiming flagship live security proof.

### R007 Evidence Ref Loss From Aggregation

Risk: an LLM agent can choose aggregated SPL (`stats`, `chart`, `timechart`) that returns counts but no row-level evidence refs, weakening the Readiness Receipt.

Mitigation: prompt query-only missions to capture raw rows first, preserve deterministic EVD rules, and consider firewall/policy checks for evidence-ref missions.

### R008 Mission Rule Drift

Risk: callers pass all known grader rules and accidentally evaluate rules the mission did not activate.

Mitigation: `runRuleEngine` now filters by `mission.checks`; focused regression tests cover disabled rules not executing.

### R009 Local TLS Workaround Normalization

Risk: local proof uses `NODE_TLS_REJECT_UNAUTHORIZED=0` for a self-signed Splunk endpoint, which must not become production guidance.

Mitigation: log the friction in `logs/splunk-feedback.md`; keep it local-command-only; do not bake it into code or docs as the default production path.

### R010 Firewall Overblocking

Risk: the Live Agent Firewall Gateway can block a query that the receipt grader might have accepted under a mission-specific exception, because the gateway is constructed from `EnvironmentContract` and `AgentPolicy` rather than a mission.

Mitigation: keep the firewall conservative and transparent. It only blocks pre-execution violations it can prove from the compiled deployment policy: forbidden SPL, unknown contract metadata, restricted/sensitive indexes, or disallowed tools. Mission-specific pass/fail remains the deterministic receipt grader's job.

### R011 Premature Completion / Under-Hardening

Risk: treating the current `moves/` directory as the finish line could leave the product below the owner's target for major award competitiveness.

Mitigation: use the current moves as a floor. After they pass, continue with product hardening moves that improve maintainability, clarity, modularity, judge flow, evidence quality, and high-leverage award positioning. Do not mark the active goal complete merely because the current move files are implemented.

### R012 Workbench Surface Creep

Risk: keeping every testing/debug affordance visible in the dashboard could overload the final judge experience.

Mitigation: keep instrumentation while it is needed for verification, then execute a final UI consolidation move to collapse, relabel, or relocate secondary controls without hiding deterministic evidence, redaction boundaries, or fixture/live parity.

### R013 Native Agent Integration Friction

Risk: developers using LangChain, AutoGen, CrewAI, LlamaIndex, or a custom MCP agent may see manual SplunkReady trace JSON shaping as workflow friction rather than developer enablement.

Mitigation: add and maintain a dependency-free agent trace bridge that can be called from framework callbacks or tool wrappers, then certify the resulting trace through the same external trace workflow and deterministic receipt grader.

### R014 Determinism Perceived As Boring

Risk: a judging panel may reward flashy LLM-judged loops and discount deterministic rules as less "AI-native," even though deterministic pass/fail authority is the safer enterprise design.

Mitigation: keep deterministic grading authoritative, but present it as an Agent Readiness Compiler contract surface: rule activations derive from Splunk facts, receipts cite evidence, and advisory LLM/SAIA output may explain or draft fixes without deciding readiness.

### R015 Flagship Live Security Data Gap

Risk: a fresh Splunk trial may not contain the Enterprise Security saved searches or lateral-movement event data required for the flagship security proof, making a live run fall back to a less compelling `_internal` path.

Mitigation: keep fixture proof honest and reproducible; make live-security proof depend on operator-owned demo data or existing ES content; do not claim the flagship security mission will fully pass on an empty trial without setup evidence. Move 47 makes the contract machine-readable: `live-security-check` records `proofMode.fallbackAllowed: false`, setup requirements, and a fallback policy that separates generic `live-proof` evidence from strict `live-security-proof` evidence.

### R016 MCP Server Scope Drift

Risk: adding a SplunkReady MCP server could be misunderstood or expanded into a Splunk search copilot, telemetry service, or mutation-capable operations bridge.

Mitigation: keep the MCP server scoped to certification tools that reuse the Agent Readiness Compiler, external trace intake, MCP transcript import, deterministic grading, and Readiness Receipt artifacts. Do not expose Splunk write tools or use LLM/SAIA output as pass/fail authority.

### R017 Fresh-Clone Judge Friction

Risk: judges evaluating Platform & Developer Experience may abandon the project if they must discover and chain several CLI commands before seeing a complete proof bundle.

Mitigation: provide `npm run judge-proof` as a one-command fixture proof that builds the runtime, runs strict multi-mission fail-to-pass certification, audits proof bundles, verifies manifests, runs the firewall proof, and writes a certification index for the workbench. Keep live Splunk proof separate and honest because a fresh trial may not contain the flagship security datasets.

### R018 Developer Workflow Friction

Risk: SplunkReady can still feel like an external certification constraint rather than a developer accelerator if common workflows require manual trace export, local command discovery, or custom JSON shaping.

Mitigation: keep shrinking the path from agent run to Readiness Receipt. Prioritize thin integrations and adapters over heavyweight framework dependencies: maintain the dependency-free trace bridge, MCP certification tools, one-command judge proof, copy-paste snippets for common callback/tool-wrapper patterns, and the repository-root composite GitHub Action for credential-free `judge-proof`, `mcp-transcript`, and `external-trace` CI gates.

### R019 MCP Award Positioning Gap

Risk: judges in a Best Use of MCP category may expect a useful MCP server, not only MCP-shaped trace validation.

Mitigation: keep the SplunkReady MCP server scoped to certification and receipt generation, but make that path visible and testable. The MCP story should be that an agent can ask a local server to certify traces and produce Readiness Receipts through the Agent Readiness Compiler, not that SplunkReady is a Splunk search copilot. `npm run mcp-proof` now starts the stdio MCP server, negotiates tools, and certifies a passing MCP transcript into a Readiness Receipt without live credentials or mutation.

## Competitive Audit Update - 2026-06-05

Logged source: `logs/competitive-audit-2026-06-05.md`.

The latest user audit lowers competitive confidence for Platform & Developer
Experience, Best Use of MCP Server, and Developer Tools. The audit reinforces
three active risks already tracked here:

- R014 Determinism Perceived As Boring: do not weaken deterministic pass/fail;
  instead, present it as compiler-grade proof with visible rule activation,
  evidence refs, and advisory explanations.
- R015 Flagship Live Security Data Gap: keep strict `live-security-proof`
  separate from generic live fallback; a fresh Splunk trial is not enough unless
  operator-owned security data and saved-search setup are present.
- R018/R019 Developer Workflow and MCP Positioning Friction: continue reducing
  setup friction through package-style CLI execution, CI gates, MCP server
  proof, and thin trace capture integrations.

Move 50 addresses one concrete Developer Tools gap: the local/package-style
`splunkready` bin can run the fixture judge proof from outside the repository
root by resolving bundled default fixture assets.

Move 51 addresses one concrete R014 gap: `suite-proof` now emits
`compiler-diagnostics.json` / `.md`, a deterministic report that maps active
rule bindings to before/after violation counts, resolved rules, trace refs,
evidence refs, deployment signals, and the advisory-only LLM boundary.

Move 52 carries that proof surface into CI by exposing `diagnostics-path` from
the composite GitHub Action and rendering it in the GitHub job summary.

Move 53 addresses the Runs trace preview readability risk under R004/R012 by
making the preview event lanes stable for long trace metadata and by verifying
the dashboard with Playwright on desktop and narrow viewports.

Move 54 reduces R018 developer workflow friction by updating the GitHub workflow
example and docs to upload the composite action's `diagnostics-path` artifact
directly, instead of requiring CI users to know the proof directory layout.

Move 55 reduces R013/R018 by exposing stable package subpaths for
`splunkready/trace-bridge`, `splunkready/callback-trace-capture`, and
`splunkready/schemas`, with generated TypeScript declarations verified through a
temp consumer project and `npm pack --dry-run`.

### Minimax 3 Audit Follow-Up - 2026-06-05

Logged source: user-provided Minimax 3 read-only audit in chat.

The audit agrees the engine is real and defensible, but lowers competitive
confidence because the latest work is not fully packaged for judges. Concrete
follow-up risks to track:

- Public installability remains capped while `package.json` is `private: true`;
  do not claim `npx splunkready` until publication is explicit and verified.
- A hosted, clickable workbench URL would reduce judge abandonment, but public
  deploy is an external release action and should be treated separately from
  local verification.
- The tracked `submission-evidence/` pack is stale relative to the later
  workbench, MCP proof, GitHub Action, compiler diagnostics, and strict live
  security readiness surfaces.
- The latest competitive-audit moves need reviewer-equivalent scrutiny even
  though subagents are currently disabled by user instruction.
- `src/cli.ts` remains a large monolith despite the older modularization goal;
  this is production-quality debt, not an engine correctness blocker.
- The MCP server is functional but narrow; resources and reusable prompts would
  make the MCP story more composable without turning SplunkReady into a Splunk
  copilot.
- Official hackathon criteria are not tracked in-repo, so probability estimates
  remain rubric assumptions until anchored to the published criteria.

Move 56 reduces the CI visibility portion of the Minimax 3 audit by adding a
repository GitHub Actions workflow that runs the canonical `npm run check` gate
on Node 22 without live Splunk or Gemini secrets.

Move 57 fixes the first hosted CI failure from that workflow: GitHub Actions did
not have `rg`, so the workflow now installs ripgrep before the canonical gate.

Move 58 reduces R019 by adding MCP resources and prompts to the local
certification server and by updating the product story: SplunkReady's standout
MCP use is certifying Splunk MCP agent behavior, while the local MCP server is a
composable certification interface for clients that want posture resources,
prompts, and receipts.

Move 64 reduces the official-criteria uncertainty by adding
`docs/hackathon-rubric.md`, sourced from the Splunk Agentic Ops Hackathon
Devpost rules and Splunk announcement. The rubric explicitly corrects the MCP
award framing: SplunkReady should compete by certifying behavior at the Splunk
MCP Server boundary and by using its local MCP server as a composable
certification interface, not by claiming that building a separate MCP server is
the prize on its own.

Move 65 materially reduces the CLI monolith risk by moving proof audit report
generation and strict gate handling into `src/workflows/proof-audit.ts`.
`src/cli.ts` dropped from 3,388 lines to 2,795 lines in this move. Remaining
CLI-backed workflow wrappers in fixture, policy, live, and hosted-model actions
are still open modularization risks.

Move 66 removes hosted-model actions from the CLI-backed wrapper list by moving
SAIA proof and diagnostic artifact generation into
`src/workflows/hosted-model-actions.ts`. `src/cli.ts` dropped from 2,795 lines
to 2,660 lines. Remaining CLI-backed workflow wrappers are fixture
certification, policy actions, and live actions.

Move 67 removes fixture certification from the CLI-backed wrapper list by
moving reusable compile/evaluate/receipt/rerun/firewall certification actions
into `src/workflows/certification-actions.ts` and making
`src/workflows/fixture-certification.ts` construct its default backend workflow
without importing `../cli.js`. `src/cli.ts` dropped from 2,660 lines to 2,173
lines. Remaining CLI-backed workflow wrappers are policy actions and live
actions.

Move 68 removes policy actions from the CLI-backed wrapper list by moving
`policy-backed-rerun` and `firewall-check` into
`src/workflows/policy-actions.ts`. `src/cli.ts` dropped from 2,173 lines to
2,135 lines. The remaining CLI-backed workflow wrapper is live actions.

Move 69 removes the final CLI-backed workflow wrapper by moving live smoke,
saved-search candidate derivation, strict live security readiness,
operator-owned security kit generation, generic live proof, live security proof,
and live security UI bundling into `src/workflows/live-actions.ts`. `src/cli.ts`
dropped from 2,135 lines to 1,162 lines. Further CLI cleanup is still useful,
but workflow ownership no longer depends on importing `../cli.js`.

Move 70 reduces the MCP positioning gap by making `mcp-proof` explicitly emit a
`splunkMcpBoundary` block. The proof now shows that the local SplunkReady MCP
server is a certification interface while the certified behavior is a captured
Splunk MCP JSON-RPC transcript containing `splunk_get_knowledge_objects` and
`splunk_run_saved_search`, evidence refs, a generated Readiness Receipt,
deterministic authority, and `mutation: false`.

Move 71 reduces the LLM-visibility gap without weakening deterministic
authority. `judge-proof-summary.json` now includes an `llmEvidence` slot. The
default credential-free judge proof records `NOT_REQUESTED`; the explicit
`--include-llm-proof true` / `npm run judge-proof:llm` path attaches the
Gemini-produced fixture fail-to-pass proof when a Gemini key is configured.
The evidence records the LLM as trace producer and the deterministic rule
engine as pass/fail authority.

Move 72 reduces the public installability cap without performing a registry
release. `package.json` no longer sets `private: true`, publish metadata is in
place, and `npm run check` now includes a package readiness audit that runs
`npm pack --dry-run --json` after build. Actual `npm publish` remains an
explicit external release action. Registry preflight on 2026-06-05 returned
404 for both `splunkready` and `@splunkready/cli`, indicating neither package
name was claimed at check time.

Move 73 reduces developer-experience noise in hosted CI by upgrading the
repository workflow to `actions/checkout@v5` and `actions/setup-node@v5`,
which target the Node 24 JavaScript Actions runtime while keeping the project
runtime on Node 22. The goal is a clean green GitHub check without the Node 20
deprecation annotation.

Move 74 further reduces the CLI monolith risk by moving suite proof
aggregation, fail-to-pass summary generation, and compiler diagnostics into
`src/workflows/suite-proof.ts`. `src/cli.ts` dropped from 1,069 lines to 925
lines. Remaining CLI-owned orchestration still includes the standalone
`llm-agent` command and small command adapters, but the major proof bundle
orchestration is now workflow-owned.

Move 75 reduces the MCP award-positioning risk by making `mcp-proof` show a
complete agent-driven MCP loop: an MCP client discovers SplunkReady posture and
stdio configuration, uses Splunk MCP for read-only investigation, preserves the
captured JSON-RPC transcript, then calls SplunkReady MCP to generate a
deterministic Readiness Receipt. This does not add Splunk write actions and does
not make LLM/MCP output authoritative. Remaining MCP risk: the strongest public
story still needs exported live/captured proof evidence and a judge-visible demo
surface.

Move 76 further reduces the CLI monolith risk by moving `llm-agent`
orchestration into `src/workflows/llm-agent.ts`. `src/cli.ts` dropped from 925
lines to 883 lines and no longer imports receipt generation or readiness scoring
internals for that command. Remaining CLI risk: argument parsing, demo shell
generation, and small command adapters still live in `src/cli.ts`.

Move 77 reduces the CLI monolith risk by removing helper code orphaned by prior
workflow extractions. Inspection showed `demoCommand` was already a thin
workflow delegator, so extracting it would not have materially improved the
architecture. `src/cli.ts` dropped from 883 lines to 827 lines. Remaining CLI
risk: argument parsing and command adapter dispatch still live in `src/cli.ts`.

Move 78 reduces the stale-evidence cap by regenerating the tracked
`submission-evidence/` pack with suite compiler diagnostics, MCP proof
resources/prompts, captured Splunk MCP transcript certification, refreshed
public proof export, and Playwright screenshots. It also fixes the
`certify-mcp-transcript` manifest ordering bug discovered during refresh.
Remaining evidence risks: hosted demo is still open, public package publication
is still an external release action, live proof export still needs redaction
work, and MCP award positioning still needs a stronger public demo using
existing MCP servers.

Move 79 reduces the MCP demo-surface risk by making the `mcp-proof` bundle a
first-class Vite workbench view. The UI now shows the Splunk MCP read-only
boundary, SplunkReady MCP tools/resources/prompts, the reusable MCP
certification-loop prompt/resource, evidence refs, deterministic authority, and
mutation false from `mcp-proof-summary.json`. Playwright also exposed and
verified a fix for local preset artifact serving under `/artifacts/<bundle>`.
Remaining MCP risks: the hosted demo URL is still open, public package
publication remains an external release action, and live/captured external
MCP-client evidence would still strengthen the award story.

Move 80 reduces the stale-public-evidence risk introduced by Move 79 by adding
the Playwright-verified MCP proof workbench screenshot to
`submission-evidence/screenshots/` and updating the tracked evidence README,
claim ledger, and SHA-256 ledger. Remaining evidence risks are unchanged:
hosted demo URL, public package publication, and live proof export still need
separate release/redaction work.

Move 81 reduces the hosted-demo reproducibility risk by creating a local static
export primitive for the workbench and tracked credential-free evidence. This
does not eliminate the no-clickable-URL cap until the export is deployed, but it
removes the need for a static host to understand repository internals or ignored
artifact paths. The exporter refuses symlinks to reduce secret-smuggling risk.

Move 82 reduces the MCP award-positioning risk by making the proof carry a
credential-free dual-server MCP client kit: existing Splunk MCP for read-only
investigation and SplunkReady MCP for deterministic certification. This is still
captured-transcript evidence rather than a live public MCP-client screencast, so
the external demonstration cap remains open.

Move 83 reduces the no-hosted-demo friction by adding Netlify static deploy
configuration for the public demo export. It does not eliminate the hosted URL
risk because `npx netlify status` hung before auth/link status could be
confirmed and no external deploy was completed.

Move 84 reduces the public-package DevX risk by proving the packed
`splunkready-0.1.0.tgz` installs into a clean temporary npm project and that
`npx splunkready judge-proof --json` returns `PASS` with `mutation: false` from
outside the repository. It also fixed an installed-bin entrypoint bug caused by
npm's `.bin` symlink path. The public registry risk remains open because local
npm auth is unavailable and no `npm publish` was run.

Move 85 reduces the Best Use of MCP positioning risk by making MCP composition a
first-class proof artifact. The generated MCP proof now includes a
`mcpComposition` scorecard with `PASS`, `100/100`, 8 resources, 5 prompts, an
existing Splunk MCP server role, SplunkReady certification role, saved-search
evidence, deterministic receipt authority, and `mutation=false`. This does not
fully eliminate the award risk because the tracked evidence is still a
credential-free captured transcript and Playwright-verified workbench view, not
a public live MCP-client screencast.

Move 86 reduces the CLI-monolith risk by extracting CLI defaults, usage text,
option/output types, and argument parsing into `src/cli/options.ts`.
`src/cli.ts` is now 634 lines, down from 842 lines before the move, and the
packed installability audit still proves `npx splunkready judge-proof` works
from a clean temp project. Remaining CLI risk: command dispatch and several
command wrappers still live in `src/cli.ts`, so future modularization should
extract cohesive command groups rather than treat line count as the only target.

Move 87 further reduces the CLI-monolith risk by extracting proof-oriented
command wrappers into `src/cli/proof-commands.ts`. `src/cli.ts` is now 437
lines, down from 634 lines before the move, while proof behavior remains
covered by CLI tests and the canonical check. Remaining CLI risk: root dispatch
and non-proof command wrappers still live in `src/cli.ts`, so the next useful
slice is either live/external command extraction or a small command registry.

Move 88 further reduces the CLI-monolith risk by extracting external trace,
captured transcript, LLM-agent, and demo command wrappers into
`src/cli/external-commands.ts`. `src/cli.ts` is now 367 lines, down from 437
lines before the move and 634 lines before Moves 87-88. Remaining CLI risk:
root dispatch and live command orchestration still live in `src/cli.ts`, so the
next useful slice is live command extraction or a small command registry.

Move 89 further reduces the CLI-monolith risk by extracting live-mode command
wrappers and live CLI helper exports into `src/cli/live-commands.ts`.
`src/cli.ts` is now 287 lines, down from 367 lines before the move and 634
lines before Moves 87-89. Remaining CLI risk: root dispatch and hosted-model
helper exports still live in `src/cli.ts`, so the next useful slice is a small
command registry or moving hosted-model helper exports into the proof module.

Move 90 further reduces the CLI-monolith risk by extracting root command
dispatch into `src/cli/dispatch.ts` and moving hosted-model helper exports into
`src/cli/proof-commands.ts`. `src/cli.ts` is now 176 lines, down from 287 lines
before the move and 634 lines before Moves 87-90. Remaining CLI risk is no
longer a major probability cap; package publication, hosted demo proof,
refreshed evidence, and live/public MCP demonstration gaps are higher leverage.

Move 91 reduces the hosted-demo reproducibility risk by adding a canonical
`audit:public-demo-export` gate. The gate regenerates `artifacts/public-demo`
from the built Vite workbench plus tracked credential-free evidence and verifies
manifest/default-route/proof-bundle/screenshot/no-symlink/no-secret-filename
invariants. It does not eliminate the external hosted URL cap: `npx netlify
status` still hung before auth/link status could be confirmed, so no Netlify
deploy was attempted.

Move 92 reduces the MCP award-positioning risk by adding generated
`mcp-client-walkthrough.json` and `.md` artifacts to the MCP proof and tracked
submission evidence. The walkthrough makes the existing Splunk MCP Server the
read-only investigation server and SplunkReady MCP the deterministic
certification server, with saved-search evidence refs and mutation=false. This
still does not eliminate the live/public MCP-client screencast gap.

Move 93 reduces the LLM visibility risk by making `judge-proof` include the
Gemini-backed trace-producer proof when the operator enables
`SPLUNKREADY_LLM_ENABLED=true` or passes `--include-llm-proof true`. The base
suite and firewall proofs are forced back to deterministic fixture mode so LLM
mode cannot accidentally leak into the credential-free gate. If LLM mode is
enabled without `GEMINI_API_KEY`, `judge-proof` now reports
`llmEvidence.status=NOT_CONFIGURED` instead of failing the base proof.

Move 94 reduces the public-package release risk by adding
`audit:npm-release-preflight`. Move 100 closed the initial public-package
release risk by verifying the user-published `splunkready@0.1.0` package from a
clean temp folder. Move 101 updates the preflight to report the current version
as `PUBLISHED` instead of failing because the version already exists. Remaining
release risk is next-version hygiene: bump `package.json` before the next
`npm publish` and re-run the preflight.

Move 95 reduces the hosted-demo risk by adding a manual GitHub Pages deployment
workflow for the verified credential-free public demo export. The workflow
builds `artifacts/public-demo`, runs `audit:public-demo-export`, uploads the
Pages artifact, and deploys without live Splunk or Gemini secrets. This does
not eliminate the hosted URL cap until Pages is enabled, the manual workflow is
run, and the resulting URL is opened successfully.

Move 96 closes the hosted static demo cap for the MCP proof route. GitHub Pages
is enabled with `build_type=workflow`, the final `Public Demo Pages` workflow
run `27040415415` deployed successfully, and Playwright opened the live URL
`https://arshgill01.github.io/SplunkReady/?artifacts=artifacts%2Fmcp-proof#mcp-proof`
and verified rendered MCP proof evidence: PASS status, saved-search execution,
Splunk MCP tool names, evidence refs, deterministic authority, mutation=false,
and MCP composition score. Residual hosted-demo polish risk remains because the
static host logs expected 404s for optional artifact probes and unavailable
local workbench `/api/*` endpoints.

Move 97 closes the residual static-host request-noise risk by adding
per-artifact manifests to the public demo export and making the browser detect
`public-demo-manifest.json` before probing local workbench APIs. Playwright on
both a local static export and the refreshed GitHub Pages deployment rendered
the MCP proof route with zero console errors and only three proof-data requests:
`public-demo-manifest.json`, `artifacts/mcp-proof/artifact-manifest.json`, and
`artifacts/mcp-proof/mcp-proof-summary.json`. Remaining hosted-demo risk is
workflow maintenance only: GitHub Pages actions still emit a Node 20 deprecation
annotation, but the deployment succeeds.

Move 98 targets that workflow-maintenance risk by updating the public demo
Pages workflow to current upstream action tags:
`actions/configure-pages@v6`, `actions/upload-pages-artifact@v5`, and
`actions/deploy-pages@v5`. Local checks passed, including upstream tag
verification, workflow regression coverage, and `npm run check`. Hosted CI run
`27041118568` passed, and Pages run `27041167799` passed without the prior
`Node.js 20 actions are deprecated` annotation. Residual workflow-maintenance
risk is limited to raw Node `punycode` deprecation warnings emitted by
GitHub-owned action internals.

Move 104 reduces the hosted-demo public-copy risk by requiring both the hosted
MCP proof route and hosted judge-proof route in README and Devpost copy through
`audit:submission-copy`. The audit now checks 39 required claims. This does not
create new hosted-demo evidence; it prevents the already verified GitHub Pages
routes from disappearing from the judge-facing path.

Move 105 reduces the stale-cleanroom risk by verifying pushed commit
`2835916b11ba7c99df062f7a7e2d553985d5c9e2` from a fresh remote clone. The
cleanroom passed `npm ci --ignore-scripts`, `npm run check`, evidence-pack SHA
verification, hosted MCP/judge-proof fetches, and the published-package `npx`
judge proof smoke from a separate clean temp folder. Remaining risk is no
longer clean-room reproducibility; it is live proof redaction and any final
submission materials the user owns.

Move 106 reduces live proof redaction risk without reading ignored live
artifacts. A focused workflow test now proves that `public-proof-export`
redacts `live-security-proof-summary.json` endpoint URLs, private IPs, user
paths, raw bodies, bearer strings, and token-like keys before writing public
export files. This still does not claim that the current operator-owned live
proof has been exported and tracked; it proves the redaction path is guarded.

Move 108 reduces context-compaction and stale-status risk by refreshing
`docs/goal-completion-audit.md` against the current published-package,
hosted-demo, MCP-composition, remote-cleanroom, and live-redaction evidence.
Residual risk remains explicit: the overall goal is not complete until the user
approves completion, the user still owns final submission/video materials, and
MCP-award odds can improve with stronger public evidence of external MCP
client usage.

Move 109 reduces MCP-award evidence risk by recording the actual SplunkReady
MCP stdio JSON-RPC client session used by `mcp-proof`. The tracked proof now
contains `mcp-client-session.jsonl`, a markdown summary, a typed
`clientSession` block in `mcp-proof-summary.json`, public-demo export guards,
submission-copy guards, and a Playwright-verified MCP workbench screenshot.
Residual MCP risk is no longer "only two tools"; it is the absence of a public
video/live recording of an external MCP client using the two-server Splunk MCP
+ SplunkReady setup.

Move 110 reduces SAIA/hosted-model proof risk by making live hosted-model
diagnostics artifact-first even when the operator has not exported live
configuration into the current shell. The workflow now writes `BLOCKED`
`hosted-model-proof.json` and `hosted-model-diagnostic.json` with setup status
by environment-variable name only, surfaces that status in the workbench, and
proves public export redacts hosted-model proof and diagnostic content.
Residual SAIA risk remains explicit: this shell did not have the live token or
endpoint exported, so Move 110 does not claim live SAIA PASS. The next proof
step is the same `hosted-model-diagnostic --mode live --require-pass true`
command from a token-bearing shell.

Move 111 reduces MCP-category thin-surface risk by adding MCP resource-template
discovery and proving it through the recorded stdio client session. The server
now answers `resources/templates/list`, advertises
`splunkready://receipts/{receiptId}`, and reads the known
`splunkready://receipts/pass` receipt resource without exposing arbitrary local
file reads. The tracked MCP proof, workbench route, screenshot, claim ledger,
and evidence hashes were refreshed. Residual MCP risk remains external-client
storytelling: the proof is stronger MCP protocol evidence, but a public
Claude/Cursor/client walkthrough recording would still improve the award track.

Move 112 further reduces MCP-category thin-surface risk by adding
`splunkready_certify_mcp_transcript_content`, a read-only MCP tool that lets a
client certify captured transcript JSONL directly instead of relying on a local
path. The recorded proof now certifies the same Splunk MCP transcript through
both path-based and inline-content tools, rejects obvious inline secret shapes,
surfaces the result in the public workbench, and tracks both proof manifests in
submission evidence. Residual MCP risk remains external-client storytelling and
live client capture: this proves the protocol surface locally, but a public
Claude/Cursor/client walkthrough would still improve judge perception.

Move 113 reduces both MCP-category thin-surface risk and hosted-model/SAIA
proof risk by adding `splunkready_check_hosted_model_access` to the MCP server.
The tool reuses the hosted-model diagnostic workflow and returns
`PASS`/`BLOCKED`, permission status, required/available/missing SAIA tools,
artifacts, and `mutation=false`. The public MCP proof calls it in fixture mode
so judge-facing evidence is credential-free, while live mode remains available
for an operator shell with exported Splunk MCP and SAIA environment variables.
Residual risk remains live hosted-model proof: this process did not have the
token-bearing environment exported, so no live SAIA PASS claim was made.

Move 114 reduces live SAIA proof usability risk by allowing hosted-model proof
commands to load operator-owned live variables from an explicit env file. This
removes the need to source secrets into an agent transcript while preserving
secret-safe artifacts: tests prove the temporary token is not written to
hosted-model proof or diagnostic JSON. Residual risk remains actual live
availability: the operator still needs to run the command with a real ignored
env file or exported variables in a shell that can reach the Splunk MCP
endpoint.

Move 115 reduces MCP-category thin-surface risk by making hosted-model / SAIA
diagnostics discoverable through MCP resources and prompts, not only callable
through a tool. The server now exposes
`splunkready://workflows/hosted-model-diagnostic` and
`splunkready_hosted_model_diagnostic`; the tracked proof reads/fetches both,
then calls `splunkready_check_hosted_model_access`. The public MCP proof now
shows 5 tools, 9 resources, 1 resource template, 6 prompts, and 20 recorded
JSON-RPC requests/responses. Residual risk remains live hosted-model proof and
external-client storytelling: this is credential-free protocol evidence, not a
claim that this shell has real SAIA access.

Move 116 reduces MCP-category external-client risk by adding the package
`splunkready mcp` entrypoint plus Claude Desktop and Cursor client-config
resources. The server now exposes `splunkready://client-config/claude-desktop`
and `splunkready://client-config/cursor`; the tracked proof reads both,
requires them in the MCP composition scorecard, and shows 5 tools, 11
resources, 1 resource template, 6 prompts, and 22 recorded JSON-RPC
requests/responses. Residual MCP risk is now mostly storytelling and release
timing: the existing npm `splunkready@0.1.0` package does not include this
entrypoint until a later publish, and a public Claude/Cursor/client capture
would still improve judge perception.

Move 117 reduces live SAIA ambiguity by running the operator-owned live
hosted-model diagnostic through the ignored env file and improving the blocked
classification from the observed result. The current setup has live variables
set and advertises both `saia_explain_spl` and `saia_optimize_spl`, but
invoking `saia_explain_spl` returns not found, so the diagnostic is honestly
`BLOCKED`, `mutation=false`, and not a live hosted-model PASS. The product now
distinguishes this endpoint/tool-route failure from a generic permission
failure and gives route/app-version remediation steps. Residual hosted-model
risk remains live endpoint readiness: the MCP endpoint must actually invoke the
advertised SAIA tools before this track can claim live SAIA proof.

Move 118 reduces package/MCP release risk by making the installability audit
prove the packed tarball can run both `npx splunkready judge-proof` and
`npx splunkready mcp` from a clean temp project. The MCP smoke sends a real
JSON-RPC `initialize` request over stdio and requires the installed server to
identify as SplunkReady with the expected protocol version and deterministic
readiness instructions. Residual risk remains registry timing: the current
published npm version must be republished after Move 116+ before public
`@latest` installs are guaranteed to expose the MCP entrypoint.

Move 119 reduces hosted-model and MCP-category thinness risk by expanding
SplunkReady's SAIA proof from the old two-tool explain/optimize assumption to
the four-tool Splunk MCP AI Assistant surface: generate, explain, optimize, and
ask. The public MCP proof now shows hosted-model access PASS, permission OK,
mutation=false, and all four SAIA tools required/available while still treating
SAIA output as advisory and never executing generated or optimized SPL.
Playwright caught the stale UI enum that would have broken the public MCP proof
route, and the fixed route now loads with zero console errors. Residual risk
remains live endpoint readiness: this is fixture/public proof until the
operator-owned Splunk MCP endpoint can invoke all advertised SAIA tools.

Move 120 reduces live SAIA ambiguity and MCP/hosted-model evidence risk by
recording per-tool hosted-model invocation receipts. Hosted-model proof and
diagnostic artifacts now show `passedTools`, `blockedTools`, and `toolResults`
for `saia_generate_spl`, `saia_explain_spl`, `saia_optimize_spl`, and
`saia_ask_splunk_question`; the SplunkReady MCP tool forwards those fields to
external MCP clients; and the public MCP proof route visibly renders the
per-tool SAIA health. This makes partial live failures actionable instead of a
generic BLOCKED state. Residual risk remains live endpoint readiness: no live
SAIA PASS is claimed until the operator-owned endpoint invokes all four SAIA
tools successfully.

Move 121 reduces live hosted-model setup risk by using the operator-owned env
file path to exercise the live SAIA diagnostic and fix an observed adapter
argument mismatch. `saia_ask_splunk_question` now sends `prompt` to the live
MCP endpoint, matching the observed route requirement, and hosted-model
diagnostic errors redact raw URLs as `[REDACTED_URL]`. The current live endpoint
still blocks all four advertised SAIA tools with route-not-found errors, so
SplunkReady still does not claim live SAIA PASS. Residual risk is outside the
adapter: the Splunk MCP endpoint/app route backing Splunk AI Assistant tools
must invoke the advertised tools successfully before hosted-model proof can be
claimed.

Move 122 reduces public package release skew after the user-published
`splunkready@0.1.0` baseline by preparing the source, docs, claim ledger, and
submission-copy guard for `splunkready@0.1.1`. The packed 0.1.1 tarball installs
from a clean temp project, returns `PASS` for `npx splunkready judge-proof`, and
initializes `npx splunkready mcp`. Residual release risk remains: this shell is
not npm-authenticated, so `npm run audit:npm-release-preflight -- --require-ready`
is `BLOCKED` by npm auth even though the registry reports 0.1.1 is available.
Residual prize risk remains concentrated in live SAIA endpoint readiness and
external MCP-client storytelling rather than package mechanics.

Move 123 reduces hosted-model and MCP evidence ambiguity by adding stable
blocker classes to hosted-model diagnostics and surfacing them through
`splunkready_check_hosted_model_access`, MCP proof summaries, and the public
workbench route. The current live operator-owned endpoint state is now
classified as `SAIA_ROUTE_NOT_FOUND`: all four SAIA tools are advertised, but
invocation returns route-not-found. This protects the product from claiming a
live SAIA pass while making the next remediation target concrete. Residual risk
remains outside SplunkReady's read-only harness: the Splunk MCP endpoint or app
route must actually invoke the advertised SAIA tools before live hosted-model
proof can pass.

Move 124 reduces MCP-category positioning risk by making the proof explicitly
show mission-scoped existing Splunk MCP usage plus Splunk AI Assistant hosted
model coverage. The MCP composition scorecard now includes an official Splunk
MCP tool-coverage check, the public route renders the coverage block, and the
proof records Splunk documentation URLs for tool naming/configuration context.
Residual MCP risk remains external-client storytelling: a real Claude/Cursor
session capture would still be stronger than the credential-free proof session,
and package `0.1.1` must be published before `splunkready@latest mcp` reflects
all current evidence.

Move 125 reduces R019 and the hosted-model portion of the rubric by making SAIA
blockers actionable for MCP clients and operators. `hosted-model-diagnostic.json`
and `splunkready_check_hosted_model_access` now include a public-export-safe
`remediation` packet with blocker class, tool evidence, operator checks, and a
rerun command. This does not resolve the live operator-side
`SAIA_ROUTE_NOT_FOUND` blocker, does not mutate Splunk, and does not make SAIA
authoritative; deterministic SplunkReady rules still decide readiness.

Move 126 reduces public package and MCP copy risk by aligning public commands
with the actual npm registry state. npm latest is still `splunkready@0.1.0`;
that package passes clean temp-folder `judge-proof`, but it does not support the
`mcp` entrypoint. README, Devpost copy, claim ledger, submission-copy audit
guards, and MCP client-config resources now separate the published no-clone
judge-proof path from current-source MCP client setup. Residual risk remains
until an npm-authenticated publish makes the current source MCP entrypoint
available through `splunkready@latest`.

Move 127 reduces live SAIA and MCP-category risk by supporting a dedicated
SAIA/cloud MCP endpoint for hosted-model calls. Core Splunk MCP calls still use
the existing Splunk endpoint/token, while `saia_*` calls can route through
`SPLUNKREADY_SAIA_ENDPOINT` and `SPLUNKREADY_SAIA_TOKEN` when both are set. The
operator-owned live diagnostic remains blocked because the ignored env file
currently reports those two dedicated SAIA variables as missing, so the run
stays on `shared-splunk-mcp` and returns `SAIA_ROUTE_NOT_FOUND`. Residual risk
is now operational rather than architectural: add the dedicated SAIA endpoint
and token to the ignored env file, or fix the shared MCP endpoint so it can
invoke all four advertised `saia_*` tools.

Move 128 reduces MCP-client usability and SAIA evidence risk by exposing the
dedicated SAIA/cloud route directly in the dual-server, Claude Desktop, and
Cursor MCP client-config resources. The tracked MCP proof and public export now
show `SPLUNKREADY_SAIA_ENDPOINT`, `SPLUNKREADY_SAIA_TOKEN`, and
`splunkready_check_hosted_model_access` in client-discoverable resources, and
the submission-copy audit fails if that claim disappears from the claim ledger.
Residual risk remains live connectivity: this proves the wiring and public
evidence path, not a live hosted-model PASS against the operator-owned SAIA
endpoint.

Move 129 reduces live SAIA setup friction by accepting
`SPLUNKREADY_SAIA_MCP_URL` and `SPLUNKREADY_SAIA_MCP_TOKEN` as aliases for the
canonical dedicated SAIA endpoint/token variables. Diagnostics now record alias
names and `sourceName` without writing values, and CLI env-file tests prove the
alias path routes `saia_*` calls to the dedicated mock endpoint. The current
operator-owned env file still reports both canonical and alias SAIA variables
as missing, so the live diagnostic remains `SAIA_ROUTE_NOT_FOUND` on the shared
Splunk MCP endpoint. Residual risk is operator configuration, not deterministic
grading or fixture/live parity.

Move 130 reduces MCP-category external-client risk by replacing generic
existing-Splunk-MCP command placeholders with a concrete `npx -y mcp-remote`
template in the dual-server, Claude Desktop, and Cursor client-config
resources. The generated proof and public export now show
`${SPLUNKREADY_SPLUNK_MCP_URL}` and
`Authorization: Bearer ${SPLUNKREADY_SPLUNK_MCP_TOKEN}` placeholders beside the
source-clone SplunkReady MCP entrypoint. Residual risk remains registry timing:
until npm latest includes the current MCP entrypoint, SplunkReady's side of the
external client config must stay source-clone `npm run mcp`.

Move 131 reduces live SAIA setup and MCP-category routing risk by accepting
common SAIA/cloud MCP endpoint aliases and optional realm/tenant headers for
dedicated hosted-model calls. Core `splunk_*` calls still use the core Splunk
MCP endpoint; only `saia_*` calls receive dedicated SAIA endpoint/token/header
configuration. The public MCP proof resources now expose the supported aliases,
and Playwright verified the exported MCP proof JSON. Residual live risk remains:
the ignored operator env file still reports every supported dedicated SAIA
endpoint/token name as missing, so live hosted-model diagnostic remains
`SAIA_ROUTE_NOT_FOUND` on `shared-splunk-mcp`. This move does not mutate Splunk
and does not make SAIA authoritative.

Move 132 reduces public-package overclaiming risk by adding a registry-backed
currentness proof. The public npm package still reports only
`splunkready@0.1.0`, which passes no-clone `judge-proof` with `mutation=false`
but does not expose the `splunkready mcp` entrypoint. Current-source MCP/SAIA
work remains verified locally and through packed-source installability, not via
`splunkready@latest`, until npm reports the current source version and
`npm run audit:public-package-currentness -- --require-current` returns
`CURRENT`.

Move 133 reduces live SAIA diagnostic ambiguity by separating local Splunk AI
Assistant REST-handler registration from downstream SAIA cloud hosted-model
404s. The operator-owned live diagnostic now proves the local
`Splunk_AI_Assistant_Cloud` namespace and `/generatespl`, `/explainspl`,
`/optimizespl`, and `/tellme` routes are served by splunkd, then classifies the
remaining hosted-model invocation failure as `SAIA_CLOUD_ROUTE_NOT_FOUND`.
Residual risk remains external to SplunkReady: the configured SAIA cloud tenant
or cloud-connect activation must expose the SAIA v2 SPL hosted-model endpoints
before the four `saia_*` tools can return advisory output. This move does not
mutate Splunk and does not make SAIA authoritative for readiness.

Move 134 reduces MCP proof overclaiming risk by embedding the redacted
operator-live hosted-model status into the credential-free MCP proof. The MCP
proof now clearly separates fixture hosted-model `PASS` evidence from the
current operator-live `SAIA_CLOUD_ROUTE_NOT_FOUND` blocker, including local route
probe `PASS`, all four advertised `saia_*` tools, all four blocked live tools,
`mutation=false`, and `safeForPublicExport=true`. Residual risk remains
external to SplunkReady: the live SAIA/cloud hosted-model route must be fixed
before the operator-live status can become `PASS`, and npm latest must still be
updated before judges can run all current MCP/SAIA source work from
`splunkready@latest`.

Move 136 reduces judge-facing Runs UI risk by moving the selected run trace
preview above audit/manifest detail, rendering trace phases side by side at
desktop width, and making preview event labels phase-scoped (`B01`, `A01`,
`E01`, `I01`) instead of repeated numeric labels. Playwright verified the live
workbench Runs route at desktop and mobile widths with no trace preview
overflow. Residual risk remains public-package currentness: npm latest is still
`splunkready@0.1.0`, so judges do not receive current MCP/SAIA source work from
`splunkready@latest` until an npm-authenticated publish of `0.1.1` completes.

Move 137 reduces live SAIA diagnostic ambiguity by aligning the local REST
handler probe with the current `saia_ask_splunk_question` route shape. The
operator-owned diagnostic now probes `/ask` rather than stale `/tellme`
evidence. Current live result remains `BLOCKED`, `mutation=false`: the SAIA
namespace and generate/explain/optimize handlers are served by splunkd, but the
canonical `/ask` route returns 404, so SplunkReady reports
`SAIA_REST_HANDLERS_NOT_REGISTERED`. Residual risk remains external to the
deterministic compiler: the local Splunk AI Assistant app or MCP tool routing
must serve the ask handler, or a dedicated SAIA MCP endpoint/token must be
provided, before SplunkReady can claim live hosted-model PASS.

Move 138 reduces hosted-demo staleness risk by adding source-commit provenance
to `public-demo-manifest.json` and a network audit that compares the hosted
manifest plus asset names against the latest public-demo input commit. The
baseline hosted GitHub Pages URL is currently `STALE` only because the deployed
manifest predates the new `sourceCommit` field; hosted and local assets match.
Residual risk remains until the Pages workflow is rerun from the new head and
`npm run audit:hosted-demo-currentness -- --require-current` returns
`CURRENT`.

Move 139 closes the hosted-demo staleness evidence gap by tracking the
post-deploy `CURRENT` audit result in the submission evidence pack and guarding
the claim ledger through `audit:submission-copy`. The GitHub Pages demo now has
tracked source commit evidence for `22777f3`, matching hosted/local asset names,
and `mutation=false`. Residual risk remains public-package currentness: npm
latest still reports `splunkready@0.1.0`, so judges do not get current
source-side MCP/SAIA work from `splunkready@latest` until an
npm-authenticated publish of `0.1.1` completes.

Move 140 reduces external MCP-client positioning risk by adding Antigravity and
Zed client-config resources alongside the older Claude Desktop/Cursor templates.
The proof now exercises both resources through the raw MCP stdio client session
and requires them for MCP composition PASS. Residual risk remains practical:
these are credential-free templates, not a recorded live Antigravity or Zed
agent session, and the public package still needs the current `mcp` entrypoint
published before judges can use `splunkready@latest mcp`. Because this move
changes public-demo input paths, the hosted-demo currentness evidence must be
refreshed after the Pages workflow redeploys this commit.

Move 141 closes the hosted-demo currentness gap introduced by Move 140. The
Public Demo Pages workflow redeployed commit `5b44c3b`, and the tracked
currentness audit reports `CURRENT`, matching hosted/local asset names and
`mutation=false`. Residual risk remains public-package currentness:
`splunkready@latest` still needs to publish the current source version before
the no-clone package path exposes the current MCP entrypoint and client-config
resources.

Move 142 closes the public-package currentness blocker for the current source
version. npm latest now reports `splunkready@0.1.1`; a clean temp-folder
`npx -y splunkready@0.1.1 judge-proof --out ./judge-proof --json` smoke returns
`PASS`; and the public-package currentness audit reports published `judge-proof`
`PASS`, published `mcp` `PASS`, `initialized=true`, `CURRENT`, and
`mutation=false`. Residual risk remains practical rather than registry-related:
new source changes after Move 142 must either be published or described as
source-only until the next npm currentness audit passes.

Move 143 reduces MCP-category thinness risk by making composition review a
first-class read-only MCP tool instead of only a generated scorecard. The
credential-free MCP proof now calls `splunkready_review_mcp_composition`,
requires it for PASS, and records `mcpCompositionReview.score: 100` with
captured Splunk MCP tool names, saved-search evidence refs, deterministic
authority, and `mutation=false`. Residual risk remains experiential: this proves
the JSON-RPC and evidence path, but it is still not a recorded live external
client session; that screencast remains intentionally parked unless the user
chooses to produce it later.

Move 144 closes the hosted-demo staleness introduced by Move 143. GitHub Pages
now serves public-demo input commit `97d59f4`; hosted/local asset names match;
the tracked currentness audit reports `CURRENT`, `mutation=false`, and no
failures. Residual risk remains release alignment: source-only changes after
Move 143 are not yet published to npm, so package currentness should be rerun or
the next package version should be published if judges need the new MCP review
tool through `npx splunkready@latest mcp`.

Move 145 closes that release-alignment risk for the MCP composition-review tool.
npm latest now points at `splunkready@0.1.2`; the published package passes
clean no-clone `judge-proof`, initializes `mcp`, and `tools/list` exposes
`splunkready_review_mcp_composition`. Residual risk shifts to future source
changes: any new post-145 code must either be published in a later package or
kept out of public `npx @latest` claims until currentness is reverified.

Move 146 reduces planning drift risk by converting the latest ambitious audit
into a tracked move checklist before implementation. The real external
MCP-client recording remains on the plan but is parked behind product surfaces
that do not depend on a closed desktop app: mock live Splunk MCP, receipt-chain
verification, interactive hosted certification, and signed policy registry.
Residual risk is execution scope: Moves 147-150 are multi-day features, so each
must land in small verified slices without broad speculative rewrites.
