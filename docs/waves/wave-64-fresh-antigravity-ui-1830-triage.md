# Wave 64 - Fresh Antigravity UI 1830 Triage

## Goal

Triage the fresh Antigravity/Gemini UI sidecar restarted after Wave 63 and decide whether any static UI shell changes should be integrated.

## Scope

- Review the sidecar worktree diff from `/private/tmp/splunkready-antigravity-ui-fresh-20260601-183020`.
- Record the tmux window, worktree, branch, model context, and sidecar output.
- Accept or reject UI suggestions with product-lock rationale.
- Keep any accepted changes limited to static UI shell ergonomics and focused UI tests.
- Do not integrate generated sidecar artifacts.
- Do not alter schemas, adapters, grader rules, receipt semantics, fixture data, live-mode behavior, or demo orchestration.

## Files Owned

- Fresh sidecar triage report.
- UI shell and UI tests only if a bounded product-safe change is accepted.
- wave index docs.
- current-state handoff docs.
- execution and verification logs.
- reviewer inbox files if new findings arrive.

## Acceptance Criteria

- The fresh sidecar run is traceable to its tmux window, worktree, branch, and model context.
- The main executor does not blindly merge broad visual refresh output.
- Any accepted UI change is receipt-first, evidence-neutral, and compatible with existing drift guards.
- Rejected sidecar suggestions are documented with rationale.
- Generated sidecar artifacts remain outside the main branch.
- Goal remains open pending explicit user approval.

## Verification

- `npm run audit:reviewers`
- `bash scripts/verify-scaffold.sh && git diff --check`
- `npm run check`

## Reviewer Checklist

- Did the wave preserve SplunkReady as a certification receipt rather than a generic dashboard?
- Did the main executor inspect the sidecar diff and document accept/reject decisions?
- Are generated local sidecar artifacts excluded from the main branch?
- Did the wave avoid changing product behavior or receipt semantics?

## Stop Conditions

- The sidecar diff becomes a broad redesign.
- UI changes hide receipt provenance, fixture/live boundaries, or fail -> patch -> rerun -> pass.
- Non-UI product contracts change.
