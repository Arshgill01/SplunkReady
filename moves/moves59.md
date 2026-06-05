# Move 59: Workbench CI Timeout Stabilization

## Trigger

The pushed GitHub Actions `npm run check` gate failed after Move 58 on the
Vite dev-shell workbench test. The local full gate had passed, and the hosted
failure was isolated to the test's 15 second timeout.

## Scope

- Stabilize the exact failing workbench server test on slower hosted runners.
- Keep the change limited to test harness timing.

## Boundaries

- Do not change UI source or product behavior.
- Do not read, source, print, or commit `.env*` or `.splunkready*` files.
- Do not use subagents.

## Acceptance

- The focused failing workbench server test passes locally.
- The full canonical `npm run check` gate passes locally.
- The branch is pushed so hosted CI can rerun the same canonical gate.
