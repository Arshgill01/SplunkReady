# Move 192 - Restore Public Package Currentness After Zed Evidence

## Status

Completed as an OTP-blocked release-currentness record on 2026-06-08.

## Objective

Verify and restore public package currentness after Move 191 changed tracked MCP evidence and audit guardrails. The target is for the public npm package to match the current package-input source, pass the public package currentness audit, and keep public submission copy aligned with the version that is actually published.

## Expected touched files

- `moves/moves192.md`
- `submission-evidence/public-package-currentness/public-package-currentness.json`
- `submission-evidence/claim-ledger.md`
- `submission-evidence/evidence-pack-sha256.txt`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

If publication succeeds, likely also:

- `README.md`
- `docs/devpost-submission.md`
- `submission-evidence/github-package-currentness/*`
- `submission-evidence/standalone-release/*`

## Verification

- `npm view splunkready version dist-tags.latest gitHead --json`
- `npm run audit:public-package-currentness -- --out submission-evidence/public-package-currentness`
- `npm run audit:npm-release-preflight -- --require-ready`
- `npm publish --access public` if preflight passes and npm authentication allows it.
- `npm run audit:public-package-currentness -- --require-current --out submission-evidence/public-package-currentness` after publish.
- `npm run audit:submission-copy`
- evidence-pack SHA-256 regeneration and verification.
- `npm run check` before commit when tracked evidence/copy changes.

## Boundaries

- Do not claim `0.1.6` is public until `npm view splunkready version` and currentness evidence prove it.
- If npm requires OTP, stop and ask for operator input; do not fake currentness by weakening the audit.
- Do not mutate Splunk.

## Result

- Verified npm latest is still `splunkready@0.1.5` with gitHead
  `a79ee9e9de60b709d2110703004bbe9b1fedc373`.
- Re-ran public package currentness and tracked the honest `STALE` evidence:
  public `0.1.5` judge-proof, MCP, live-mock proof, recorder, and policy
  registry checks still pass, but local source is `0.1.6` and does not match
  npm latest.
- Re-ran npm release preflight for `0.1.6`; it reports `READY` and npm auth
  user `brightybrainiac`.
- Attempted `npm publish --access public`; npm rejected it with `EOTP`.
- Updated the submission claim ledger and submission-copy audit guard so they
  now enforce the correct blocked state: public package surfaces work at
  `0.1.5`, but `0.1.6` must not be called current until an OTP-backed publish
  succeeds and `audit:public-package-currentness -- --require-current` passes.

## Claim Boundary

The public no-clone path remains available through `splunkready@0.1.5`. The
current source release is prepared as `0.1.6`, but public currentness is blocked
on operator OTP. Do not update README, Devpost, GitHub Packages, GitHub Release,
or standalone public-current claims to `0.1.6` until the publish and follow-up
currentness audit succeed.
