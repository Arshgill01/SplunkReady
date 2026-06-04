# Move 19 - Add Public Proof Export From Workbench

## Goal

Let the workbench produce a sanitized, portable proof bundle that can be shared
without leaking local deployment details.

## Scope

Expected files:

- export workflow
- backend export route/job
- redaction helpers
- UI export action
- tests
- logs

## Plan

1. Define an export manifest with source run ID, source commit, files included,
   redaction status, and hashes.
2. Redact tokens, private endpoints, private IPs, user paths, and raw MCP error
   bodies.
3. Include receipts, trace excerpts, proof audit, manifest, policy patch, and
   summary.
4. Validate exported JSON against schemas.
5. Let the UI download or open the export directory.
6. Clearly label exported evidence as redacted.

## Acceptance Criteria

- A fixture proof export can be produced from UI.
- A live proof export can be produced without secrets when live artifacts exist.
- Export hashes verify after redaction.
- Exported evidence is enough for someone else to inspect the run.

## Verification

```bash
npx vitest run tests/workbench tests/cli/flow.test.ts
npm run check
git diff --check
```

Run a tracked-secret scan over a generated export.

## Stop Conditions

- Stop before exporting raw live artifacts.
- Stop if redaction changes hashes without regenerating manifests.
- Stop before claiming exported proof is the unredacted source bundle.
