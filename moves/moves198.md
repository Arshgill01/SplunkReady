# Move 198 - Public GitHub Release Currentness

## Status

Completed on 2026-06-08.

## Objective

Publish and verify a current public `v0.1.6` GitHub Release with no-Node
standalone assets for Linux, macOS, and Windows while keeping public npmjs
claims honestly pinned to `splunkready@0.1.5` until npm OTP publish succeeds.

## Expected touched files

- `docs/execplans/release-currentness-0.1.6.md`
- `moves/moves198.md`
- `README.md`
- `docs/devpost-submission.md`
- `submission-evidence/README.md`
- `submission-evidence/claim-ledger.md`
- `submission-evidence/standalone-release/standalone-release-github-release.json`
- `submission-evidence/evidence-pack-sha256.txt`
- `scripts/audit-submission-copy.mjs`
- `tests/scripts/submission-copy-audit.test.ts`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Verification

- `git tag v0.1.6`
- `git push origin v0.1.6`
- `gh run watch 27150182301 --exit-status`
- `gh release view v0.1.6 --json tagName,name,url,isDraft,isPrerelease,publishedAt,assets`
- `gh release view v0.1.6 --json assets --jq '.assets[].name'`
- `npm run audit:submission-copy`
- `npx vitest run tests/scripts/submission-copy-audit.test.ts`
- evidence-pack SHA-256 regeneration and verification
- `git diff --check`
- `npm run check`

## Boundaries

- Do not claim npmjs `splunkready@0.1.6` is public.
- Do not change the unauthenticated npm judge command away from
  `npx -y splunkready@0.1.5 judge-proof --out ./judge-proof --json`.
- Do not claim Homebrew support.
- Do not mutate live Splunk.

## Result

- Created and pushed tag `v0.1.6` at
  `63e1092761c89604a10c7d0e0ceab714e111dfeb`.
- Release Artifacts workflow run `27150182301` passed.
- The Linux, macOS, and Windows standalone jobs all completed `Build and smoke
  standalone artifact` successfully, with package version `0.1.6`,
  `judge-proof` `PASS`, 67 smoke artifacts, and `mutation: false`.
- The publish job uploaded the public GitHub Release assets to
  `https://github.com/Arshgill01/SplunkReady/releases/tag/v0.1.6`.
- `gh release view v0.1.6` reports `isDraft: false`, `isPrerelease: false`,
  and 9 assets: three archives, three SHA-256 checksum files, and three
  per-platform manifests.
- `npm run check` passed locally after the evidence refresh: 76 Vitest files /
  441 tests plus the full audit chain.
- Public npmjs still remains `splunkready@0.1.5`; this move only updates the
  public GitHub Release standalone-assets path.
