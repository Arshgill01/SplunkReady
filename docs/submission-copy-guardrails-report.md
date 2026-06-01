# Submission Copy Guardrails Report

Wave: 49 - Submission Copy Guardrails

## Scope

- Added a local deterministic audit for judge-facing submission copy.
- Checked required product-lock claims across README, Devpost copy, demo script, and live-adapter docs.
- Added targeted forbidden-positive checks for product-drift copy while allowing required negative boundary statements.
- Hardened the reviewer inbox audit after a late Wave 48 reviewer finding showed malformed latest verdicts could pass as `unknown`.

## Reviewer Findings

- `wave-48-20260601-1648-review.md` `HIGH-001`: resolved by making unparseable latest reviewer verdicts blockers in `scripts/audit-reviewer-inbox.mjs`; a missing-verdict temp fixture now exits nonzero.
- `wave-48-20260601-1652-rereview.md`: reviewer passed the Wave 48 fix.
- `wave-49-20260601-1649-review.md` `HIGH-001`: resolved by adding forbidden-positive drift checks such as `is a Splunk chatbot`, `is a SOC copilot`, `is a telemetry dashboard`, `is a detection-health dashboard`, and `is a generic eval harness`; a temp docs fixture with contradictory chatbot copy now exits nonzero.
- `wave-49-20260601-1649-review.md` `HIGH-002`: resolved by the Wave 48 rereview and Wave 49 rereview.
- `wave-49-20260601-1654-rereview.md`: reviewer passed with no open Wave 49 findings.

## Verification Evidence

- `npm run audit:submission-copy` passed against the real repository copy with 28 required claims.
- A temp reviewer inbox with a malformed blank-line failing verdict exited nonzero.
- A temp reviewer inbox with no verdict section exited nonzero as `unparseable`.
- A temp docs copy with all required phrases plus `SplunkReady is a Splunk chatbot and SOC copilot dashboard.` exited nonzero.
- `bash scripts/verify-scaffold.sh && git diff --check` passed.
- `npm run check` passed with 31 test files and 139 tests.
- `npm run audit:reviewers` passed after the Wave 49 rereview arrived.

## Boundaries

- The copy audit is not a substitute for evidence-backed product claims.
- The audit remains dependency-free and local.
- Fixture mode remains credential-free, and no live Splunk mutation behavior was introduced.
