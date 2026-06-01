# Domain Glossary

## SplunkReady

The product. A certification harness for AI agents connected to Splunk.

## Agent Readiness Compiler

The engine that compiles environment facts into contracts, missions, policies, and receipt inputs.

## Environment Contract

A machine-readable description of a specific Splunk deployment's agent-relevant facts.

Includes indexes, sourcetypes, fields, knowledge objects, saved searches, app contexts, budgets, and evidence rules.

## Mission

A structured operational task used to evaluate an agent.

A mission is not just a prompt. It includes expected tools, forbidden patterns, required evidence, and deterministic checks.

## Specimen Agent

The real but naive agent being evaluated.

It must fail naturally before receiving the environment contract and policy patch.

## Trace Event

A structured record of one agent action, usually a tool call or final answer.

Every grade must connect back to trace events.

## Violation

A deterministic finding produced by a grader rule.

Violations include severity, rule id, evidence, and suggested patch.

## Readiness Receipt

The enterprise artifact that summarizes verdict, score, violations, evidence, trace refs, and rerun comparison.

## Policy Patch

An exported set of agent instructions/tool policies generated from observed failures.

It patches agent behavior, not Splunk.

## Fixture Mode

Reproducible mode using seeded MCP responses and trace data.

## Live Mode

Real Splunk MCP mode using the same adapter interface and schemas as fixture mode.

## Deterministic Grader

Rule engine that checks contract, mission, trace, and final answer structure without relying on an LLM for pass/fail.

