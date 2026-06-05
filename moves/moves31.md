# Move 31 - Workbench Server Fallback Redaction

## Goal

Apply the workbench secret-redaction boundary to server-level fallback errors,
not only job execution and API route errors.

## Scope

Expected files:

- `src/workbench/server.ts`
- `tests/workbench/server.test.ts`
- `moves/README.md`
- logs

## Plan

1. Redact errors returned by dev-UI middleware fallback handling.
2. Redact errors returned by the top-level workbench server request catch.
3. Add focused HTTP tests using an injected middleware seam so route behavior is
   exercised without adding a dependency or external service.

## Acceptance Criteria

- Dev-UI middleware fallback errors redact bearer tokens before reaching the
  browser.
- Top-level server fallback errors redact sensitive strings before reaching the
  browser.
- Existing packaged UI and API workflows remain unchanged.
- No secret env file is read, sourced, printed, or committed.

## Verification

```bash
npm test -- tests/workbench/server.test.ts
npm run check
git diff --check
```

## Stop Conditions

- Stop before changing workbench workflow semantics or API status codes.
- Stop before adding a new dependency.
- Stop before reading `.splunkready*`, `.env`, or other secret-bearing files.
