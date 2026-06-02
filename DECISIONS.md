# Decisions

This file records locked decisions. Future changes must append an ADR-style entry.

## D001 Product Name

Decision: use `SplunkReady`.

Reason: it directly expresses the core question: is this agent ready for this Splunk deployment?

Consequence: docs and UI should use `SplunkReady`; `Agent Readiness Compiler` is the engine, not the public product name.

## D002 Track Strategy

Decision: submit under Platform & Developer Experience.

Reason: SplunkReady is infrastructure for safely shipping Splunk-connected agents. Security is the demo story, not the category.

Consequence: do not let the project become a SOC copilot.

## D003 Fixture First, Live Second

Decision: implement fixture mode before live MCP mode.

Reason: the demo must be reproducible and testable. Live mode proves credibility after the core contracts are stable.

Consequence: all core schemas must be shared by both modes.

## D004 Deterministic Grader

Decision: pass/fail grading must be deterministic wherever possible.

Reason: LLM-judging-LLM credibility risk is one of the main ways this project could become slop.

Consequence: LLMs explain and patch; rule checks decide.

## D005 Real Naive Specimen Agent

Decision: the demo agent must be real but naive.

Reason: scripted failure/pass behavior would make the demo dishonest.

Consequence: the agent should naturally fail without environment contract and improve after policy injection.

## D006 No Splunk Auto-Mutation

Decision: SplunkReady exports patches and policies; it does not modify Splunk.

Reason: human-in-the-loop trust is part of the enterprise argument.

Consequence: no write actions against Splunk in the core demo.

## D007 Receipt Is The Product Artifact

Decision: the Readiness Receipt is more important than a dashboard.

Reason: judges remember artifacts that look enterprise-real.

Consequence: UI must show receipt provenance, not just a score.

## D008 Real LLM Specimen

Decision: Phase Live certifies a Gemini-backed LLM specimen agent when `SPLUNKREADY_LLM_ENABLED=true`; the deterministic naive specimen remains as the fixture fallback.

Reason: SplunkReady needs to prove it can grade a real agent deciding which Splunk MCP tools to call, not just scripted TypeScript behavior.

Consequence: the LLM is the graded subject, never the pass/fail judge. Deterministic rules still decide Readiness Receipt verdicts.

## D009 Live Mode Required For Flagship Proof

Decision: the flagship security proof is the strict `live-security-proof` path against live Splunk MCP, with operator-owned setup and no SplunkReady mutation.

Reason: generic fixture proof and `_internal` fallback proof are useful, but the flagship story must show live security readiness with saved-search evidence.

Consequence: current source-of-truth live evidence is `artifacts/live-security-proof`: before `NOT READY`, after `READY`, `failToPass: true`, `mutation: false`. These local artifacts remain untracked unless a redacted artifact set is explicitly requested.

## D010 SAIA Tools Activated But Non-Authoritative

Decision: `saia_explain_spl` and `saia_optimize_spl` are integrated as hosted-model assistance for SPL-rule violations and surfaced in policy/UI artifacts when available.

Reason: hosted-model output is useful developer evidence for why a query is unsafe and how it might be improved.

Consequence: SAIA output may explain or suggest SPL, but it does not decide readiness. Live hosted-model proof can remain blocked if the MCP identity lacks SAIA entitlement; that does not invalidate the live security proof.

## D011 UI Promoted To Artifact App

Decision: the primary UI is now a standalone Vite artifact app; the generated HTML shell remains a fallback compatibility artifact.

Reason: developers and judges need to inspect receipts, traces, live proof summaries, security readiness, hosted-model status, and local proof bundles without reading raw JSON.

Consequence: the UI must stay receipt/proof-led rather than becoming a chatbot, SOC copilot, generic dashboard, or agent telemetry console.
