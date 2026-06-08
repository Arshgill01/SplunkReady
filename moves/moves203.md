# Move 203 - Node 24 Artifact Workflow Durability

## Status

Implemented locally on 2026-06-08; branch-tip CI pending.

## Objective

Remove the remaining GitHub Actions Node 20 deprecation risk from artifact
upload/download workflows that protect the standalone release, setup-action,
and live-readiness PR gate evidence.

## Expected touched files

- `.github/workflows/release-artifacts.yml`
- `.github/workflows/live-certification-gate.yml`
- `tests/examples/repository-ci-workflow.test.ts`
- `moves/moves203.md`
- `docs/execplans/node24-artifact-workflows.md`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Verification

- `npx vitest run tests/examples/repository-ci-workflow.test.ts`
- `rg -n "actions/(upload-artifact|download-artifact)@v4" .github tests`
- `git diff --check`
- `npm run check`
- branch-tip CI

## Boundaries

- Do not change release artifact names, paths, or the 9-asset release contract.
- Do not change package version or public npm claims.
- Do not mutate live Splunk.
