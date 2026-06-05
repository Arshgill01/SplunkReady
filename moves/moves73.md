# Move 73: CI Node 24 Actions Runtime

## Trigger

GitHub CI is passing, but hosted runs still emit the Node.js 20 Actions
deprecation annotation for `actions/checkout@v4` and `actions/setup-node@v4`.
For a developer-experience submission, a green check with an avoidable warning
is still friction.

## Scope

- Upgrade repository CI to `actions/checkout@v5` and `actions/setup-node@v5`,
  which target the Node 24 JavaScript Actions runtime.
- Keep the project runtime on Node 22 through `actions/setup-node`.
- Extend the repository CI workflow regression to require the Node-24-native
  action versions and reject the force-env fallback.

## Boundaries

- Do not add secrets to CI.
- Do not change the canonical gate command.
- Do not change product runtime behavior, package behavior, grading authority,
  fixture/live parity, or UI source.
- Do not use subagents.

## Acceptance

- `.github/workflows/ci.yml` uses `actions/checkout@v5` and
  `actions/setup-node@v5`.
- Focused repository CI workflow regression passes.
- Full repository checks pass.
- Hosted GitHub CI passes without the Node 20 deprecation annotation.
