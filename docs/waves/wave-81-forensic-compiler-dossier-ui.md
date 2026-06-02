# Wave 81 - Forensic Compiler Dossier UI

## Goal

Replace the generic-feeling certification replay treatment with a more memorable, product-native UI direction grounded in the fresh Antigravity/Gemini concept sidecar.

## Scope

- Triage the fresh 21:10 Antigravity/Gemini UI concepts.
- Integrate a bounded static-shell UI improvement: a case timeline plus deterministic compiler diagnostics for the certification replay.
- Keep the UI backed only by receipt, trace, violation, policy patch, evidence, and artifact path data.
- Preserve the static TypeScript-generated artifact shell and fixture/live contract boundaries.

## Files Owned

- `src/ui/shell.ts`
- `tests/ui/shell.test.ts`
- `docs/antigravity-ui-concepts-211055-triage-report.md`
- `docs/waves/README.md`
- `docs/waves/wave-81-forensic-compiler-dossier-ui.md`
- `MANIFEST.md`
- `PLAN.md`
- `docs/implementation-handoff.md`
- `logs/execution-log.md`
- `logs/verification-log.md`
- reviewer inbox files if new Wave 81 findings arrive.

## Acceptance Criteria

- The replay no longer reads as a generic dashboard tab strip.
- The Rules phase renders deterministic compiler diagnostics from real violation objects.
- Rule diagnostics cite actual rule ids, severity, trace event id, evidence, reason, and suggested policy patch.
- The replay keeps `Fail -> Rules -> Patch -> Rerun -> Pass` and remains usable through tabs/buttons.
- The UI does not add fake live status, fake charts, chatbot/copilot affordances, or unbacked product claims.
- Existing receipt, trace, contract, rerun, and artifact views remain available.

## Verification

- `npx vitest run tests/ui/shell.test.ts`
- `npm run build`
- Fresh fixture demo generation with live Splunk env vars unset
- Browser verification of `#certification-replay`, Rules selection, diagnostics visibility, and screenshot capture
- `npm run check`
- `npm run audit:reviewers`
- `bash scripts/verify-scaffold.sh && git diff --check`

## Reviewer Checklist

- Does the UI remain a certification harness rather than a dashboard or assistant?
- Are diagnostics derived from loaded violations rather than hardcoded sample text?
- Does the new UI preserve existing artifact provenance?
- Are sidecar artifacts kept out of the main tree except for the triage report?

## Stop Conditions

- The change introduces fake live execution, fake telemetry, or fake charts.
- The change makes an LLM authoritative for pass/fail.
- The change alters schema, adapter, grader, or CLI behavior outside UI needs.
- The change tracks `.antigravitycli/` or sidecar prototype files.
