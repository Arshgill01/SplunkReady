# Fixture and Live Mode Parity

Fixture mode exists so the demo is reproducible. It must not become a separate fake product path.

## Shared Interface Rule

Both modes must implement the same internal adapter interface:

```ts
interface SplunkAccessAdapter {
  getInfo(): Promise<SplunkInfo>;
  getIndexes(): Promise<IndexSummary[]>;
  getMetadata(input: MetadataRequest): Promise<MetadataResult>;
  getKnowledgeObjects(input: KnowledgeObjectRequest): Promise<KnowledgeObjectResult>;
  runQuery(input: RunQueryRequest): Promise<QueryResult>;
  runSavedSearch(input: RunSavedSearchRequest): Promise<SavedSearchResult>;
}
```

The compiler, mission runner, grader, and receipt generator must depend only on this interface.

## Fixture Mode May Fake

- Splunk API transport.
- Stable MCP tool responses.
- Representative indexes, sourcetypes, macros, lookups, dashboards, panels, saved searches, and event rows.
- A constrained result set for demo missions.
- Tool latency and errors needed to exercise deterministic rules.

## Fixture Mode Must Not Fake

- Different field names than the contract exposes.
- Passing traces that could not occur through the shared adapter.
- Grader decisions.
- Receipt evidence.
- Specimen agent behavior.
- Mode-specific compiler logic.
- Mode-specific mission logic.

## Live Mode Requirements

Live mode must:

- use the same adapter interface;
- preserve MCP guardrails and result limits;
- handle unavailable beta tools gracefully;
- support read-only operation;
- never mutate Splunk;
- record tool call provenance in the same trace format as fixture mode.

## Parity Tests

Required implementation tests:

| Test | Purpose |
|---|---|
| Fixture adapter contract test | Proves fixture adapter implements every shared method. |
| Live adapter shape test | Proves live adapter returns the same normalized result shapes. |
| Compiler adapter-swap test | Runs compile flow against fixture and mocked live adapter without branching compiler code. |
| Grader mode-independence test | Feeds identical trace/contract into grader under both modes and receives identical violations. |
| Receipt mode-disclosure test | Receipt states whether evidence came from fixture or live mode. |

## Demo Disclosure

The demo may use fixture mode if live Splunk setup is unstable, but the screen or README must disclose:

```text
Demo data is fixture-backed for reproducibility. The compiler, mission runner, grader, and receipt generator use the same adapter interface as live MCP mode.
```

## Stop Conditions

Stop implementation if:

- fixture mode bypasses the adapter;
- live mode receives extra capabilities not represented in fixture mode;
- the grader contains mode-specific branches;
- receipt evidence differs by mode for the same trace.

