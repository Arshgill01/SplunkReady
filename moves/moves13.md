# Move 13 - Improve Live Security Kit UX Without Mutation

## Goal

Reduce live demo friction by making the existing operator-owned security kit
clearer and easier to validate, without adding Splunk write automation.

## Scope

Expected files:

- live security kit generation code if needed
- workbench view for kit generation/inspection
- kit validation tests
- live setup docs only where needed for the app
- logs

## Plan

1. Add a backend job to generate the existing live security kit.
2. Render generated files and instructions in the UI.
3. Add validation that expected stanzas, saved-search names, indexes, and sample
   rows are present.
4. Label every installation/import step as operator-owned and outside
   SplunkReady.
5. Add warnings for existing Enterprise Security deployments.
6. Add cleanup guidance in the generated kit.

## Acceptance Criteria

- Workbench can generate and inspect the kit.
- SplunkReady performs no write operation.
- Instructions are clearer than the raw generated README alone.
- Kit validation catches missing or mismatched generated files.

## Verification

```bash
npx vitest run tests/cli/flow.test.ts tests/workbench
npm run splunkready -- live-security-kit --out <fresh-kit-dir>
npm run check
git diff --check
```

## Stop Conditions

- Stop before creating indexes, saved searches, apps, or events automatically.
- Stop before overwriting a real ES app.
- Stop before hiding operator responsibility.
