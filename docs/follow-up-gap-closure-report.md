# Follow-up Gap Closure Report

Wave: 82 - External Trace Consolidation

## What Moved

SplunkReady now accepts externally captured trace data through `grade-trace`. This addresses the highest-risk demo credibility gap: the product can grade a trace produced outside the bundled deterministic specimen, while keeping deterministic rules as the pass/fail authority.

## Real Implemented

- Fixture adapter and optional live adapter share the `SplunkAccessAdapter` boundary.
- Environment contracts compile from the adapter boundary.
- Deterministic grader rules cite rule IDs from `docs/grader-rule-catalog.md`.
- Readiness Receipts include trace refs, evidence refs, violations, score, and verdict.
- Fixture demo shows fail -> policy patch -> rerun -> pass.
- `grade-trace` validates an externally supplied trace, rejects wrong-mission traces, emits violations/score, and writes an external-trace Readiness Receipt.

## Fixture-only

- The bundled fail -> patch -> rerun -> pass story is fixture-backed.
- The bundled `NaiveSpecimenAgent` is deterministic TypeScript code for reproducible local demos.
- The current static shell is generated from fixture artifacts by default.

## Live-unverified

- Real Splunk Enterprise/MCP inventory has not been exercised in this branch.
- Live saved-search availability has not been proven against a real endpoint.
- Live mission execution is not implemented; the current live path is read-only inventory smoke.

See `docs/live-proof-gap.md` for the exact skip command, missing env vars, and smallest next read-only live command.

## Specimen-agent Limitation

The bundled specimen is useful for deterministic demonstrations, but it is not a real LLM/MCP agent. It constructs a naive broad query without policy and uses the preferred saved search when policy is present. That behavior is now documented honestly in README.

The new external-trace path is the bridge for real agents: capture their Splunk MCP trace in the canonical trace schema, then run `grade-trace`.

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

The current Forensic Compiler Dossier UI is better than the earlier generic dashboard, but Minimax's refined Pre-Flight Card is the stronger final direction. It should replace the certification replay in the next UI implementation wave.

Implementation target: `docs/preflight-card-ui-implementation-plan.md`.

## Commands Run

- `npx vitest run tests/cli/flow.test.ts` - PASS, 1 test file / 7 tests.
- `npm run build` - PASS.
- no-credential `live-smoke` command in `docs/live-proof-gap.md` - SKIP as expected, no live calls and no live artifacts.
- `npm run check` - PASS, 31 test files / 145 tests.
- `npm run audit:reviewers` - PASS, 84 groups, 7 pass-with-concerns files, 0 failing latest verdicts.
- `bash scripts/verify-scaffold.sh && git diff --check` - PASS, 83 waves and 443 project files.

## Open Risks

- Live Splunk proof still needs user-coordinated credentials and a bounded read-only run.
- The Pre-Flight Card is not implemented yet.
- External traces must be produced by another agent or capture layer; SplunkReady now grades them but does not record live MCP sessions itself in this wave.
