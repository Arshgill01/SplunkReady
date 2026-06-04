# Move 10 - Add External Trace And Transcript Certification UI

## Goal

Make Platform & Developer Experience visible in the app by letting users certify
external agent traces and MCP transcripts from the workbench.

## Scope

Expected files:

- workflow extraction for `grade-trace` and `certify-mcp-transcript`
- upload/parsing routes with size limits
- UI import/certify view
- example docs only as needed for the UI
- tests
- logs

## Plan

1. Add backend jobs for:
   - canonical `TraceEvent[]` upload;
   - MCP JSONL transcript upload with appended final-answer record;
   - strict import and require-pass options.
2. Compile the required contract server-side before grading when needed.
3. Validate uploads with existing schemas and return actionable errors.
4. Show transcript import boundaries:
   - known read-only MCP tools;
   - strict import checks structure, not readiness;
   - final answer remains producer-provided.
5. Render the resulting receipt, violations, proof audit, and manifest in the
   same artifact browser as fixture runs.
6. Avoid "SDK" language unless a real package surface is built.

## Acceptance Criteria

- A sample external trace can be uploaded and certified from UI.
- A sample MCP transcript can be uploaded and certified from UI.
- Wrong mission and malformed trace errors are understandable.
- Resulting artifacts are auditable and persisted under the managed root.

## Verification

```bash
npx vitest run tests/examples/external-trace.test.ts tests/cli/flow.test.ts tests/workbench tests/ui/app.test.ts
npm run build
npm run check
git diff --check
```

Use browser automation to upload the sample pass and fail artifacts.

## Stop Conditions

- Stop before accepting unbounded uploads.
- Stop before implying producer-supplied evidence is independently verified.
- Stop before claiming an SDK.
