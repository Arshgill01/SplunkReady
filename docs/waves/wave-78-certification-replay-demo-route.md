# Wave 78 - Certification Replay Demo Route

## Goal

Make the official fixture demo open on the evidence-backed certification replay added in Wave 77, so the creative demo hook is part of the judge path rather than hidden UI polish.

## Scope

- Change demo rehearsal metadata from the older rerun-receipts close route to `splunkready-shell.html#certification-replay`.
- Update the living demo, README, and submission instructions to use the certification replay as the primary closeout route.
- Keep the before/after receipt comparison as supporting evidence in the same static shell.
- Add regression coverage that the generated demo route targets the replay and the shell contains the replay section.

## Files Owned

- `src/cli.ts`
- `tests/cli/flow.test.ts`
- `README.md`
- `docs/demo-script.md`
- `docs/devpost-submission.md`
- `docs/waves/README.md`
- `docs/waves/wave-78-certification-replay-demo-route.md`
- `MANIFEST.md`
- `PLAN.md`
- `docs/implementation-handoff.md`
- `logs/execution-log.md`
- `logs/verification-log.md`
- reviewer inbox files if new Wave 78 findings arrive.

## Acceptance Criteria

- `npm run splunkready -- demo --out <dir>` writes `demo-rehearsal.json.uiRoute` ending in `#certification-replay`.
- `demo-rehearsal.md` points at the same replay route.
- The generated UI shell still contains both `id="certification-replay"` and `id="rerun-receipts"`.
- User-facing run instructions name the replay route and preserve the product boundaries: no fake live execution, no Splunk mutation, no chatbot/copilot framing.
- Focused CLI tests and broad checks pass before commit.

## Verification

- `npx vitest run tests/cli/flow.test.ts`
- `npm run build`
- `npm run check`
- `npm run audit:reviewers`
- `bash scripts/verify-scaffold.sh && git diff --check`

## Reviewer Checklist

- Does the demo route now make the Wave 77 creative replay the first judge-facing closeout view?
- Does the route change avoid implying live Splunk execution?
- Does the UI still preserve the Readiness Receipt as the primary artifact?
- Do docs and CLI metadata agree on the route?

## Stop Conditions

- The wave introduces fake live telemetry or animation claims.
- The wave makes the demo depend on live Splunk credentials.
- The wave hides the before/after Readiness Receipts.
- The wave changes pass/fail semantics.
