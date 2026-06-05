# Move 52: GitHub Action Diagnostics Output

## Trigger

Move 51 added compiler diagnostics to the suite proof, but GitHub Action users
still have to know where to find that artifact inside the proof directory.

## Scope

- Add a `diagnostics-path` output to the composite GitHub Action.
- Make the action runner compute the primary diagnostics path for each mode.
- Render the diagnostics path in the GitHub job summary.
- Keep credential-free behavior and existing gate modes unchanged.
- Add focused CI runner coverage.
- Update README, move index, execution log, and verification log.

## Boundaries

- Do not add live credentials or live security proof to the action.
- Do not make LLM/SAIA output authoritative.
- Do not change UI source in this move; Playwright is not required.
- Do not read, source, print, or commit `.env*` or `.splunkready*` files.

## Acceptance

- `action.yml` exposes `diagnostics-path`.
- `src/ci/github-action.ts` writes `diagnostics-path` to `GITHUB_OUTPUT`.
- The step summary includes the diagnostics path.
- Focused CI runner tests pass.
- Full repository check passes before commit.
