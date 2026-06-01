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

