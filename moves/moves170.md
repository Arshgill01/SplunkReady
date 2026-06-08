# Move 170 - Standalone Release Artifact Smoke

## Intent

Reduce judge and developer setup friction by making the postponed Move 160
standalone executable path real for the current OS, while guarding all-platform
release claims until the tag workflow builds and smokes those assets on each
runner.

## Scope

- Add a reproducible standalone release builder using Node SEA packaging.
- Bundle the CLI into a single injected script and inject it into the current
  Node runtime with `postject`.
- Archive the generated executable and checksum it.
- Smoke the archive from a clean temp folder with `judge-proof`.
- Add a tag-triggered GitHub Release workflow that builds and smokes artifacts
  on Linux, macOS, and Windows runners.
- Track public-safe current-OS smoke evidence.

## Non-Goals

- Do not claim every platform has passed until the release workflow runs on a
  tag or workflow dispatch and each matrix job is green.
- Do not replace npm as the canonical install path.
- Do not add Homebrew until GitHub Release assets are observed and current.
- Do not change readiness authority: deterministic rules remain the only
  pass/fail judge.

## Expected Files

- `scripts/build-standalone-release.mjs`
- `.github/workflows/release-artifacts.yml`
- `tests/scripts/standalone-release.test.ts`
- `package.json`
- `package-lock.json`
- `submission-evidence/standalone-release/standalone-release-current-os.json`
- `submission-evidence/claim-ledger.md`
- `submission-evidence/evidence-pack-sha256.txt`
- `README.md`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Verification

- `npm run build:standalone-release -- --evidence-out submission-evidence/standalone-release/standalone-release-current-os.json`
- `npx vitest run tests/scripts/standalone-release.test.ts`
- `npm run audit:submission-copy`
- `npm run check`
