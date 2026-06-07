# SplunkReady Development Moves

Prepared: 2026-06-04

This is the revised, code-focused execution plan for SplunkReady. It keeps the
correctness findings from the review, but it no longer treats submission
paperwork as first-class engineering work. The product needs a real operator
workbench: a local backend, executable UI workflows, live proof actions, artifact
management, and enough CLI extraction to make that safe.

## Operating Thesis

SplunkReady should demo as an **interactive certification workbench**, not as a
static reader wrapped around a CLI. The UI must be able to start a fixture
certification, watch the fail-to-pass loop, inspect receipts, run server-env live
checks, certify external traces, and browse proof bundles.

The backend remains local and operator-owned. It may read server-side env vars
for live mode. The browser must not submit Splunk tokens, Gemini keys, arbitrary
commands, or filesystem paths.

## Priority Map

| Priority | Move | Estimate | Why |
|---|---|---:|---|
| P0 | [01](moves01.md) Fail closed on missing rules | 0.5-1d | Certification cannot silently skip checks. |
| P0 | [02](moves02.md) Implement missing activated rules | 1.5-3d | Catalog must match runtime. |
| P0 | [03](moves03.md) Fixture/live parity and fixture drift | 0.5-1d | Trust boundary must hold. |
| P0 | [04](moves04.md) Workflow extraction | 1-2d | Backend/UI need reusable orchestration. |
| P0 | [05](moves05.md) Local workbench backend | 1-2d | Turns UI from reader into app. |
| P0 | [06](moves06.md) Job runner and artifact store | 1-2d | Makes executions observable and safe. |
| P0 | [07](moves07.md) Executable fixture certification UI | 1.5-2.5d | Demo-critical interactive fail-to-pass loop. |
| P1 | [08](moves08.md) Live readiness/proof actions | 1-2d | Shows real Splunk MCP from UI without browser secrets. |
| P1 | [09](moves09.md) SAIA hosted-model workflow | 0.5-1d | Conditional but valuable. |
| P1 | [10](moves10.md) External trace and transcript certification UI | 1-2d | Platform & DevEx story. |
| P1 | [11](moves11.md) Proof bundle browser and comparison | 1-2d | Makes receipts and audits inspectable. |
| P1 | [12](moves12.md) Policy patch and firewall workbench | 1-2d | Shows how failures become safer reruns. |
| P1 | [13](moves13.md) Live security kit UX, no mutation | 0.5-1d | Reduces live demo friction safely. |
| P1 | [14](moves14.md) Certification index from the workbench | 0.5-1d | Multi-proof ledger visible in UI. |
| P2 | [15](moves15.md) CLI modularization around reused workflows | 1-2d | Shrinks monolith where it matters. |
| P2 | [16](moves16.md) Browser and API test harness | 1-2d | Prevents regressions in the new app surface. |
| P2 | [17](moves17.md) Canonical verification gate | 0.5-1d | Keeps fast-moving work honest. |
| P2 | [18](moves18.md) Dependency advisory cleanup | 0.5d | Removes critical dev audit result. |
| P2 | [19](moves19.md) Public proof export | 0.5-1d | Lets UI emit sanitized bundles. |
| P3 | [20](moves20.md) Workbench packaging and run command | 0.5-1d | One command to launch the real demo app. |
| P0 | [21](moves21.md) Submission evidence pack | 0.5-1d | Produces tracked proof judges can inspect. |
| P0 | [22](moves22.md) README, Devpost, and root architecture | 0.5-1d | Makes public claims match evidence. |
| P0 | [23](moves23.md) Public demo video and feedback form | 0.5-1d | Required submission artifacts stay accountable. |
| P0 | [24](moves24.md) Clean-room submission gate | 0.5d | Final judge-path verification. |
| P0 | [25](moves25.md) Consolidate workbench UI surface | 0.5d | Keeps the final judge path clear without hiding proof instrumentation. |
| P0 | [26](moves26.md) Remote clean-room gate and cleanup backlog | 0.5d | Proves the pushed branch works from a fresh clone and records final cleanup work. |
| P0 | [27](moves27.md) Run browser module boundary | 0.5d | Keeps the Runs proof-browser maintainable while preserving live UI evidence. |
| P0 | [28](moves28.md) Browser health path privacy | 0.5d | Prevents browser-visible workbench health from exposing local filesystem paths. |
| P0 | [29](moves29.md) Workbench route error redaction | 0.5d | Applies the same secret redaction boundary to route-level API failures. |
| P0 | [30](moves30.md) Workbench response security headers | 0.5d | Adds conservative browser hardening headers to local API and UI responses. |
| P0 | [31](moves31.md) Workbench server fallback redaction | 0.5d | Redacts server-level fallback errors before they reach the browser. |
| P0 | [32](moves32.md) Workbench no-store responses | 0.5d | Prevents browser caching of local proof and workbench responses. |
| P0 | [33](moves33.md) Runs trace preview timeline | 0.5d | Makes the Runs trace panel show compact ordered events instead of summary-only cards. |
| P0 | [34](moves34.md) SplunkReady secret env ignore | 0.5d | Ensures `.splunkready*` local secret files are ignored by default. |
| P0 | [35](moves35.md) Secret env ignore gate | 0.5d | Adds the `.splunkready*` and `.env*` ignore boundary to the canonical check. |
| P0 | [36](moves36.md) Local artifact base guard | 0.5d | Keeps browser artifact loading on local paths even if query parameters or manifests provide URL-like bases. |
| P0 | [37](moves37.md) Workbench cross-site API guard | 0.5d | Rejects browser-marked cross-site requests before they can start local workbench workflows. |
| P0 | [38](moves38.md) Isolated workbench job snapshots | 0.5d | Keeps public job reads from exposing mutable runner-owned job state. |
| P0 | [39](moves39.md) Atomic workbench job limit | 0.5d | Reserves a job slot before async run allocation so concurrent starts cannot exceed the configured limit. |
| P0 | [40](moves40.md) Artifact symlink read guard | 0.5d | Keeps managed artifact reads from following symlinks out of a run directory. |
| P0 | [41](moves41.md) Agent trace bridge | 0.5d | Reduces native-agent integration friction without adding framework dependencies or weakening deterministic grading. |
| P0 | [42](moves42.md) SplunkReady MCP server | 0.5d | Exposes the Agent Readiness Compiler as local MCP certification tools without turning SplunkReady into a Splunk copilot. |
| P0 | [43](moves43.md) One-command judge proof | 0.5d | Reduces fresh-clone judge friction by composing suite, firewall, audit, manifest, and index proofs into one command. |
| P0 | [44](moves44.md) Runs trace preview ordering | 0.5d | Repairs scrambled trace timelines in the Runs proof browser and verifies the UI with Playwright. |
| P0 | [45](moves45.md) Callback trace capture | 0.5d | Lets framework callback run IDs map into SplunkReady traces without adding agent-framework dependencies. |
| P0 | [46](moves46.md) MCP server proof command | 0.5d | Makes the local SplunkReady MCP certification server one-command demonstrable without live credentials. |
| P0 | [47](moves47.md) Live security strict readiness contract | 0.5d | Makes fresh-trial live security blockers explicit without downgrading the flagship proof to generic `_internal` evidence. |
| P0 | [48](moves48.md) Composite GitHub Action gate | 0.5d | Turns the credential-free transcript, trace, and judge proof gates into one reusable GitHub Actions step. |
| P0 | [49](moves49.md) GitHub Action job summary | 0.5d | Writes deterministic proof status and artifact links into the GitHub Actions job summary. |
| P0 | [50](moves50.md) Package CLI default asset resolution | 0.5d | Lets a local/package-style `splunkready` command run fixture judge proof from outside the repository root. |
| P0 | [51](moves51.md) Suite compiler diagnostics | 0.5d | Makes deterministic grading visible as compiler evidence with rule activation, resolution, trace refs, and evidence refs. |
| P0 | [52](moves52.md) GitHub Action diagnostics output | 0.5d | Exposes compiler diagnostics/readiness profile paths directly in CI outputs and job summaries. |
| P0 | [53](moves53.md) Runs trace preview layout | 0.5d | Stabilizes the Runs trace preview lanes for long metadata, wrapped findings, and hidden-event rows. |
| P0 | [54](moves54.md) GitHub workflow diagnostics artifact | 0.5d | Updates CI examples to upload the action diagnostics path as a first-class artifact. |
| P0 | [55](moves55.md) Package trace bridge exports | 0.5d | Exposes stable package subpaths and TypeScript declarations for trace bridge, callback capture, and schemas. |
| P0 | [56](moves56.md) Repository CI canonical gate | 0.5d | Adds a credential-free GitHub Actions workflow that runs the canonical `npm run check` gate. |
| P0 | [57](moves57.md) CI verification tool install | 0.5d | Installs ripgrep in GitHub Actions so the scaffold verifier can run on hosted Ubuntu runners. |
| P0 | [58](moves58.md) MCP resources and prompts | 0.5d | Makes the MCP certification server composable with resources, prompts, and proof coverage beyond tool calls. |
| P0 | [59](moves59.md) Workbench CI timeout stabilization | 0.5d | Gives the Vite dev-shell workbench test enough time on hosted GitHub runners without changing product behavior. |
| P0 | [60](moves60.md) LLM specimen proof command | 0.5d | Makes the Gemini-backed trace-producer path one-command visible while keeping deterministic grading authoritative. |
| P0 | [61](moves61.md) LLM proof workflow extraction | 0.5d | Starts the next CLI modularization pass by moving the new LLM proof orchestration into a focused workflow module. |
| P0 | [62](moves62.md) Proof manifest and index workflow extraction | 0.5d | Continues the CLI modularization pass by moving proof manifest, verification, and certification index logic into workflow modules. |
| P0 | [63](moves63.md) External MCP certification workflow extraction | 0.5d | Makes external trace and captured Splunk MCP transcript certification workflow-owned instead of CLI-owned. |
| P0 | [64](moves64.md) Official hackathon rubric grounding | 0.5d | Captures official criteria and corrects MCP award positioning against Splunk MCP Server usage. |
| P0 | [65](moves65.md) Proof audit workflow extraction | 0.5d | Removes the 500+ line proof audit implementation from the CLI and gives it a direct workflow test surface. |
| P0 | [66](moves66.md) Hosted model workflow extraction | 0.5d | Makes SAIA proof and diagnostic workflows module-owned while preserving advisory-only hosted-model authority. |
| P0 | [67](moves67.md) Fixture certification workflow extraction | 0.5d | Makes the workbench fixture certification path workflow-owned instead of CLI-owned and materially shrinks the CLI monolith. |
| P0 | [68](moves68.md) Policy action workflow extraction | 0.5d | Makes policy-backed rerun and firewall-check workflow-owned instead of CLI-owned. |
| P0 | [69](moves69.md) Live action workflow extraction | 0.5d | Removes the final CLI-backed workflow wrapper by making live smoke, candidates, strict readiness, operator kit, and live proof workflow-owned. |
| P0 | [70](moves70.md) MCP boundary proof evidence | 0.5d | Makes `mcp-proof` explicitly prove captured Splunk MCP behavior, not just the local SplunkReady MCP server surface. |
| P0 | [71](moves71.md) Judge proof LLM evidence slot | 0.5d | Makes model-produced trace evidence visible in the judge bundle through an explicit opt-in while keeping deterministic grading authoritative. |
| P0 | [72](moves72.md) Public package publish readiness | 0.5d | Removes the private-package blocker and adds a dry-run package audit without publishing to the registry. |
| P0 | [73](moves73.md) CI Node 24 actions runtime | 0.5d | Uses Node-24-native GitHub Actions while keeping the project runtime on Node 22. |
| P0 | [74](moves74.md) Suite proof workflow extraction | 0.5d | Moves suite proof aggregation and diagnostics out of the CLI monolith into a workflow-owned module. |
| P0 | [75](moves75.md) MCP client certification loop | 0.5d | Makes the MCP proof show an agent-driven Splunk MCP investigation loop that is certified through SplunkReady. |
| P0 | [76](moves76.md) LLM agent workflow extraction | 0.5d | Moves the `llm-agent` trace, grading, scoring, and receipt artifact writes out of the CLI monolith. |
| P0 | [77](moves77.md) CLI orphan helper cleanup | 0.5d | Removes CLI-local helper code made obsolete by prior workflow extractions. |
| P0 | [78](moves78.md) Refreshed submission evidence pack | 0.5d | Refreshes tracked judge-facing evidence with current compiler diagnostics, MCP proof, public export, and Playwright screenshots. |
| P0 | [79](moves79.md) MCP proof workbench view | 0.5d | Makes the MCP proof loop, Splunk MCP boundary, resources, and prompts first-class in the Vite workbench. |
| P0 | [80](moves80.md) MCP proof evidence screenshot | 0.5d | Tracks the Playwright-verified MCP proof workbench view in the judge-facing evidence pack. |
| P0 | [81](moves81.md) Public demo static export | 0.5d | Packages the built Vite workbench and tracked credential-free evidence into a static folder for hosted demo deployment. |
| P0 | [82](moves82.md) Dual MCP client kit | 0.5d | Makes the MCP proof expose a credential-free two-server client kit for existing Splunk MCP plus SplunkReady certification. |
| P0 | [83](moves83.md) Netlify static demo config | 0.5d | Adds Netlify-ready build, publish, redirect, and header configuration for the public demo export. |
| P0 | [84](moves84.md) Package installability audit | 0.5d | Proves the packed npm tarball installs in a clean temp project and runs `npx splunkready judge-proof`. |
| P0 | [85](moves85.md) MCP composition scorecard | 0.5d | Makes the MCP proof grade the composed use of existing Splunk MCP plus SplunkReady certification as a first-class evidence artifact. |
| P0 | [86](moves86.md) CLI option parser extraction | 0.5d | Extracts CLI defaults, usage, option types, and argument parsing out of the command executor. |
| P0 | [87](moves87.md) CLI proof command extraction | 0.5d | Extracts proof-oriented command wrappers out of the root CLI executor while preserving proof behavior. |
| P0 | [88](moves88.md) CLI external command extraction | 0.5d | Extracts external trace, transcript, LLM-agent, and demo command wrappers out of the root CLI executor. |
| P0 | [89](moves89.md) CLI live command extraction | 0.5d | Extracts live-mode command wrappers and live CLI helper exports out of the root CLI executor. |
| P0 | [90](moves90.md) CLI dispatch extraction | 0.5d | Extracts command routing out of the root CLI entrypoint while preserving CLI behavior. |
| P0 | [91](moves91.md) Public demo export gate | 0.5d | Makes the credential-free public demo export a canonical verified artifact. |
| P0 | [92](moves92.md) MCP client walkthrough evidence | 0.5d | Makes the MCP proof show an existing Splunk MCP client workflow before SplunkReady certification. |
| P0 | [93](moves93.md) Judge proof LLM activation | 0.5d | Makes judge proof include model-produced trace evidence when LLM mode is operator-enabled. |
| P0 | [94](moves94.md) NPM release preflight | 0.5d | Makes public npm package readiness and publish blockers machine-checkable without publishing. |
| P0 | [95](moves95.md) GitHub Pages public demo workflow | 0.5d | Adds a manual Pages deployment path for the verified credential-free public demo export without claiming an unverified URL. |
| P0 | [96](moves96.md) GitHub Pages deployment verification | 0.5d | Runs the manual Pages workflow and records whether a public demo URL is actually deployed and browser-verified. |
| P0 | [97](moves97.md) Static hosted demo request hygiene | 0.5d | Removes avoidable static-host 404 noise from the public MCP proof route without weakening local workbench behavior. |
| P0 | [98](moves98.md) GitHub Pages Node 24 actions runtime | 0.5d | Removes the public demo Pages workflow Node 20 warning by moving to current Pages action tags. |
| P0 | [99](moves99.md) Public judge proof LLM evidence surface | 0.5d | Makes hosted public demo exports include credential-free judge proof and visible LLM-evidence authority boundaries. |
| P0 | [100](moves100.md) Published package judge smoke | 0.5d | Converts the completed npm publish into clean-folder npx proof, README/Devpost install copy, and claim-ledger evidence. |
| P0 | [101](moves101.md) Published version release preflight | 0.5d | Makes the npm release preflight report the current published version as verified instead of failing stale availability checks. |
| P0 | [102](moves102.md) Published package submission claim guard | 0.5d | Extends the submission-copy audit so README, Devpost, and claim-ledger npm package claims are machine-checked. |
| P0 | [103](moves103.md) Public judge proof evidence pack | 0.5d | Tracks the Playwright-verified hosted judge-proof view in the judge-facing evidence pack. |
| P0 | [104](moves104.md) Hosted demo public copy guard | 0.5d | Requires the hosted MCP proof and judge-proof routes in public submission copy. |
| P0 | [105](moves105.md) Remote cleanroom after hosted copy | 0.5d | Verifies the pushed branch, hosted routes, evidence pack, and published package from fresh clean-room paths. |
| P0 | [106](moves106.md) Live security public export redaction guard | 0.5d | Proves live-security proof summaries are redacted before public export. |
| P0 | [107](moves107.md) Current handoff refresh | 0.5d | Updates current-state docs after package, hosted demo, cleanroom, and redaction work. |
| P0 | [108](moves108.md) Current goal audit refresh | 0.5d | Refreshes the prompt-to-artifact completion audit without marking the goal complete. |
| P0 | [109](moves109.md) MCP client session evidence | 0.5d | Tracks the actual MCP JSON-RPC client session behind the MCP proof and surfaces it in the public workbench. |
| P0 | [110](moves110.md) SAIA live proof readiness | 0.5d | Makes hosted-model diagnostics produce redacted, reviewable artifacts when live SAIA setup is missing and public-export-safe when present. |
| P0 | [111](moves111.md) MCP resource template proof | 0.5d | Adds MCP resource-template discovery and a templated receipt read to the server, proof session, workbench, and tracked evidence. |
| P0 | [112](moves112.md) Inline MCP transcript certification | 0.5d | Adds a read-only MCP tool that certifies transcript JSONL content directly, with secret rejection and tracked path-vs-inline proof evidence. |
| P0 | [113](moves113.md) MCP hosted model access check | 0.5d | Adds a read-only MCP tool that proves hosted-model SAIA access as advisory evidence and records it in the MCP proof. |
| P0 | [114](moves114.md) Hosted model env file support | 0.5d | Lets hosted-model proof commands load operator-owned live variables from an explicit env file while keeping artifacts secret-safe. |
| P0 | [115](moves115.md) MCP hosted model diagnostic resource | 0.5d | Adds a hosted-model diagnostic MCP resource and prompt so SAIA readiness is discoverable in agent MCP clients, not only callable as a tool. |
| P0 | [116](moves116.md) External MCP client config resources | 0.5d | Adds the package `splunkready mcp` entrypoint plus Claude Desktop and Cursor MCP client-config resources to make the two-server MCP workflow directly client-usable. |
| P0 | [117](moves117.md) Live SAIA not-found diagnostic | 0.5d | Runs the operator-owned live hosted-model diagnostic and tightens blocked-result classification when advertised SAIA tools return not found at invocation time. |
| P0 | [118](moves118.md) Package MCP installability audit | 0.5d | Extends the packed-package installability audit so a clean temp install must pass judge-proof and initialize the `splunkready mcp` stdio server. |
| P0 | [119](moves119.md) Four-tool SAIA hosted-model proof | 0.5d | Expands hosted-model proof from explain/optimize to SAIA generate, explain, optimize, and ask, then regenerates MCP evidence and Playwright-verifies the public route. |
| P0 | [120](moves120.md) Per-tool SAIA hosted-model receipt | 0.5d | Records passed/blocked status for each SAIA hosted-model tool and surfaces it through MCP proof evidence and the public route. |
| P0 | [121](moves121.md) Live SAIA prompt compatibility and redaction | 0.5d | Uses the operator-owned live diagnostic to fix the SAIA ask prompt shape and redact live endpoint URLs from hosted-model diagnostics. |
| P0 | [122](moves122.md) Next package release alignment | 0.5d | Prepares the source, docs, and submission-copy guard for the next public npm version so judges can smoke-test the current MCP/SAIA work after publish. |
| P0 | [123](moves123.md) Hosted-model blocker evidence | 0.5d | Classifies live SAIA hosted-model blockers and surfaces the class through MCP proof evidence and the public workbench route. |
| P0 | [124](moves124.md) Official Splunk MCP tool coverage | 0.5d | Makes the MCP proof explicitly show mission-scoped existing Splunk MCP tool usage plus SAIA hosted-model coverage. |
| P0 | [125](moves125.md) Hosted-model remediation packet | 0.5d | Adds a public-export-safe SAIA remediation packet to CLI diagnostics, MCP tool output, and workbench views. |
| P0 | [126](moves126.md) Published-package copy hygiene | 0.5d | Aligns public package claims and MCP client templates with the actually published `splunkready@0.1.0` package. |
| P0 | [127](moves127.md) Dedicated SAIA MCP routing | 0.5d | Lets live hosted-model proof route `saia_*` calls to a dedicated SAIA/cloud MCP endpoint while keeping core Splunk MCP calls separate. |
| P0 | [128](moves128.md) MCP client config SAIA routing evidence | 0.5d | Exposes dedicated SAIA endpoint/token placeholders through MCP client-config resources, proof evidence, and submission-copy guards. |
| P0 | [129](moves129.md) SAIA MCP env alias readiness | 0.5d | Accepts SAIA MCP URL/token aliases from operator env files and records alias source names without writing secret values. |
| P0 | [130](moves130.md) Splunk MCP remote client config evidence | 0.5d | Makes external MCP client resources use Splunk's `mcp-remote` sample-client shape with credential placeholders. |
| P0 | [131](moves131.md) SAIA cloud MCP alias and header readiness | 0.5d | Supports more realistic SAIA/cloud MCP endpoint aliases and optional realm/tenant headers for hosted-model calls only. |
| P0 | [132](moves132.md) Public package currentness proof | 0.5d | Adds a registry-backed audit that proves the published package judge-proof path and flags when MCP/SAIA source work has not reached npm yet. |
| P0 | [133](moves133.md) SAIA cloud route blocker | 0.5d | Separates local Splunk AI Assistant REST-handler registration failures from downstream SAIA cloud hosted-model 404s. |
| P0 | [134](moves134.md) MCP operator live hosted-model status | 0.5d | Makes MCP proof evidence distinguish fixture hosted-model PASS from the current operator-live SAIA cloud blocker. |
| P0 | [135](moves135.md) Splunk MCP transcript compatibility | 0.5d | Accepts real Splunk MCP transcript field aliases during deterministic transcript certification. |
| P0 | [136](moves136.md) Runs trace preview repair | 0.5d | Makes the Runs detail trace preview visible earlier, phase-scoped, and Playwright-verified across desktop and mobile widths. |
| P0 | [137](moves137.md) SAIA ask route diagnostic alignment | 0.5d | Aligns the hosted-model live route probe with the current `/ask` SAIA handler and keeps the resulting blocker honest. |
| P0 | [138](moves138.md) Hosted demo currentness audit | 0.5d | Adds source-commit tracking and a network audit so GitHub Pages demo staleness is explicit. |
| P0 | [139](moves139.md) Hosted demo currentness evidence | 0.5d | Tracks the current GitHub Pages audit result in the evidence pack and guards the claim ledger against drift. |
| P0 | [140](moves140.md) Antigravity and Zed MCP client configs | 0.5d | Adds non-Claude external-client MCP config resources for Antigravity and Zed and proves them through `mcp-proof`. |
| P0 | [141](moves141.md) Hosted demo currentness refresh | 0.5d | Redeploys the public demo after Move 140 and refreshes tracked currentness evidence for the hosted source commit. |
| P0 | [142](moves142.md) Published package currentness refresh | 0.5d | Verifies `splunkready@0.1.1` is npm latest and refreshes no-clone judge-proof plus MCP currentness evidence. |
| P0 | [143](moves143.md) MCP composition review tool | 0.5d | Makes the two-server Splunk MCP plus SplunkReady MCP composition review a first-class read-only MCP tool and tracked evidence claim. |
| P0 | [144](moves144.md) Hosted demo currentness after MCP review | 0.5d | Redeploys GitHub Pages after the MCP composition-review move and refreshes hosted-demo currentness evidence. |

## Non-Negotiable Boundaries

- Deterministic rules remain authoritative for verdicts and scores.
- LLMs and SAIA may explain, optimize, and advise; they do not grade.
- SplunkReady does not auto-mutate Splunk.
- Browser clients never submit secrets or arbitrary shell commands.
- The backend allowlists workflows; it is not a generic CLI-over-HTTP wrapper.
- Fixture and live mode keep shared internal interfaces.
- Policy patches are proposed additions for review, not hidden auto-application.

## Cut Order

If time gets tight, cut in this order:

1. Move 20 packaging polish.
2. Move 15 broader CLI modularization.
3. Move 14 certification-index UI.
4. Move 13 live-kit UX.
5. Move 12 firewall/policy workbench.
6. Move 09 SAIA if entitlement is blocked.

Do not cut Moves 01-07 or 21-24. Moves 01-07 are the minimum credible
interactive product; Moves 21-24 are the minimum credible submission package.
