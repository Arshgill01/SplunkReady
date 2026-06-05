# Move 29 - Workbench Route Error Redaction

## Goal

Ensure all workbench API error responses use the same secret redaction boundary
as job execution errors.

## Scope

Expected files:

- `src/workbench/routes.ts`
- `tests/workbench/workbench.test.ts`
- `moves/README.md`
- logs

## Plan

1. Route outer API catch blocks through `redactUnknownError`.
2. Add a regression test that forces a route-level failure containing a secret
   and verifies the JSON response redacts it.
3. Preserve existing structured error codes and HTTP status behavior.

## Acceptance Criteria

- Workbench route errors no longer return raw `error.message`.
- A route-level failure containing a bearer token redacts the token in the API
  response.
- Job execution redaction remains unchanged.
- No secret env file is read, sourced, printed, or committed.

## Verification

```bash
npm test -- tests/workbench/workbench.test.ts
npm run check
git diff --check
```

## Stop Conditions

- Stop before changing public workflow behavior or adding new API routes.
- Stop before hiding useful non-sensitive structured error codes.
- Stop before reading `.splunkready*`, `.env`, or other secret-bearing files.
