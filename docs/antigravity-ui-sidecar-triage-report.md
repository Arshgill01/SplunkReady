# Antigravity UI Sidecar Triage Report

Wave: 50 - Antigravity UI Sidecar Triage

## Sidecar Run

- Tool: `agy --dangerously-skip-permissions`
- Model shown in tmux: Gemini 3.5 Flash (High)
- tmux window: `Splunk:6` / `agy-ui-fresh-1650`
- Worktree: `/tmp/splunkready-antigravity-ui-fresh-20260601-165040`
- Branch: `antigravity-ui-fresh-20260601-165040`
- Base commit: `c058698 wave-48: automate reviewer audit`
- Sidecar diff: `src/ui/shell.ts`, 302 changed lines, plus local `.antigravitycli/` metadata.

## Main Executor Decision

Rejected the sidecar UI rewrite for the main branch.

The sidecar preserved offline execution and kept tests passing in its isolated worktree, but the proposed change was a broad visual rewrite rather than a targeted readiness improvement. It switched the shell to a dark slate theme, added accent gradients, glow-style verdict text, hover animations, and negative letter spacing. Those changes increased generic dashboard styling risk without improving the evidence-backed Readiness Receipt workflow.

## Accepted Lessons

- The sidecar usefully identified that the UI style can drift through CSS-only edits while existing functional tests still pass.
- The main branch now has a narrow UI regression guard for the specific sidecar drift shape:
  - the generated shell must retain the current light color scheme;
  - it must not switch to `color-scheme: dark`;
  - it must not introduce negative letter spacing.

## Rejected Recommendations

- Rejected the full dark slate theme because SplunkReady is an operational certification receipt, not a decorative dashboard.
- Rejected accent gradients and glow treatments because verdicts should remain clear, trace-backed receipt data.
- Rejected the broad 302-line CSS rewrite because Wave 50 is a triage wave, not a redesign wave.

## Verification Evidence

- `npx vitest run tests/ui/shell.test.ts` verifies the added UI drift guard and existing receipt-first behavior.
- `npm run check` verifies the full fixture suite still passes.
- `npm run audit:reviewers` verifies latest reviewer verdicts remain nonblocking.
- `bash scripts/verify-scaffold.sh && git diff --check` verifies scaffold consistency and whitespace.

## Follow-Up

Future UI work can still improve spacing, table density, or responsive readability, but it should land as small receipt-backed changes that preserve fixture/live boundaries, visible fail -> patch -> rerun -> pass, and trace/evidence provenance.
