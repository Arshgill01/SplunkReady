# Move 14 - Add Certification Index Workbench

## Goal

Make multi-proof certification visible in the app by generating and browsing the
certification index from selected proof bundles.

## Scope

Expected files:

- certification-index workflow extraction if needed
- backend job for index generation
- UI index view
- tests
- logs

## Plan

1. Let users select existing proof runs from the managed artifact store.
2. Generate a certification index across selected runs.
3. Show pass/fail summary, domains, missions, verdicts, mutation posture, and
   manifest status.
4. Link index entries back to receipts and traces.
5. Reject stale or unverifiable bundles with clear errors.

## Acceptance Criteria

- Multiple proof runs can be indexed from UI.
- Index output is persisted and browsable.
- Failed/stale bundles do not silently enter the index.
- The ledger strengthens the platform story beyond a single demo run.

## Verification

```bash
npx vitest run tests/cli/flow.test.ts tests/workbench tests/ui/app.test.ts
npm run build
npm run check
git diff --check
```

## Stop Conditions

- Stop before indexing unmanaged filesystem paths.
- Stop if index status can disagree with proof-audit status.
- Stop before presenting an index as proof when constituent manifests fail.
