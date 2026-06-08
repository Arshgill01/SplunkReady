# ExecPlan: Node 24 Artifact Workflows

## Goal

Move SplunkReady's artifact upload/download workflows off GitHub Actions'
deprecated Node 20 artifact actions without changing release artifact shape.

## Evidence

- `actions/upload-artifact@v6` runs on Node.js 24 and is the conservative
  default-runtime bump for upload-artifact.
- `actions/download-artifact@v7` runs on Node.js 24 and avoids the newer
  `v8` download behavior changes that are unnecessary for SplunkReady's
  multi-artifact release job.

## Scope

Update:

- `.github/workflows/release-artifacts.yml`
- `.github/workflows/live-certification-gate.yml`
- `tests/examples/repository-ci-workflow.test.ts`

## Validation

1. Focused repository workflow test.
2. Search proving no artifact action remains pinned to `@v4`.
3. `git diff --check`.
4. `npm run check`.
5. Branch-tip CI after commit and push.

## Risks

- GitHub-hosted runners satisfy the Node 24 runner requirement; self-hosted
  runners would need Actions Runner `2.327.1` or newer.
- The release contract still depends on exactly 9 release assets. This move
  must not change artifact file names or publish logic.
