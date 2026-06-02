# Wave 83 - Pre-Flight Card UI

## Goal

Implement the Minimax-derived Pre-Flight Card as the primary certification replay UI without turning SplunkReady into a generic dashboard, assistant, or long scrolling report.

## Scope

- Replace the Wave 81 forensic dossier replay treatment with a single Readiness Pre-Flight Card.
- Keep all UI claims backed by loaded contract, trace, violation, patch, receipt, or artifact-path data.
- Make sidebar navigation route between views instead of scrolling through one giant document.
- Make the A-E Pre-Flight Card rail switch one visible card pane at a time.
- Keep the surrounding shell flat: route panes should not be padded outer cards, and sidebar navigation should not use large card-like active blocks.
- Preserve the existing static shell artifact and fixture demo route `splunkready-shell.html#certification-replay`.

## Files Owned

- `src/ui/shell.ts`
- `tests/ui/shell.test.ts`
- `docs/preflight-card-ui-implementation-plan.md`
- `MANIFEST.md`
- `PLAN.md`
- `docs/implementation-handoff.md`
- `docs/waves/README.md`
- `docs/waves/wave-83-preflight-card-ui.md`
- `logs/execution-log.md`
- `logs/verification-log.md`
- relevant Wave 82 and Wave 83 reviewer inbox files and main-executor resolutions.

## Acceptance Criteria

- The certification replay renders exactly one `replay-card` outer frame.
- The Pre-Flight Card has A, B, C, D, and E controls.
- Only one Pre-Flight Card pane is visible at a time.
- Sidebar links switch top-level route panels without requiring the user to scroll through the whole shell.
- Sidebar spacing remains consistent across short and long routes; route content height must not stretch the rail.
- Non-replay route panes render on the brown receipt canvas without outer card frames.
- Section A derives contract rows from `environment-contract.json`.
- Sections B and E derive trace rows from real before/after trace artifacts.
- Section C derives deterministic rule rows from real violation artifacts.
- Section D derives policy patch rows from `policy-patch.json` without implying auto-apply.
- The footer states fixture mode and no live Splunk mutation.
- Tests reject generic UI drift: fake live state, real-time claims, auto-mutation wording, gradients, glass, transform hover effects, negative letter spacing, emoji chrome, fake charts, and dashboard/assistant drift.

## Verification

- `npx vitest run tests/ui/shell.test.ts`
- `npm run build`
- fixture demo generation through `npm run splunkready -- demo --out <tmp>`
- Playwright browser verification of route switching and A-E card pane switching
- `npm run check`
- `npm run audit:reviewers`
- `bash scripts/verify-scaffold.sh && git diff --check`

## Reviewer Checklist

- Does the replay route show a single Pre-Flight Card instead of a long scrapbook?
- Do sidebar links switch views at scroll position 0?
- Do A-E controls switch card panes without changing the URL?
- Are all card rows derived from real artifacts?
- Does the UI avoid fake live, auto-mutation, dashboard, assistant, gradient, glass, and emoji patterns?
- Are local browser artifacts cleaned before closeout?

## Stop Conditions

- The UI implies live execution, real-time state, or Splunk mutation that the product does not perform.
- A Pre-Flight Card pane uses hardcoded prototype trace ids or evidence ids instead of loaded artifacts.
- Sidebar navigation leaves the user buried in a long scroll document.
- A-E card controls mutate the top-level route or scroll the page.
- Local Playwright state remains untracked in the repo at closeout.
