# Move 171 - Standalone Release Matrix Proof

## Intent

Close the remaining all-platform standalone release evidence gap by dispatching
the GitHub Actions release-artifact matrix, fixing any runner-specific failures,
and only then allowing broader Linux/macOS/Windows standalone archive claims.

## Scope

- Run `.github/workflows/release-artifacts.yml` with `workflow_dispatch`.
- Inspect each matrix job for Linux, macOS, and Windows.
- Fix runner-specific release-builder failures exposed by the matrix.
- Preserve the current no-Node `judge-proof` smoke contract for every passing
  platform.
- Track verification evidence without committing generated binary archives.

## Non-Goals

- Do not create a public GitHub Release before the matrix is green.
- Do not tag a new version in this slice.
- Do not replace npm as the canonical public install path until release assets
  exist on a tag.
- Do not change readiness authority; deterministic rules remain authoritative.

## Expected Files

- `scripts/build-standalone-release.mjs`
- `tests/scripts/standalone-release.test.ts`
- `submission-evidence/standalone-release/standalone-release-current-os.json`
- `submission-evidence/evidence-pack-sha256.txt`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Verification

- `gh workflow run release-artifacts.yml --ref splunkready-build`
- `gh run watch <run-id> --exit-status`
- `gh run view <run-id> --job <job-id> --log`
- `npx vitest run tests/scripts/standalone-release.test.ts`
- `npm run build:standalone-release -- --evidence-out submission-evidence/standalone-release/standalone-release-current-os.json`
- `npm run audit:submission-copy`
- `git diff --check`
