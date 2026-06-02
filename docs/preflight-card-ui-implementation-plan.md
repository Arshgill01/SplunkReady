# Pre-Flight Card UI Implementation Plan

Source: Minimax M3 side worktree `/private/tmp/splunkready-antigravity-ui-concepts-20260601-211055`.

Chosen prototype:

- `docs/ui-concepts/concept-b-preflight-card.html`
- screenshots: `docs/ui-concepts/screenshots/concept-b-fold.png` and `concept-b-full.png`
- supporting notes: `docs/ui-concepts/INTEGRATION-NOTES.md`

## Decision

Implement the refined Pre-Flight Card as the next certification replay UI.

The form is a single black-on-warm-card certification artifact with sections A through E:

- A Contract
- B Trace A - before patch
- C Deterministic rules
- D Policy patch
- E Trace B - after patch

This direction is intentionally not a dashboard, terminal cosplay, chatbot, SOC copilot, or fake live view.

## What To Keep From Minimax

- `$ splc verify --replay` invocation above the card.
- One outer card frame, with section dividers as hairline rules.
- Master readiness state in the title row.
- One `.tbl` shape for contract rows, trace rows, rules, and receipt summary.
- A narrow `.tbl.col-patch` variant for policy patch lines.
- Compile footer below the card with mode and artifact list.
- Negative UI guards: no fake live pulse, no real-time claims, no auto-mutate wording, no gradients, no glass, no transform hover effects, no emoji chrome.

## What To Change Before Integration

- Do not copy sample trace ids or evidence ids from the prototype. Render current fixture artifacts from `loadUiArtifacts`.
- Do not assume `src/ui/index.ts` exists; update the actual inline shell script and existing `[data-replay-target]` behavior in `src/ui/shell.ts`.
- Do not hardcode `Agent Readiness Compiler v0.1.0`; current `package.json` version is `0.0.0`. Either omit the version or render the package version deliberately.
- Keep existing route `splunkready-shell.html#certification-replay`.

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
