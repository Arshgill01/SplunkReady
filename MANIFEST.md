# SplunkReady Scaffold Manifest

Status: implemented through Phase Live and Move 106 on `splunkready-build`: live Splunk MCP proof, Gemini-backed LLM specimen, strict flagship `live-security-proof`, Vite artifact UI, expanded fixtures, external trace SDK example, CI JSON gate, firewall gateway, policy simulator, local proof-bundle selector, MCP resources/prompts/composition proof, published npm package, verified GitHub Pages demo, refreshed submission evidence, remote cleanroom proof, and live-security public-export redaction guard.

This repository turns the locked SplunkReady idea into an implemented certification harness that can grade fixture traces, externally captured traces, and live Splunk MCP LLM-agent traces through the same contracts. The scaffold process remains in force for future continuation waves, but Phase Live decisions in `DECISIONS.md` supersede older fixture-first implementation assumptions where they conflict.

## Product Lock

- Product: SplunkReady
- Tagline: Certify AI agents before they touch production Splunk.
- Engine: Agent Readiness Compiler
- Primary artifact: Readiness Receipt
- Submission track: Platform & Developer Experience
- Flagship demo story: security investigation readiness

## Required Reading Order

1. `AGENTS.md`
2. `PLAN.md`
3. `DECISIONS.md`
4. `ARCHITECTURE.md`
5. `QUALITY-BAR.md`
6. `docs/grader-rule-catalog.md`
7. `docs/fixture-live-parity.md`
8. `docs/golden-traces.md`
9. `docs/demo-script.md`
10. `docs/prompts/README.md`
11. `docs/prompts/main-executor-goal.md`
12. `docs/prompts/reviewer-goal.md`
13. `docs/hackathon-rubric.md`
14. `docs/waves/README.md`
15. Current wave file under `docs/waves/`
16. `logs/reviewer-inbox/README.md`
17. `logs/risk-register.md`

## Directory Map

- `docs/waves/`: wave-by-wave execution plan.
- `docs/waves/WAVE-CONTRACT.md`: global contract every wave must follow.
- `docs/reviewer/`: read-only reviewer loop instructions.
- `docs/schemas/`: canonical schema contracts for implementation.
- `docs/skills/`: local workflow skills future agents should create or follow.
- `docs/stack-recommendation.md`: historical Wave 02 stack recommendation superseded by `docs/stack-decision.md`.
- `docs/verification-matrix.md`: current scaffold and implementation verification evidence.
- `docs/grader-rule-catalog.md`: deterministic rule IDs and pass/fail boundaries.
- `docs/golden-traces.md`: reference failure/pass traces for future tests and demo.
- `docs/fixture-live-parity.md`: fixture/live adapter parity contract.
- `docs/live-proof-gap.md`: current live MCP/Gemini proof status, including the green flagship live security proof.
- `docs/live-demo-data-plan.md`: operator-approved setup and proof paths for live security readiness without SplunkReady mutation.
- `docs/live-setup-checklist.md`: Phase Live checklist for producing the required real Splunk MCP live-smoke proof.
- `docs/hackathon-rubric.md`: official Devpost/Splunk rubric capture used to ground award positioning and future move priority.
- `docs/llm-specimen-agent.md`: env-gated Gemini specimen agent flow for model-produced traces.
- `ui/`: Vite artifact app for inspecting proof bundles, receipts, traces, live security readiness, hosted-model status, and policy simulation.
- `fixtures/acme-soc-dev/adapter-fixture.json`: expanded fixture deployment with security, CloudTrail, network, and platform-latency evidence paths.
- `fixtures/acme-soc-dev/suites/phase-live-readiness-suite.json`: default multi-mission suite manifest consumed by `suite-proof`.
- `docs/follow-up-gap-closure-report.md`: current real/fixture/live truth table and consolidation evidence.
- `docs/preflight-card-ui-implementation-plan.md`: Minimax-derived plan now implemented in the routed Pre-Flight Card replay UI.
- `docs/demo-script.md`: 3-minute final demo script.
- `docs/prompts/`: copy-paste `/goal` prompts for the main executor and reviewer.
- `references/source-grounding-matrix.md`: source evidence for major claims.
- `logs/`: living logs for execution, review, risks, decisions, and verification.
- `logs/reviewer-inbox/`: unique reviewer findings files written by the reviewer loop.
- `references/`: source context and pointers to prior research in `../Splunk/research`.
- `scripts/`: scaffold verification scripts.

## Completion Gate

The implementation is not done until:

- fixture and live modes share the same interfaces;
- deterministic grader covers the core failure modes;
- readiness profiles bind active deterministic rules to concrete Splunk contract facts;
- specimen behavior and external trace intake are represented honestly;
- Readiness Receipt contains trace/evidence provenance;
- demo loop shows fail -> compile -> patch -> rerun -> pass;
- verification commands pass and are logged.
