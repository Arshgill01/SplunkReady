# Move 57: CI Verification Tool Install

## Trigger

GitHub Actions run `27027100008` failed because the Ubuntu runner did not have
`rg`, but `scripts/verify-scaffold.sh` requires ripgrep.

## Scope

- Install ripgrep in the repository CI workflow before `npm run check`.
- Add focused regression coverage so the workflow keeps installing the required
  verification tool.
- Update logs with the remote failure and local fix.

## Boundaries

- Do not change product runtime behavior.
- Do not add live Splunk or Gemini secrets to CI.
- Do not change UI source; Playwright is not required.
- Do not use subagents.

## Acceptance

- Focused CI workflow regression passes.
- The workflow installs ripgrep before running `npm run check`.
- Post-fix local scaffold and whitespace checks pass.
