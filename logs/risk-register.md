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
