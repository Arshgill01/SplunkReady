# Move 59: Workbench CI Timeout Stabilization

## Trigger

The pushed GitHub Actions `npm run check` gate failed after Move 58 on the
Vite dev-shell workbench test. Raising the timeout still failed on hosted CI,
which showed the test was hanging in real Vite middleware startup under the
full-suite runner, not exercising product logic.

## Scope

- Stabilize the exact failing workbench server test on hosted runners.
- Keep the change limited to the test harness.
- Use the existing `devUiServer` seam to validate shared-origin dev UI routing
  without starting real Vite inside the full-suite server test.

## Boundaries

- Do not change UI source or product behavior.
- Do not read, source, print, or commit `.env*` or `.splunkready*` files.
- Do not use subagents.

## Acceptance

- The focused dev UI workbench server test passes locally.
- The full canonical `npm run check` gate passes locally.
- The branch is pushed so hosted CI can rerun the same canonical gate.
