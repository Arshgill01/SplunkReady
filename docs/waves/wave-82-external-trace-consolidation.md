# Wave 82 - External Trace Consolidation

## Goal

Stop verification-only churn and make SplunkReady more honest and more useful by accepting externally captured agent traces for deterministic grading.

## Scope

- Add a CLI path that grades an externally supplied trace against the compiled Splunk environment contract and mission.
- Keep pass/fail deterministic; the external trace producer is not the grader.
- Render receipt notes in Markdown so external-trace receipts disclose their source and grading boundary.
- Add explicit consolidation evidence for live-unverified status, specimen limitations, fixture coverage, and the Minimax Pre-Flight Card UI plan.
- Resolve the Wave 82 reviewer failures by reframing the wave around actual consolidation and product capability.

## Files Owned

- `src/cli.ts`
- `src/receipts/generator.ts`
- `tests/cli/flow.test.ts`
- `README.md`
- `MANIFEST.md`
- `PLAN.md`
- `docs/implementation-handoff.md`
- `docs/live-proof-gap.md`
- `docs/follow-up-gap-closure-report.md`
- `docs/preflight-card-ui-implementation-plan.md`
- `docs/prompts/README.md`
- `docs/prompts/main-executor-followup-consolidation-goal.md`
- `docs/prompts/reviewer-followup-consolidation-goal.md`
- `docs/waves/README.md`
- `docs/waves/wave-82-external-trace-consolidation.md`
- `logs/execution-log.md`
- `logs/verification-log.md`
- relevant Wave 82 reviewer inbox files and main-executor resolutions.

## Acceptance Criteria

- `grade-trace --trace <path> --out <dir>` loads `environment-contract.json`, the selected mission, and a schema-valid external trace.
- The command rejects trace events whose `missionId` does not match the selected mission.
- The command emits `trace-external.json`, `violations-external.json`, `score-external.json`, `receipt-external-001.json`, and `receipt-external-001.md`.
- External-trace receipts state that the deterministic rule engine decides pass/fail and the trace producer is outside SplunkReady.
- README and consolidation docs distinguish deterministic fixture specimen behavior from externally supplied agent traces.
- Live Splunk remains opt-in and unverified unless a bounded read-only live command is actually run.
- The Minimax Pre-Flight Card design is captured as the next UI implementation target with risks and file-level work items.

## Verification

- `npx vitest run tests/cli/flow.test.ts`
- `npm run check`
- `npm run audit:reviewers`
- `bash scripts/verify-scaffold.sh && git diff --check`

## Reviewer Checklist

- Does the new trace path grade externally supplied traces without making an LLM authoritative?
- Does it reject wrong-mission traces?
- Are live Splunk claims explicit about what is unverified?
- Are specimen-agent limitations stated honestly?
- Is the UI plan grounded in the Minimax artifacts without merging fake sample data or sidecar files blindly?

## Stop Conditions

- External trace grading bypasses schema validation.
- The command accepts traces for the wrong mission.
- Docs imply live Splunk was validated when no live command ran.
- The Pre-Flight Card plan introduces fake live state, generic dashboard patterns, or auto-mutation claims.
