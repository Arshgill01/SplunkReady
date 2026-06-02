# Wave 84 - Splunk-Derived Readiness Profile

## Goal

Make the deterministic rule surface deployment-derived and auditable instead of looking like a static fixture rule bundle.

The wave adds a first-class `readiness-profile.json` artifact compiled from the same `EnvironmentContract` used by the grader. It records which rule IDs are active, what Splunk contract facts activated them, and what role an LLM is allowed to play.

## Scope

- Add a strict `ReadinessProfile` schema.
- Compile readiness profiles from `EnvironmentContract` and mission definitions.
- Emit `readiness-profile.json` from fixture `compile` and demo flows.
- Emit `live-smoke-readiness-profile.json` from read-only live smoke when live MCP credentials are provided.
- Surface the readiness profile in the static receipt shell as contract evidence.
- Keep pass/fail authority deterministic.

## Non-Goals

- Do not use an LLM as the primary pass/fail grader.
- Do not auto-mutate Splunk.
- Do not require live Splunk credentials for fixture tests.
- Do not implement a full live mission runner in this wave.
- Do not replace the static shell with a new web app in this wave.

## Files Owned

- `src/schemas/core.ts`
- `src/compiler/readiness-profile.ts`
- `src/cli.ts`
- `src/ui/shell.ts`
- `tests/compiler/readiness-profile.test.ts`
- `tests/schemas/core.test.ts`
- `tests/cli/flow.test.ts`
- `tests/ui/shell.test.ts`
- `README.md`
- `docs/live-proof-gap.md`
- `docs/follow-up-gap-closure-report.md`
- wave index, manifest, plan, handoff, and logs

## Verification

- `npx vitest run tests/compiler/readiness-profile.test.ts tests/schemas/core.test.ts tests/cli/flow.test.ts`
- `npx vitest run tests/ui/shell.test.ts tests/compiler/readiness-profile.test.ts tests/schemas/core.test.ts tests/cli/flow.test.ts`
- `npm run build`
- `npm run check`
- `npm run audit:reviewers`
- `bash scripts/verify-scaffold.sh && git diff --check`

## Reviewer Checklist

- Does `readiness-profile.json` derive from `EnvironmentContract` and mission data instead of duplicating static UI copy?
- Do rule bindings cite deterministic rule IDs from `docs/grader-rule-catalog.md`?
- Are Splunk contract facts visible in profile evidence refs and values?
- Does the live smoke path remain read-only and inventory-only?
- Does the schema prevent an LLM from becoming pass/fail authority?
- Does the UI surface profile evidence without claiming real-time/live execution?

## Acceptance Criteria

- Fixture compile writes `readiness-profile.json`.
- Fixture demo includes `readiness-profile.json` in the expected artifact list.
- Live smoke writes `live-smoke-readiness-profile.json` only after live opt-in configuration is present.
- The profile cites rule IDs from `docs/grader-rule-catalog.md` and binds them to Splunk contract evidence such as saved searches, restricted indexes, sourcetypes, MCP tools, and query budgets.
- The schema rejects profiles that make an LLM the pass/fail authority.
- The UI shows the profile as receipt/contract evidence without fake live or dashboard claims.

## Stop Conditions

- The implementation uses an LLM as pass/fail authority.
- Fixture compile requires live Splunk credentials.
- Live smoke runs searches or mutation-capable Splunk operations.
- Fixture and live paths fork after the adapter boundary.
- UI copy implies live proof happened without a real live run.

## Next Product Gaps

- Implement or integrate a real LLM/MCP specimen agent that produces canonical trace events.
- Run live smoke against a real Splunk MCP endpoint when credentials are available.
- Record a demo with real MCP calls once live proof exists.
