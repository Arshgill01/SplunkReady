# Move 172 - Public GitHub Release Assets

## Intent

Turn the proven standalone release matrix into a public GitHub Release for the
current package version without creating a version mismatch with the already
published npm package.

## Scope

- Harden `.github/workflows/release-artifacts.yml` so tag publication happens in
  one post-matrix job instead of concurrently from every matrix runner.
- Add release notes/changelog context for `v0.1.3`.
- Tag the current verified release commit as `v0.1.3`.
- Let the tag-triggered workflow build, smoke, and publish Linux, macOS, and
  Windows standalone assets.
- Track public-safe release evidence after the workflow succeeds.

## Non-Goals

- Do not change the package version in this move.
- Do not publish npm from this environment.
- Do not claim Homebrew support.
- Do not claim hosted-model PASS.
- Do not change deterministic readiness authority.

## Expected Files

- `.github/workflows/release-artifacts.yml`
- `CHANGELOG.md`
- `tests/examples/repository-ci-workflow.test.ts`
- `moves/moves172.md`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`
- `submission-evidence/standalone-release/` after tag workflow evidence exists
- `submission-evidence/claim-ledger.md` after tag workflow evidence exists
- `submission-evidence/evidence-pack-sha256.txt` after tag workflow evidence
  exists

## Verification

- `npx vitest run tests/examples/repository-ci-workflow.test.ts`
- `npm run audit:submission-copy`
- `npm run check`
- `git tag -a v0.1.3 -m "SplunkReady v0.1.3"`
- `git push origin v0.1.3`
- `gh run watch <release-run-id> --exit-status`
- `gh release view v0.1.3 --json tagName,name,url,assets`
