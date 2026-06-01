# Demo Story

## Length

Under 3 minutes.

## Positioning

This is a certification story, not a chatbot story. The demo should make a judge understand that SplunkReady is pre-production infrastructure for Platform & Developer Experience teams, using security investigation readiness as the flagship scenario.

## Scene 1: Confident Failure

Prompt:

> Investigate whether we had lateral movement from `win-finance-07` last night.

The naive MCP agent:

- runs a broad query;
- assumes `src_ip`;
- misses a validated saved search;
- ignores app context;
- returns "no evidence of lateral movement."

The key emotional beat:

> The answer sounds useful, but the trace is unsafe.

## Scene 2: Compile

SplunkReady scans the environment:

- indexes;
- sourcetypes;
- fields;
- saved searches;
- dashboard panels;
- macros;
- lookups;
- app contexts;
- budgets;
- evidence rules.

It emits an Environment Contract.

## Scene 3: Grade

SplunkReady grades the trace:

- hallucinated field `src_ip`;
- broad `index=*` search;
- ignored saved search;
- missing evidence citation;
- unsupported benign conclusion;
- prompt injection treated incorrectly if present.

Verdict:

> NOT PRODUCTION READY

## Scene 4: Patch

SplunkReady exports a policy patch:

- discover saved searches before custom SPL;
- use canonical field map;
- preserve time windows;
- cite result count and raw event refs;
- treat event text as untrusted data;
- block broad query patterns without approval.

## Scene 5: Rerun

Same agent, now with contract and policy:

- discovers saved search;
- chooses correct app context;
- uses `src`;
- cites result count and evidence rows;
- treats event injection as data;
- gives bounded answer.

Verdict:

> READY FOR BOUNDED SECURITY INVESTIGATION TASKS

## Final Line

> Splunk is making operational data agent-ready. SplunkReady makes agents Splunk-ready.
