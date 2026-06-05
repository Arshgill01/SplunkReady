# Move 98: GitHub Pages Node 24 Actions Runtime

## Goal

Remove the GitHub-owned Pages workflow Node 20 deprecation annotation by moving
the public demo deployment workflow to current Pages action tags instead of
using an environment fallback.

## Scope

- Verify current upstream tags for GitHub Pages actions.
- Upgrade `actions/configure-pages`, `actions/upload-pages-artifact`, and
  `actions/deploy-pages` in `.github/workflows/public-demo-pages.yml`.
- Keep the project runtime on Node 22.
- Keep the public demo workflow manual and credential-free.
- Extend workflow regression coverage for the updated Pages action versions.
- Run the manual Pages workflow after push and record whether the Node 20
  annotation is gone.

## Non-goals

- Do not change CI's canonical `npm run check` command.
- Do not add workflow secrets or deployment credentials.
- Do not change UI source, public demo artifact behavior, grading authority,
  fixture/live parity, or Splunk mutation boundaries.
- Do not read, source, print, or commit `.splunkready*` / `.env*` files.

## Expected verification

- `git ls-remote --tags https://github.com/actions/configure-pages.git 'refs/tags/v*'`
- `git ls-remote --tags https://github.com/actions/upload-pages-artifact.git 'refs/tags/v*'`
- `git ls-remote --tags https://github.com/actions/deploy-pages.git 'refs/tags/v*'`
- `npx vitest run tests/examples/repository-ci-workflow.test.ts`
- `npm run check`
- `git diff --check`
- `gh run watch <ci-run-id> --exit-status`
- `gh workflow run "Public Demo Pages" --ref splunkready-build`
- `gh run watch <pages-run-id> --exit-status`
