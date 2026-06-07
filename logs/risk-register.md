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
the category-winning action by itself.

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
