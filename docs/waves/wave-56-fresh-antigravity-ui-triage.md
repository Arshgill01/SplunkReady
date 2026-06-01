# Wave 56 - Fresh Antigravity UI Triage

## Goal

Triage the fresh Antigravity/Gemini UI sidecar output requested after Wave 55 and integrate only bounded, receipt-first navigation polish.

## Scope

- Review the sidecar worktree diff from `/tmp/splunkready-antigravity-ui-fresh-20260601-172602`.
- Accept or reject each UI suggestion with product-lock rationale.
- Keep changes limited to static UI shell ergonomics and UI tests.
- Do not alter schemas, adapters, grader rules, receipt semantics, or demo artifacts.

## Files Owned

- `src/ui/shell.ts`
- `tests/ui/shell.test.ts`
- UI sidecar triage report.
- wave index docs.
- execution and verification logs.
- reviewer inbox files if new findings arrive.

## Acceptance Criteria

- UI remains a static receipt/artifact viewer, not a dashboard or assistant.
- Fresh sidecar output is traceable to its tmux window, worktree, branch, and model context.
- Accepted changes are small, accessible, and evidence-neutral.
- Rejected sidecar suggestions are documented.
- Goal remains open pending explicit user approval.

## Verification

- `npx vitest run tests/ui/shell.test.ts`
- `npm run audit:reviewers`
- `npm run check`
- `bash scripts/verify-scaffold.sh && git diff --check`

## Reviewer Checklist

- Did the main executor avoid blindly merging the sidecar diff?
- Are UI changes restrained and consistent with SplunkReady as a certification receipt?
- Do tests guard the accepted behavior without overfitting harmless style choices?
- Does the wave avoid changing product scope or receipt semantics?

## Stop Conditions

- Sidecar output becomes a broad redesign.
- UI changes hide receipt provenance, fixture/live boundaries, or fail -> patch -> rerun -> pass.
- Non-UI product contracts change.
