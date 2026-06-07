# Move 158 - Live Readiness PR Gate

## Intent

Turn the credential-free live-mock proof into a first-class GitHub PR review
surface. This is not another CI log. Every pull request should be able to show a
stable SplunkReady Readiness comment with verdict, mutation boundary, proof loop,
scores, violations, policy, receipt files, and artifact paths.

## Scope

- Add a pull-request workflow that runs without Splunk credentials or Gemini
  secrets.
- Run `live-proof --live-mock` into a PR-gate artifact directory.
- Run `proof-audit` against the same proof directory and let the renderer fail
  closed on anything except the expected generic-live warning that this is not
  the flagship live-security proof.
- Render a deterministic markdown PR comment plus JSON summary.
- Upload the PR-gate artifact bundle.
- Post or update a single bot comment on pull requests when GitHub permissions
  allow it.
- Track a sample comment payload under `submission-evidence/ci-pr-gate/`.

## Non-Goals

- Do not call live Splunk.
- Do not use SAIA or hosted-model output as a verdict source.
- Do not make the workflow require secrets.
- Do not add a paid external service.
- Do not block pushes to `splunkready-build` on PR-comment permissions.

## Verification

- `npx vitest run tests/scripts/pr-gate-comment.test.ts tests/examples/repository-ci-workflow.test.ts`
- `npm run pr-gate:sample`
- `npm run check`
