# Follow-up Gap Closure Report

Wave: 84 - Splunk-Derived Readiness Profile

## What Moved

SplunkReady now accepts externally captured trace data through `grade-trace`, renders the Minimax-derived Pre-Flight Card UI, and emits a deployment-bound `readiness-profile.json` from fixture compile/demo flows. The profile addresses the static-rule credibility gap by binding active deterministic rule IDs to Splunk contract facts such as saved searches, restricted indexes, sourcetypes, MCP tools, evidence rules, and query budgets.

## Real Implemented

- Fixture adapter and optional live adapter share the `SplunkAccessAdapter` boundary.
- Environment contracts compile from the adapter boundary.
- Deterministic grader rules cite rule IDs from `docs/grader-rule-catalog.md`.
- Readiness Receipts include trace refs, evidence refs, violations, score, and verdict.
- Fixture demo shows fail -> policy patch -> rerun -> pass.
- `grade-trace` validates an externally supplied trace, rejects wrong-mission traces, emits violations/score, and writes an external-trace Readiness Receipt.
- `readiness-profile.json` records deployment signals, rule bindings, contract refs, mission refs, and LLM role boundaries.
- Live smoke now compiles `live-smoke-readiness-profile.json` when a real live MCP endpoint is configured.
- The UI surfaces the readiness profile in the contract view and replay rules pane without fake live claims.

## Fixture-only

- The bundled fail -> patch -> rerun -> pass story is fixture-backed.
- The bundled `NaiveSpecimenAgent` is deterministic TypeScript code for reproducible local demos.
- The current static shell is generated from artifact files by default.

## Live-unverified

- Real Splunk Enterprise/MCP inventory has not been exercised in this branch.
- Live saved-search availability has not been proven against a real endpoint.
- Live mission execution is not implemented; the current live path is read-only inventory smoke.
- `live-smoke-readiness-profile.json` is tested with a mock MCP endpoint, not a real Splunk deployment.

See `docs/live-proof-gap.md` for the exact skip command, missing env vars, and smallest next read-only live command.

## Specimen-agent Limitation

The bundled specimen is useful for deterministic demonstrations, but it is not a real LLM/MCP agent. It constructs a naive broad query without policy and uses the preferred saved search when policy is present. That behavior is now documented honestly in README.

The external-trace path is the bridge for real agents: capture their Splunk MCP trace in the canonical trace schema, then run `grade-trace`.

The next product move should be a real LLM/MCP trace runner or adapter that produces canonical `TraceEvent[]` from actual model/tool interaction. That runner may use Gemini or another model, but the Readiness Receipt pass/fail must remain deterministic.

## Fixture Coverage

| Coverage area | Evidence |
|---|---|
| Saved-search discipline | `mission-security-lateral-movement-readiness`, rules `KO-001`, `KO-002` |
| Wrong-field / stale field | `SPL-003` against `src_ip` in the flagship trace |
| App context | `mission-security-saved-search-app-context`, rule `KO-003` |
| Evidence grounding | `EVD-001`, `EVD-002`, `EVD-003`, `ANS-001` |
| Prompt-injection resistance | `mission-security-alert-evidence-classification`, `mission-safety-prompt-injection-event-data`, rule `SAF-001` |
| Query-budget / read-only discipline | `SAF-002`, `SAF-003` |
| Observability transfer | `mission-observability-latency` |

## UI Direction

The Minimax-derived Pre-Flight Card is now implemented as the primary certification replay route. The UI remains a static artifact shell, which is acceptable for fixture reproducibility but weak for judging unless paired with real live MCP proof or a recorded agent run.

## Commands Run

- `npx vitest run tests/compiler/readiness-profile.test.ts tests/schemas/core.test.ts tests/cli/flow.test.ts` - PASS, 3 test files / 19 tests.
- `npx vitest run tests/ui/shell.test.ts tests/compiler/readiness-profile.test.ts tests/schemas/core.test.ts tests/cli/flow.test.ts` - PASS, 4 test files / 31 tests.

## Open Risks

- Live Splunk proof still needs user-coordinated credentials and a bounded read-only run.
- External traces must be produced by another agent or capture layer; SplunkReady grades them but still does not record live MCP sessions itself.
- The bundled specimen remains deterministic TypeScript. It is honest and useful for reproducibility, but it is not the demo path that will win a live MCP prize.
