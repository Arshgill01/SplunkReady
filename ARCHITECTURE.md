# Architecture

## System Shape

SplunkReady has five core runtime surfaces:

1. MCP adapter
2. Environment Contract Compiler
3. Mission Runner
4. Trace Recorder and Deterministic Grader
5. Readiness Receipt and Policy Patch generator

The UI and CLI sit on top of these surfaces.

## Data Flow

```text
Splunk MCP / fixture MCP
  -> MCP adapter
  -> environment inventory
  -> environment contract
  -> mission suite
  -> naive agent execution
  -> trace recorder
  -> deterministic grader
  -> violations + score
  -> readiness receipt
  -> policy patch
  -> rerun trace
  -> before/after receipt
```

## Fixture/Live Boundary

Both adapters implement the same behavior:

- list indexes;
- get index metadata;
- get sourcetype metadata;
- get user info;
- get knowledge objects;
- run query;
- run saved search;
- explain or optimize SPL when available.

Fixture mode returns seeded data.

Live mode calls Splunk MCP.

No downstream module should know which mode is active.

## Contract Compiler

The compiler normalizes Splunk environment facts into a contract:

- available resources;
- sensitive resources;
- canonical fields;
- allowed query patterns;
- saved-search preferences;
- app context rules;
- evidence requirements;
- budgets and rate-limit context.

## Mission Runner

Missions are structured tasks with:

- prompt;
- expected tool sequence;
- required evidence;
- forbidden patterns;
- deterministic pass/fail checks.

The runner executes a specimen agent and records tool events.

## Grader

The grader consumes only structured data:

- environment contract;
- mission definition;
- trace events;
- final answer.

It emits violations, scoring inputs, and receipt facts.

LLM calls must not be required for pass/fail decisions.

## Receipt

A receipt must include:

- agent version;
- environment contract version;
- mission suite version;
- verdict;
- score;
- violations;
- supporting trace references;
- policy patch summary;
- rerun comparison.

