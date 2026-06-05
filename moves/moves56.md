# Move 56: Repository CI Canonical Gate

## Trigger

The Minimax 3 audit called out that SplunkReady has a reusable composite action
but no in-repository GitHub Actions workflow proving the canonical project gate.

## Scope

- Add a credential-free repository CI workflow.
- Run the existing canonical `npm run check` gate on Node 22.
- Add a regression that keeps the workflow pointed at the canonical gate and
  prevents accidental live secret usage.
- Update logs and risk notes.

## Boundaries

- Do not add live Splunk, Gemini, or `.splunkready*` secrets to CI.
- Do not publish packages or deploy public infrastructure.
- Do not change the composite action behavior.
- Do not change UI source; Playwright is not required.
- Do not use subagents.

## Acceptance

- `.github/workflows/ci.yml` runs on pull requests, pushes to
  `splunkready-build`, and manual dispatch.
- The workflow installs with `npm ci --ignore-scripts` and runs
  `npm run check` on Node 22.
- Focused workflow regression passes.
- Full repository checks pass.
