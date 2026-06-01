# Verification Matrix

This matrix defines what future implementation must prove.

## Scaffold Verification

| Check | Command | Required |
|---|---|---|
| Required docs exist | `bash scripts/verify-scaffold.sh` | Yes |
| Wave count is 42 | `bash scripts/verify-scaffold.sh` | Yes |
| Wave sections exist | `bash scripts/verify-scaffold.sh` | Yes |
| No empty Markdown files | `find . -type f -name '*.md' -exec sh -c 'for f; do if [ ! -s "$f" ]; then echo EMPTY:$f; fi; done' sh {} +` | Yes |
| Codex nomenclature documented | `rg -n "Agent Skill|SKILL.md|AGENTS.md" docs/skills references` | Yes |

## Implementation Verification

| Area | Required Proof |
|---|---|
| Schemas | Runtime validation tests with positive and negative fixtures |
| Fixture adapter | Implements same interface as live adapter |
| Live adapter | Disabled-by-default tests pass without credentials |
| Contract compiler | Emits schema-valid Environment Contract from fixture MCP data |
| Mission runner | Runs fixture missions and captures trace |
| Specimen agent | Fails naturally before policy, passes after policy without hardcoded mission branches |
| Grader | Rule tests for each deterministic rule family |
| Receipt | Snapshot plus provenance test: every claim references trace/violation ids |
| UI | Browser/screenshot checks for receipt, trace, and contract views |
| Demo | Rehearsal command produces fail -> compile -> patch -> rerun -> pass artifacts |

## Final Submission Verification

| Requirement | Required Proof |
|---|---|
| Demo video under 3 minutes | final rehearsal timing |
| Public repo setup | README setup command verified |
| Architecture diagram | root diagram file exists |
| Open-source license | license file exists |
| Fixture demo reproducible | clean checkout fixture command passes |
| Live mode documented | optional live setup docs with no secrets |

