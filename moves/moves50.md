# Move 50: Package CLI Default Asset Resolution

## Trigger

The competitive audit called out Developer Tools and Platform & Developer
Experience friction: SplunkReady is stronger if a judge can run an obvious
command instead of needing to understand the repository layout first.

## Scope

- Add npm package bin metadata for a local `splunkready` command after build.
- Keep the package private; do not claim registry publication.
- Make default fixture, mission, suite, trace, and transcript inputs resolve
  from bundled package/repository assets when the CLI is run outside the repo
  root.
- Add a CLI regression that runs `judge-proof` from a temporary working
  directory outside the repository.
- Update README, logs, and move index.

## Boundaries

- Do not add a publishing workflow.
- Do not add new dependencies.
- Do not read, source, print, or commit `.env*` or `.splunkready*` files.
- Do not change UI source in this move; Playwright is not required.

## Acceptance

- `splunkready judge-proof --out <dir> --json` can use bundled default fixture
  paths after `npm run build` and package linking.
- The package remains private until publishing is explicitly handled.
- Focused CLI regression passes.
- Full repository check passes before commit.
