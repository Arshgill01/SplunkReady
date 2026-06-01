# Wave 50 - Antigravity UI Sidecar Triage

## Goal

Triage the fresh Antigravity/Gemini UI sidecar output and preserve only evidence-backed UI guardrails.

## Scope

- Review the fresh sidecar worktree output and sidecar report.
- Document accepted and rejected recommendations.
- Add a narrow regression guard if the sidecar exposed a repeatable UI drift risk.
- Do not merge broad visual rewrites without main-executor ownership and verification.

## Files Owned

- UI sidecar triage report.
- UI tests if a narrow regression guard is needed.
- wave index docs.
- execution and verification logs.
- reviewer inbox files if new findings arrive.

## Acceptance Criteria

- The main branch stays receipt-first and avoids generic dashboard/copilot styling.
- Broad dark-theme or decorative sidecar changes are either rejected or reduced to a small reviewed diff.
- The sidecar run is traceable to its clean worktree and model context.
- Any new UI guard is backed by a concrete sidecar drift risk.

## Verification

- `npx vitest run tests/ui/shell.test.ts`
- `npm run audit:reviewers`
- `npm run check`
- `bash scripts/verify-scaffold.sh && git diff --check`

## Reviewer Checklist

- Did the main executor review the sidecar diff rather than blindly applying it?
- Are rejected UI recommendations documented with product-lock rationale?
- Does any new test guard real drift without overfitting harmless styling?

## Stop Conditions

- Sidecar output is merged as a broad rewrite.
- UI changes hide fixture/live boundaries, receipt provenance, or fail -> patch -> rerun -> pass.
