# Wave 43 - UI Sidecar Polish

## Goal

Use Antigravity/Gemini sidecar critique for bounded UI polish while keeping SplunkReady receipt-first.

## Scope

- Review isolated sidecar UI recommendations.
- Integrate only high-signal UI changes.
- Reject or document changes that add network dependencies, generic dashboard styling, hidden claims, or product drift.

## Files Owned

- `src/ui/shell.ts`
- `tests/ui/shell.test.ts`
- UI verification notes.
- execution and verification logs.

## Acceptance Criteria

- Readiness Receipt remains the primary surface.
- Fixture mode is visible and honest.
- Fail -> patch -> rerun -> pass is immediate in the UI.
- No CDN fonts, hidden pass/fail claims, emoji-only status, or generic dashboard/copilot framing are introduced.

## Verification

- `npx vitest run tests/ui/shell.test.ts`
- `npx tsc --noEmit`
- generated UI screenshot check

## Reviewer Checklist

- Did the sidecar run from a clean separate worktree or branch?
- Did the main executor review and own the final integrated diff?
- Does the UI still avoid dashboard/copilot drift?

## Stop Conditions

- Sidecar output is merged without main-executor review.
