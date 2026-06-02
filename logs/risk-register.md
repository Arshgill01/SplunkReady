# Risk Register

## Active Risks

### R001 LLM-Judging-LLM Drift

Risk: grader becomes vague AI scoring.

Mitigation: deterministic checks decide pass/fail; LLMs explain and patch.

### R002 Fake Specimen Agent

Risk: demo agent is scripted to fail/pass.

Mitigation: bundled deterministic specimen is labeled honestly; external trace grading exists; next product wave should add a real LLM/MCP trace runner and preserve canonical traces.

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
