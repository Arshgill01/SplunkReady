# ExecPlan: GitHub Release Currentness 0.1.6

Created: 2026-06-08

## Objective

Publish and verify public no-Node standalone assets for `v0.1.6` through the
existing GitHub Release workflow, then update judge-facing release evidence
without claiming npmjs `splunkready@0.1.6` currentness.

This closes a release-currentness gap left after GitHub Packages moved to
`0.1.6` while npmjs remained blocked by one-time password requirements.

## Success Criteria

- Tag `v0.1.6` points at the current `splunkready-build` source head used for
  the `0.1.6` package metadata.
- `.github/workflows/release-artifacts.yml` runs from tag `v0.1.6` and
  completes successfully.
- The public GitHub Release `v0.1.6` exists, is not draft, is not prerelease,
  and contains exactly these 9 assets:
  - `splunkready-linux-x64.tar.gz`
  - `splunkready-linux-x64.tar.gz.sha256`
  - `standalone-release-linux-x64.json`
  - `splunkready-macos-arm64.tar.gz`
  - `splunkready-macos-arm64.tar.gz.sha256`
  - `standalone-release-macos-arm64.json`
  - `splunkready-windows-x64.tar.gz`
  - `splunkready-windows-x64.tar.gz.sha256`
  - `standalone-release-windows-x64.json`
- Submission copy and evidence cite `v0.1.6` only for the GitHub Release
  standalone-assets path.
- README, Devpost, and claim ledger continue to state that public npmjs latest
  remains `splunkready@0.1.5` until OTP-backed publish succeeds.

## Expected Touched Files

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

## Verification Plan

- `git tag v0.1.6`
- `git push origin v0.1.6`
- `gh run list --workflow release-artifacts.yml --limit 5 --json ...`
- `gh run watch <run-id> --exit-status`
- `gh release view v0.1.6 --json tagName,name,url,isDraft,isPrerelease,publishedAt,assets`
- `gh release view v0.1.6 --json assets --jq '.assets[].name'`
- `npm run audit:submission-copy`
- `npx vitest run tests/scripts/submission-copy-audit.test.ts`
- regenerate and verify `submission-evidence/evidence-pack-sha256.txt`
- `git diff --check`
- `npm run check`

## Boundaries

- Do not claim public npmjs `splunkready@0.1.6` is published.
- Do not change the no-auth npm judge command from
  `npx -y splunkready@0.1.5 judge-proof --out ./judge-proof --json`.
- Do not mutate Splunk or require live credentials.
- Do not claim Homebrew support.

## Outcome

Completed on 2026-06-08 as Move 198.

- Tag `v0.1.6` points at commit
  `63e1092761c89604a10c7d0e0ceab714e111dfeb`.
- Release Artifacts workflow run `27150182301` completed successfully.
- Linux, macOS, and Windows standalone jobs each built and smoked the
  standalone archive with `judge-proof` returning `PASS` and `mutation: false`.
- The publish job created the public
  `https://github.com/Arshgill01/SplunkReady/releases/tag/v0.1.6` release with
  9 standalone assets.
- Public npmjs remains `splunkready@0.1.5`; the `v0.1.6` GitHub Release is a
  separate no-Node distribution path, not evidence of npmjs currentness.

## Residual Risk

GitHub emitted Node 20 deprecation warnings for `actions/upload-artifact@v4` and
`actions/download-artifact@v4`. The warnings did not block the release, but the
workflow should be moved to Node 24-compatible action versions or runner
settings in a future maintenance move.
