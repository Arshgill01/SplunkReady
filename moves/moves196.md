# Move 196 - Retry Public npm Publish Boundary

## Status

Completed on 2026-06-08.

## Objective

Recheck whether the prepared `splunkready@0.1.6` public npm release can be
published after Move 195, and keep the public-package evidence honest if npm
still requires operator OTP.

## Expected touched files

- `moves/moves196.md`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Verification

- `npm view splunkready version dist-tags.latest gitHead --json`
- `npm run audit:npm-release-preflight -- --require-ready`
- `npm publish --access public`
- `npm run audit:public-package-currentness -- --out submission-evidence/public-package-currentness`
- `git diff --check`

## Boundaries

- Do not claim `splunkready@0.1.6` is public unless `npm publish` succeeds and
  public package currentness returns `CURRENT`.
- Keep README, Devpost copy, GitHub Packages, and GitHub Release claims pinned
  to `0.1.5` while npm latest remains `0.1.5`.
- Do not bypass npm OTP requirements.

## Result

- Release preflight still reports `READY` for `splunkready@0.1.6`.
- `npm publish --access public` is still blocked by npm `EOTP`.
- Public package currentness remains `STALE` with npm latest
  `splunkready@0.1.5`, local source `0.1.6`, and published `0.1.5`
  judge-proof, MCP, live-mock, recorder, and policy-registry probes passing.
- Sent a `cmux notify` message requesting a fresh operator OTP.
