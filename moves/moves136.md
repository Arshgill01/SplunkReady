# Move 136 - Runs Trace Preview Repair

## Intent

Fix the judge-visible Runs view trace preview after the external-client
screencast path was stopped. The Runs detail should show the selected run's
trace early, keep before/after phases readable, and avoid duplicated-looking
step labels across phases.

## Scope

- Move the Runs trace preview above proof-audit and manifest panels.
- Keep trace phases side by side when the detail pane has room.
- Prefix preview event sequence labels by phase:
  - `B01` for before/current;
  - `A01` for after/current;
  - `E01` for external traces;
  - `I01` for imported MCP transcripts.
- Keep the fix UI-only. Do not change trace grading, receipts, or Splunk
  mutation behavior.

## Verification

- `npx vitest run tests/ui/app.test.ts --testNamePattern "Runs trace preview|proof bundle browser|app styling"`
- `npm run ui:build`
- `npm run check`
- Playwright against the live Vite workbench:
  - open `http://127.0.0.1:4317/?artifacts=%2Fapi%2Fartifacts%2Frun-2026-06-05T13-16-04-455Z-a1aa17b7#proof-browser`;
  - verify trace preview appears after receipt comparison and before proof
    audit;
  - verify phase grid is two columns at desktop width;
  - verify sequence labels are `B01...` and `A01...`;
  - verify no trace preview event/header overflow at desktop and mobile widths.

## Notes

- No subagents were used.
- No `.splunkready*` or `.env*` files were read, sourced, printed, or changed.
- The public npm package remains a separate operator action: npm latest still
  reports `splunkready@0.1.0`, while local source is `0.1.1`.
