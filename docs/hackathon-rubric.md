# Splunk Agentic Ops Hackathon Rubric

Checked: 2026-06-05

Sources:

- Official rules: https://splunk.devpost.com/rules
- Challenge overview: https://splunk.devpost.com/
- Splunk announcement: https://www.splunk.com/en_us/blog/artificial-intelligence/splunk-agentic-ops-hackathon.html

## Submission Track

SplunkReady targets Platform & Developer Experience.

Official track framing: build solutions that enhance developer experience,
automate workflows, or simplify how applications interact with Splunk data and
APIs.

Engineering implication:

- Prioritize low-friction install, CI gating, local workbench clarity, public
  repository readiness, architecture clarity, and developer workflow fit.
- Security remains the flagship scenario, but the category argument is that
  SplunkReady helps teams safely ship Splunk-connected agents.

## Stage One Gate

The first judging stage is pass/fail viability: the project must fit the
hackathon theme and reasonably apply the required APIs or SDKs featured in the
hackathon.

Engineering implication:

- SplunkReady must keep Splunk MCP usage concrete and visible.
- Fixture-only certification is useful for reproducibility, but prize confidence
  depends on showing the Splunk MCP boundary clearly in docs, commands, tests,
  and optional live proof.

## Stage Two Criteria

Official Stage Two criteria are equally weighted:

- Technological Implementation: quality software development.
- Design: well thought out user experience and design.
- Potential Impact: size of the project's possible impact.
- Quality of the Idea: creativity and uniqueness.

Engineering implication:

- Technical implementation: continue reducing CLI monolith debt, keep canonical
  gates green, preserve schema-validated artifacts, and avoid hidden live or
  secret assumptions.
- Design: keep the workbench evidence-led, not overloaded; every visible claim
  should map to contract, trace, violation, receipt, or proof audit data.
- Potential impact: frame SplunkReady as the missing readiness gate between
  "an agent can call Splunk" and "this agent is safe for this deployment."
- Quality of idea: emphasize deterministic Readiness Receipts for
  Splunk-connected agents instead of chatbot or dashboard behavior.

## Required Submission Evidence

The official rules require, among other items:

- A project that can be installed and run consistently on its intended platform.
- A demo video under three minutes that shows the project functioning,
  demonstrates AI use, explains the problem, and highlights value.
- A public code repository with source code, assets, instructions, dependencies,
  and example configurations or datasets where applicable.
- A root architecture diagram named `architecture_diagram.(md|pdf|png)` showing
  Splunk interaction, AI model or agent integration, and data flow.

Engineering implication:

- `architecture_diagram.md`, `README.md`, `LICENSE`, and reproducible commands
  are part of the engineering gate, not optional narrative.
- The user owns the final video/submission upload; do not claim a public video
  URL or feedback submission until it is actually verified.

## Bonus Prize: Best Use Of Splunk MCP Server

Official bonus framing: this prize rewards the project that most effectively
leverages the Splunk MCP Server to build intelligent, agent-driven experiences.
It emphasizes connecting AI agents to Splunk data and enabling workflows such as
automated investigation, contextual insights, and real-time decision making.
Judges look for creative MCP implementations that orchestrate meaningful actions
across observability, security, platform, and developer use cases.

Engineering implication:

- The strongest MCP story is not "SplunkReady built its own MCP server."
- The strongest MCP story is that SplunkReady certifies behavior produced at the
  Splunk MCP boundary: live Splunk MCP runs, captured Splunk MCP JSON-RPC
  transcripts, and external agent traces become deterministic Readiness
  Receipts.
- The local SplunkReady MCP server should be positioned as a composable
  certification interface for MCP clients, not as a replacement for Splunk MCP
  Server.
- Future MCP moves should improve evidence of Splunk MCP usage: live proof
  packs, transcript capture examples, client configuration examples, and
  workflow receipts that show meaningful investigation actions.

## Bonus Prize: Best Use Of Splunk Developer Tools

Official bonus framing: this prize rewards effective use of Splunk's developer
ecosystem to build a high-quality, scalable, production-ready solution, including
SDKs, App Inspect, and other tools from dev.splunk.com. Judges prioritize clean
architecture, ease of use, and alignment with Splunk platform standards.

Engineering implication:

- The public package/private package gap, hosted demo gap, stale evidence pack,
  and CLI monolith directly lower competitiveness here.
- Keep moving toward clean architecture, easy execution, green CI, and
  verifiable setup paths.

## Bonus Prize: Best Use Of Splunk Hosted Models

Official bonus framing: this prize rewards impactful use of Splunk-hosted AI
models to solve real problems and generate actionable insights.

Engineering implication:

- SAIA/hosted-model output remains advisory only.
- Hosted-model evidence should explain or improve SPL and should be visible in
  policy or proof artifacts, but deterministic rules still decide readiness.

## Current Priority Consequences

High-leverage moves after this rubric capture:

1. Keep modularizing `src/cli.ts` where workflow modules still import the CLI.
2. Strengthen Splunk MCP Server evidence through live/captured transcript proof,
   not by expanding SplunkReady into a Splunk copilot.
3. Keep LLM use visible as trace production and advisory explanation, while
   deterministic grading remains authoritative.
4. Refresh the evidence pack and public judge path after core development
   stabilizes.
