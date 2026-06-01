# Wave 77 - Certification Replay UI

## Goal

Make the demo more memorable without drifting into a generic AI dashboard by adding an evidence-backed certification replay to the static Readiness Receipt shell.

## Scope

- Add a `Certification replay` section generated from the same receipt, trace, violation, and policy-patch artifacts already loaded by the UI shell.
- Keep the replay interactive inside the static HTML artifact, but do not claim live Splunk execution.
- Fix policy-patch pairing for `ANS-*` violations so unsupported-answer findings map to evidence/uncertainty patch guidance.
- Document the fresh Gemini UI critique triage and explicitly reject broad glassmorphism, fake live execution, generic dashboards, and live Splunk requirements.

## Files Owned

- `src/ui/shell.ts`
- `tests/ui/shell.test.ts`
- `docs/antigravity-ui-202817-triage-report.md`
- `docs/waves/README.md`
- `docs/waves/wave-77-certification-replay-ui.md`
- `MANIFEST.md`
- `PLAN.md`
- `docs/implementation-handoff.md`
- `logs/execution-log.md`
- `logs/verification-log.md`
- reviewer inbox files if new Wave 77 findings arrive.

## Acceptance Criteria

- The UI has a `Certification replay` view with stages for fail, deterministic rules, patch, rerun, and pass.
- Replay content is derived from real artifacts; no fake live telemetry, charts, or unbacked claims.
- The static HTML remains self-contained and does not load external fonts or assets.
- `ANS-*` critical issues map to the evidence/uncertainty policy patch rule instead of falling back by array index.
- Focused UI tests cover the replay and `ANS-*` policy-patch pairing.
- Broad checks pass before commit.

## Verification

- `npx vitest run tests/ui/shell.test.ts`
- `npm run build`
- `npm run check`
- `npm run audit:reviewers`
- `bash scripts/verify-scaffold.sh && git diff --check`

## Reviewer Checklist

- Is the new UI creative while still behaving like a certification artifact rather than a generic dashboard?
- Is every replay claim backed by receipt, trace, violation, policy patch, or evidence-ref data?
- Does the interaction remain static-fixture safe and avoid live Splunk credential requirements?
- Does the `ANS-*` patch mapping have regression coverage?

## Stop Conditions

- The UI introduces unbacked live-status claims.
- The wave turns SplunkReady into a dashboard or assistant.
- The replay depends on live Splunk credentials.
- Any pass/fail semantics become LLM-driven.
