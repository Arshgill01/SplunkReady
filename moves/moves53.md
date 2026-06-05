# Move 53: Runs Trace Preview Layout

## Trigger

The Runs section trace preview can look visually confused when long trace IDs,
tool names, parent refs, or hidden-event rows wrap inside the proof browser.

## Scope

- Inspect the Runs proof-browser trace preview in a real browser.
- Tighten the preview event markup and CSS so each event keeps a stable
  sequence, body, timestamp, and finding lane.
- Keep the change focused on readability and layout stability.
- Add focused UI coverage for long trace metadata and hidden-event rows.
- Verify with Playwright before committing.

## Boundaries

- Do not redesign the dashboard or add new proof-browser features.
- Do not hide deterministic trace, evidence, or violation data.
- Do not alter trace grading, receipts, or artifact schemas.
- Do not read, source, print, or commit `.env*` or `.splunkready*` files.
- Do not use subagents.

## Acceptance

- Runs trace preview events remain ordered and readable with long IDs/tool refs.
- Hidden-event rows align with the event list instead of inheriting broken event
  grid structure.
- Focused UI tests pass.
- Playwright verifies the Runs view after the UI change.
- Full repository check passes before commit.
