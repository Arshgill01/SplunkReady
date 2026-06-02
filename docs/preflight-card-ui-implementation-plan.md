# Pre-Flight Card UI Implementation Plan

Source: Minimax M3 side worktree `/private/tmp/splunkready-antigravity-ui-concepts-20260601-211055`.

Chosen prototype:

- `docs/ui-concepts/concept-b-preflight-card.html`
- screenshots: `docs/ui-concepts/screenshots/concept-b-fold.png` and `concept-b-full.png`
- supporting notes: `docs/ui-concepts/INTEGRATION-NOTES.md`

## Decision

Implemented in Wave 83 as the certification replay UI in `src/ui/shell.ts`.

The form is a single black-on-warm-card certification artifact with sections A through E:

- A Contract
- B Trace A - before patch
- C Deterministic rules
- D Policy patch
- E Trace B - after patch

This direction is intentionally not a dashboard, terminal cosplay, chatbot, SOC copilot, or fake live view. The implemented shell keeps the static artifact model, routes sidebar links to one visible top-level view at a time, and switches A-E Pre-Flight Card panes inside the replay card without changing the route.

## What To Keep From Minimax

- `$ splc verify --replay` invocation above the card.
- One outer card frame, with section dividers as hairline rules.
- Master readiness state in the title row.
- One `.tbl` shape for contract rows, trace rows, rules, and receipt summary.
- A narrow `.tbl.col-patch` variant for policy patch lines.
- Compile footer below the card with mode and artifact list.
- Negative UI guards: no fake live pulse, no real-time claims, no auto-mutate wording, no gradients, no glass, no transform hover effects, no emoji chrome.

## Integration Notes

- Prototype sample trace ids and evidence ids were not copied; the card renders loaded contract, mission, trace, violation, policy patch, receipt, and artifact path data.
- The integration updated the inline shell script in `src/ui/shell.ts`; no `src/ui/index.ts` boundary exists.
- The card renders the agent name/version from the receipt artifact instead of hardcoding a compiler package version.
- The existing route remains `splunkready-shell.html#certification-replay`.
- The sidebar is viewport-bound so route content height cannot stretch nav spacing.

## Implementation Files

- `src/ui/shell.ts`
- `tests/ui/shell.test.ts`
- `docs/demo-script.md` if narration needs to defend the printout/card aesthetic.
- `logs/execution-log.md`
- `logs/verification-log.md`

## Acceptance Checks

- The generated shell contains exactly one `replay-card` outer frame for the certification replay.
- The replay rail has A, B, C, D, E targets.
- Section A derives contract rows from `environment-contract.json`.
- Section B and E derive trace rows from real trace artifacts.
- Section C derives deterministic rule rows from real violation artifacts.
- Section D derives policy-patch rows from `policy-patch.json` / `.md` without implying auto-apply.
- The footer states fixture mode and no live Splunk mutation.
- Tests reject generic AI UI drift: gradients, glass, live pulse, real-time, auto-mutate, transform hover effects, negative letter spacing, emoji chrome, and fake charts.

## Rationale

The Pre-Flight Card is a stronger artifact for judges because it looks like a certification printout rather than another SaaS dashboard. It keeps the product centered on Readiness Receipts and deterministic trace evidence.
