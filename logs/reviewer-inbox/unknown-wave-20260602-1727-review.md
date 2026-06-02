## Scope
- Review target: unscoped Pre-Flight Card UI change in `src/ui/shell.ts`.
- Branch: `splunkready-build`
- Commit inspected: `8b02a21` plus current dirty worktree.
- Worktree state: dirty; `src/ui/shell.ts` is modified, with no Wave 83 contract/logs visible. Existing reviewer file `logs/reviewer-inbox/wave-82-20260602-1722-rereview.md` is untracked and allowed.
- Timestamp: 2026-06-02T17:27:23+05:30

## Verdict
- fail

## Findings

### HIGH-001: Pre-Flight Card source change has no active wave contract or closeout logs
- Severity: High
- File: `src/ui/shell.ts`
- Evidence: The current worktree modifies `src/ui/shell.ts` to replace the certification replay with a `Readiness Pre-Flight Card` and A-E rail (`src/ui/shell.ts:943-980`). The latest wave file is still `docs/waves/wave-82-external-trace-consolidation.md`; no `wave-83` file exists in `docs/waves/`, and `logs/execution-log.md` still ends at Wave 82.
- Why it matters: This is actual product/UI implementation work, not a small typo fix. The repo process requires source work to be wave-scoped so reviewers can check file ownership, acceptance criteria, required tests, and demo impact. The user also explicitly asked to stop fake QA churn and do real work, so this should become a real implementation wave rather than an anonymous dirty diff.
- Required fix: Add an active implementation wave contract, likely Wave 83, for the Pre-Flight Card UI. Include owned files, acceptance criteria from `docs/preflight-card-ui-implementation-plan.md`, required verification commands, and stop conditions. Update `docs/waves/README.md`, current-state docs, execution log, and verification log during closeout.

### HIGH-002: Focused UI test fails after the markup change
- Severity: High
- File: `tests/ui/shell.test.ts`
- Evidence: `npx vitest run tests/ui/shell.test.ts` fails 1 of 12 tests. The failing assertion is in `tests/ui/shell.test.ts:451`, which still expects `Forensic Compiler Dossier`; the current rendered output now says `Readiness Pre-Flight Card`. The same test also still expects `Case timeline phase 2`, `Initial run failed`, `data-replay-target="replay-rules"`, and compiler diagnostic strings that no longer match the new A-E card structure (`tests/ui/shell.test.ts:451-460`).
- Why it matters: The UI implementation cannot be closed while its focused regression test is red. Updating the UI without updating tests also leaves the Pre-Flight Card acceptance criteria unprotected.
- Required fix: Update the focused UI tests to assert the new Pre-Flight Card contract: exactly one `replay-card`, A-E rail targets, contract rows from `environment-contract.json`, trace rows from before/after artifacts, deterministic rule rows from violation artifacts, policy patch rows without auto-apply claims, and footer language for fixture/no live mutation. Then rerun `npx vitest run tests/ui/shell.test.ts` and broader closeout checks.

### MEDIUM-001: Stale replay tab CSS and JavaScript remain after removing replay panels
- Severity: Medium
- File: `src/ui/shell.ts`
- Evidence: The new markup renders anchors such as `data-replay-target="sec-a"` through `sec-e` and static `replay-card-section` sections (`src/ui/shell.ts:954-976`). The old `.replay-tabs`, `.replay-tab`, `.replay-panel`, and `.replay-panel-head` CSS remains (`src/ui/shell.ts:1323-1405`). The inline script still queries `[data-replay-panel]`, toggles `aria-selected`, and hides/shows panels (`src/ui/shell.ts:1899-1915`), but the new sections do not include `data-replay-panel`.
- Why it matters: Dead UI code and mismatched behavior make the card harder to reason about and can create misleading accessibility state: anchor rail links receive `aria-selected`, while no panels are actually controlled. This is also a direct miss against the implementation plan, which says to update the existing `[data-replay-target]` behavior in `src/ui/shell.ts`.
- Required fix: Either remove the obsolete replay tab/panel behavior entirely for a static anchor rail, or adapt the new Pre-Flight Card sections to a coherent accessible tab/section model. Clean up stale CSS selectors and add tests for the chosen behavior.

## Verification Checked
- Commands observed in logs:
  - Wave 82 closeout logs only; no logs for this new UI diff.
- Commands I ran:
  - `git fetch origin splunkready-build`
  - `git status --short --branch`
  - `git log --oneline --decorate --max-count=5`
  - `find docs/waves -maxdepth 1 -type f -name 'wave-*' | sort | tail -10`
  - `git diff -- src/ui/shell.ts`
  - `rg -n "replay-tab|data-replay-target|data-replay-panel|replay-card|certification-replay|Rules|Forensic|Pre-Flight" src/ui/shell.ts tests/ui/shell.test.ts docs/preflight-card-ui-implementation-plan.md`
  - `npx vitest run tests/ui/shell.test.ts`
- Pass/fail:
  - `npx vitest run tests/ui/shell.test.ts`: FAIL, 1 failed / 12 total tests.
  - Branch/wave inspection: FAIL for process; no active wave contract for the dirty source diff.
- Gaps:
  - I did not run full `npm run check` because the focused UI test is already red.
  - I did not use live Splunk; this UI diff does not require it.

## Truth Table
- Real implemented: partial Pre-Flight Card markup in `src/ui/shell.ts`.
- Fixture-only: current UI artifact remains generated from fixture demo artifacts by default.
- Live-unverified: unchanged; no live Splunk proof was added or claimed in this diff.
- Specimen-agent limitation: unchanged from Wave 82 documentation.
- Reviewer-audit status: would fail once this reviewer file is considered, because latest `unknown-wave` verdict is `fail`.
- Build/dist status: not checked; focused UI test is already failing and `dist` is not tracked.

## Next Reviewer Action
- Recheck after the main executor adds the active Pre-Flight Card wave contract, updates tests and stale replay behavior, records verification, and either resolves or explicitly scopes this dirty UI implementation.
