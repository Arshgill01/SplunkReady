## Wave
- Active wave: Unknown wave - UI certification replay
- Review type: scope audit
- Timestamp: 2026-06-01 20:38 IST

## Verdict
- fail

## Findings

### HIGH-001: Interactive UI replay diff has no active wave contract or logs
- Severity: High
- File: `src/ui/shell.ts`
- Evidence: `git status --short --branch` shows modified `src/ui/shell.ts` and `tests/ui/shell.test.ts` after committed Wave 76. `find docs/waves -maxdepth 1 -type f | sort | tail -15` shows wave files only through `docs/waves/wave-76-remote-cleanroom-after-ui-deterministic-checks.md`. `rg -n "Wave 77|wave-77|certification replay|Certification replay|Replay|renderCertificationReplay" docs logs src tests` finds the new replay implementation only in source/tests, not in wave docs or execution/verification logs.
- Why it matters: This is a 300+ line UI behavior change adding an interactive certification replay surface and inline script behavior. It appears to respond to the new UI critique, but without a scoped wave the reviewer cannot evaluate acceptance criteria, product-boundary decisions, sidecar provenance, or verification completeness.
- Required fix: Add a Wave 77 contract and current-state/log entries that explicitly own the interactive replay change, including product-boundary acceptance criteria: receipt-first UI, no chatbot/copilot/dashboard drift, no fake live-agent claims, replay backed only by loaded trace/receipt/violation/policy artifacts, and required UI/browser verification. Alternatively remove the source/test diff until a scoped wave is opened.

### MEDIUM-001: New interactive replay behavior lacks browser-level verification
- Severity: Medium
- File: `tests/ui/shell.test.ts`
- Evidence: The new test assertions only check generated HTML substrings such as `data-replay-target="replay-rules"` and `panel.setAttribute("hidden", "")`. I ran `npx vitest run tests/ui/shell.test.ts` and `npm run build`, and both passed, but there is no recorded browser/screenshot or DOM interaction check proving the replay tabs actually switch panels, preserve accessibility state, and do not break the static shell layout.
- Why it matters: Wave-scale UI interactivity needs more than string presence. A broken tab handler, hidden content issue, or layout regression would be visible to judges even if TypeScript and string tests pass.
- Required fix: Once scoped, add or run an actual generated-shell/browser verification for the replay tabs, including clicking at least one non-default replay tab and confirming the selected tab/panel state changes. Record the exact command and result in `logs/verification-log.md`.

## Verification Checked
- Commands observed:
  - None for a new active wave; Wave 77 contract/logs are not present.
- Commands you ran:
  - `git status --short --branch`
  - `git diff --stat`
  - `git diff -- src/ui/shell.ts`
  - `git diff -- tests/ui/shell.test.ts`
  - `find docs/waves -maxdepth 1 -type f | sort | tail -15`
  - `rg -n "Wave 77|wave-77|certification replay|Certification replay|Replay|renderCertificationReplay" docs logs src tests`
  - `npx vitest run tests/ui/shell.test.ts`
  - `npm run build`
  - `nl -ba src/ui/shell.ts | sed -n '690,890p'`
  - `nl -ba src/ui/shell.ts | sed -n '1528,1678p'`
- Gaps:
  - No current wave contract or logs for the replay change.
  - No browser-level verification of the new replay tabs.
  - No live Splunk check was needed or run.

## Scope Check
- In-scope files:
  - None until a Wave 77 contract exists.
- Questionable files:
  - `src/ui/shell.ts`
  - `tests/ui/shell.test.ts`
- Out-of-scope files:
  - None observed beyond the unscoped UI diff.

## Next Reviewer Action
- Recheck after the main executor adds a Wave 77 contract/logs and browser-level replay verification, or removes the unscoped UI replay diff.
