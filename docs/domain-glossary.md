# Domain Glossary

## SplunkReady

The product. A certification harness for AI agents connected to Splunk.

## Agent Readiness Compiler

The engine that compiles environment facts into contracts, missions, policies, and receipt inputs.

## Environment Contract

A machine-readable description of one Splunk deployment's agent-relevant facts.

Schema name: `EnvironmentContract`.

It includes indexes, restricted indexes, sourcetypes, canonical fields, macros, lookups, saved searches, dashboard panels, data models, app contexts, MCP tools, query budgets, and evidence rules. The compiler, mission runner, grader, receipt generator, and policy patch exporter consume this contract without knowing whether the facts came from fixture mode or live mode.

## Mission

A structured operational task used to evaluate an agent.

Schema name: `Mission`.

A mission is not just a prompt. It includes expected tools, allowed tools, forbidden patterns, required evidence, deterministic checks, and severity weights.

## Specimen Agent

The real but naive agent being evaluated.

It must fail naturally before receiving the environment contract and policy patch.

## Trace Event

A structured record of one agent action, usually a tool call or final answer.

Schema name: `TraceEvent`.

Every grade must connect back to trace events. Trace events carry tool names, tool inputs, output summaries, query references, time windows, result counts, evidence refs, and errors.

## Violation

A deterministic finding produced by a grader rule.

Schema name: `Violation`.

Violations include severity, rule id, reason, evidence, trace-event reference, and suggested policy patch. Rule IDs come from `docs/grader-rule-catalog.md`.

## Readiness Receipt

The enterprise artifact that summarizes verdict, score, violations, evidence, trace refs, and rerun comparison.

Schema name: `ReadinessReceipt`.

The receipt must disclose fixture or live mode and link critical violations to trace events.

## Policy Patch

An exported set of agent instructions/tool policies generated from observed failures.

It patches agent behavior, not Splunk. SplunkReady exports the patch for review and never auto-mutates Splunk.

## Fixture Mode

Reproducible mode using seeded MCP responses and trace data.

Fixture mode exists for deterministic development, tests, and demos. It must use the same internal adapter interface as live mode after the adapter boundary.

## Live Mode

Real Splunk MCP mode using the same adapter interface and schemas as fixture mode.

Live mode is opt-in, read-only, and safe to disable. Normal fixture tests must not require live Splunk credentials.

## Fixture Adapter

Adapter implementation that satisfies the shared Splunk access interface by returning seeded indexes, sourcetypes, knowledge objects, query results, and saved-search results.

The fixture adapter may fake transport and data, but it must not fake grader decisions, specimen-agent behavior, receipt evidence, or a separate downstream code path.

## Live Adapter

Adapter implementation that satisfies the same Splunk access interface by calling live Splunk MCP tools.

The live adapter normalizes live MCP responses into the same result shapes as the fixture adapter and must preserve read-only operation.

## Deterministic Grader

Rule engine that checks contract, mission, trace, and final answer structure without relying on an LLM for pass/fail.
