# SplunkReady

Certify AI agents before they touch production Splunk.

SplunkReady is a Splunk-native certification harness for teams shipping agents that can call Splunk. It does not answer alerts for the operator. It proves whether a specific agent can safely operate against a specific Splunk deployment.

## One-Sentence Pitch

Splunk is making operational data agent-ready. SplunkReady makes agents Splunk-ready.

## What It Does

The Agent Readiness Compiler compiles a fixture or live Splunk environment into an agent contract, runs realistic missions, grades the resulting tool trace with deterministic rules, and produces a Readiness Receipt.

The flagship demo story is security investigation readiness: a naive Splunk MCP agent confidently clears possible lateral movement after using `index=*`, a stale field, and no saved search provenance. SplunkReady catches the unsafe trace, exports a reviewable policy patch, reruns the same mission, and shows a bounded pass with evidence.

## Submission Strategy

SplunkReady targets the Platform & Developer Experience track. The product story is infrastructure for safer Splunk-connected agents, with security as the memorable demo scenario.

## What It Is Not

- Not a Splunk chatbot.
- Not a SOC copilot.
- Not MCP telemetry.
- Not a detection-health dashboard.
- Not a generic eval harness.
- Not an LLM judging another LLM.

## Primary Artifact

The Readiness Receipt is the product artifact. It records the environment contract version, mission suite version, trace evidence, deterministic violations, score, verdict, and policy patch summary.
