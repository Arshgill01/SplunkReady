# Product Brief

## Product

SplunkReady

## Tagline

Certify AI agents before they touch production Splunk.

## Core Insight

Splunk MCP makes it easier for AI agents to call Splunk tools. That does not mean the agent understands a customer's Splunk deployment.

SplunkReady answers the deployment-specific trust question:

> This agent can call Splunk. But can it be trusted here?

## User

Primary users:

- platform teams shipping Splunk-connected agents;
- Splunk admins validating agent behavior;
- security engineering teams proving investigation agents are bounded and evidence-grounded;
- solutions engineers demonstrating trustworthy agent adoption.

## Problem

Agents can sound confident after bad tool use:

- hallucinated fields;
- broad `index=*` searches;
- ignored saved searches;
- wrong app context;
- unsupported final conclusions;
- unsafe use of retrieved log text as instruction;
- missing evidence provenance.

Existing Splunk surfaces can provide tool access, telemetry, rate limits, security triage, detection health, and detection testing. The missing product boundary is pre-production certification against the exact environment.

## Product Promise

SplunkReady compiles a live or fixture Splunk environment into a contract, evaluates an agent against realistic missions, grades its MCP trace deterministically, and produces a Readiness Receipt.

## Demo Promise

The demo shows an agent confidently saying "no evidence of lateral movement." SplunkReady proves the answer is unsafe, exports a policy patch, reruns the same agent, and produces a ready verdict with trace evidence.

## What This Is Not

- Not a chatbot.
- Not a SOC copilot.
- Not a detection-health dashboard.
- Not MCP telemetry.
- Not a generic eval harness.
- Not attack replay by itself.
- Not LLM-judging-LLM scoring.

## Success Criteria

- Judges understand the reframe in one sentence.
- The failing agent failure is plausible.
- The grader's reasons are deterministic and inspectable.
- The receipt looks enterprise-real.
- The repository proves fixture mode is reproducible.
- Live mode exists as a credible path, not a demo dependency.

