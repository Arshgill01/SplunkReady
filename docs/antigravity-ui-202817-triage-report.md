# Antigravity UI 20:28 Triage Report

Wave: 77 - Certification Replay UI

Sidecar worktree: `/private/tmp/splunkready-antigravity-ui-fresh-20260601-202817`

Model shown: `Gemini 3.5 Flash (Medium)`

## Inputs Considered

- Fresh Antigravity sidecar output from the 20:28 worktree.
- User-provided Gemini critique that the UI needed a more memorable demo surface.
- Existing product boundaries in `AGENTS.md`, `QUALITY-BAR.md`, `docs/demo-script.md`, and `logs/risk-register.md`.

## Accepted

- A bounded correctness fix from the sidecar: map `ANS-*` violations to the evidence/uncertainty policy patch rule family in the critical issue fix table.
- A product-native creative direction: a `Certification replay` generated from real receipt, trace, violation, policy-patch, and evidence-ref artifacts.

## Rejected

- Glassmorphism, glowing dashboards, decorative charts, dark-mode spectacle, and generic AI control-room styling.
- Fake live execution or claims that the static fixture replay is running against live Splunk.
- Any requirement for live Splunk credentials in normal fixture tests.
- Broad UI restyling outside the certification artifact surface.

## Integrated Behavior

- The Readiness Receipt shell now includes a tabbed replay for `Fail`, `Rules`, `Patch`, `Rerun`, and `Pass`.
- Replay stages cite loaded artifact data rather than invented status.
- `ANS-*` critical findings now pair with evidence/uncertainty patch guidance.

## Verification

- Focused UI tests cover replay markers, deterministic rule evidence, evidence refs, and `ANS-*` patch pairing.
- Full wave verification is recorded in `logs/verification-log.md`.
