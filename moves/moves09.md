# Move 09 - Add SAIA Hosted-Model Workflow

## Goal

Expose the existing Splunk AI Assistant diagnostic/proof path through the
workbench when entitlement is actually available.

## Scope

Expected files:

- hosted-model workflow modules if extraction is needed
- workbench routes/jobs for diagnostic and proof
- UI hosted-model panel
- focused hosted-model tests
- logs

## Plan

1. Reuse existing `hosted-model-diagnostic` and `hosted-model-proof` behavior.
2. Add backend jobs:
   - hosted-model diagnostic;
   - hosted-model proof;
   - optional integration into live security proof only when artifacts prove it.
3. Show three states clearly:
   - unavailable because live env is absent;
   - blocked because SAIA entitlement is not active;
   - invoked successfully with explanation and optimized SPL.
4. Keep SAIA advisory-only. It never changes verdict or score.
5. Avoid raw `curl` probes; trust the adapter's JSON-RPC error handling.
6. Redact MCP errors and model metadata if needed.

## Acceptance Criteria

- Blocked entitlement is displayed truthfully and does not fail the whole app.
- Successful invocation shows the hosted tools and advisory output.
- No claim says SAIA graded the agent.
- No browser secret is required.

## Verification

```bash
npx vitest run tests/adapters/live.test.ts tests/cli/flow.test.ts tests/workbench
npm run build
npm run check
git diff --check
```

Live SAIA verification is conditional on entitlement.

## Stop Conditions

- Stop before calling Gemini a Splunk hosted model.
- Stop before treating token arrival alone as success.
- Stop before letting SAIA affect pass/fail.
