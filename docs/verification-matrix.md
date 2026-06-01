# Verification Matrix

Status: current implementation verification matrix. The original scaffold checks remain useful, but implementation evidence now comes from tests, audits, cleanroom verification, and demo artifacts.

## Scaffold Verification

| Check | Command | Required |
|---|---|---|
| Required docs exist | `bash scripts/verify-scaffold.sh` | Yes |
| Wave files are indexed and non-empty | `bash scripts/verify-scaffold.sh` | Yes |
| Wave sections exist | `bash scripts/verify-scaffold.sh` | Yes |
| No empty Markdown files | `find . -type f -name '*.md' -exec sh -c 'for f; do if [ ! -s "$f" ]; then echo EMPTY:$f; fi; done' sh {} +` | Yes |
| Codex nomenclature documented | `rg -n "Agent Skill|SKILL.md|AGENTS.md" docs/skills references` | Yes |

## Implementation Verification

| Area | Required Proof | Current Evidence |
|---|---|---|
| Schemas | Runtime validation tests with positive and negative fixtures | `tests/schemas/core.test.ts`, `npm run check` |
| Fixture adapter | Implements same interface as live adapter | `tests/adapters/fixture.test.ts`, `docs/fixture-live-parity.md` |
| Live adapter | Disabled-by-default tests pass without credentials | `tests/adapters/live.test.ts`, `docs/live-adapter.md` |
| Contract compiler | Emits schema-valid Environment Contract from fixture MCP data | `tests/compiler/environment.test.ts` |
| Mission runner | Runs fixture missions and captures trace | `tests/cli/flow.test.ts`, demo artifacts |
| Specimen agent | Fails naturally before policy, passes after policy without hardcoded mission branches | `tests/agents/specimen.test.ts`, before/after traces |
| Grader | Rule tests for each deterministic rule family | `tests/grader/*.test.ts`, `docs/grader-rule-catalog.md` |
| Receipt | Provenance test: claims reference trace/violation ids | `tests/receipts/generator.test.ts`, receipt artifacts |
| UI | Receipt, trace, contract, and rerun views render from artifacts | `tests/ui/shell.test.ts`, generated `splunkready-shell.html` |
| Demo | Rehearsal command produces fail -> compile -> patch -> rerun -> pass artifacts | `docs/remote-cleanroom-after-audit-report.md` |

## Final Submission Verification

| Requirement | Required Proof |
|---|---|
| Demo under 3 minutes | `demo-rehearsal.json` reports `fitsUnderThreeMinutes: true` |
| Public repo setup | README setup command verified in cleanroom |
| Architecture diagram | root diagram file exists |
| Open-source license | license file exists |
| Fixture demo reproducible | Wave 52 remote cleanroom passed |
| Live mode documented | optional live setup docs with no secrets |
