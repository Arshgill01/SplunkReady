# Wave 75 - Antigravity UI 19:57 Triage

## Goal

Triage the fresh Antigravity/Gemini UI sidecar launched at 19:57 and integrate only bounded UI evidence improvements that preserve SplunkReady's product scope.

## Scope

- Inspect the sidecar worktree `/private/tmp/splunkready-antigravity-ui-fresh-20260601-195731`.
- Accept only small UI changes that make claims visibly backed by receipt, trace, violation, or contract data.
- Reject broad restyling and sidecar metadata.
- Keep schema, adapter, grader, receipt, CLI, fixture, live, and policy semantics unchanged.

## Files Owned

- `src/ui/shell.ts`
- `tests/ui/shell.test.ts`
- `docs/antigravity-ui-195731-triage-report.md`
- wave index docs.
- current-state handoff docs.
- execution and verification logs.
- reviewer inbox files if new Wave 75 findings arrive.

## Acceptance Criteria

- Mission table shows deterministic check status only when backed by real before/after violation evidence.
- Focused UI tests cover the evidence-backed check statuses.
- Broad Antigravity restyling is not integrated.
- `.antigravitycli/` and other sidecar artifacts remain untracked.
- Verification commands pass and are logged.

## Verification

- `npx vitest run tests/ui/shell.test.ts`
- `npm run build`
- `npm run check`
- `npm run audit:reviewers`
- `bash scripts/verify-scaffold.sh && git diff --check`

## Reviewer Checklist

- Are the mission check statuses derived from deterministic violation data rather than hardcoded display text?
- Does the UI still avoid product drift into a generic dashboard or assistant?
- Is the accepted diff limited to UI shell behavior and focused tests?
- Were broad sidecar styling changes and sidecar metadata excluded?
- Do the logs and triage report state exactly what was accepted and rejected?

## Stop Conditions

- The wave changes grader, schema, adapter, receipt, fixture, live, or CLI behavior.
- The wave imports broad sidecar restyling.
- The wave tracks `.antigravitycli/` or other sidecar runtime artifacts.
