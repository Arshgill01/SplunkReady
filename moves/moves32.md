# Move 32 - Workbench No-Store Responses

## Goal

Prevent browser caching of local proof and workbench responses served by the
operator-owned workbench.

## Scope

Expected files:

- `src/workbench/server.ts`
- `tests/workbench/server.test.ts`
- `moves/README.md`
- logs

## Plan

1. Add a conservative no-store cache header to the shared workbench browser
   hardening boundary.
2. Extend existing HTTP header regressions so API, packaged UI, dev UI, missing
   artifact shims, and fallback errors inherit the same assertion.

## Acceptance Criteria

- Workbench API and UI responses include `cache-control: no-store`.
- Existing response security headers remain unchanged.
- No workflow semantics, status codes, Splunk behavior, or browser secret inputs
  change.
- No secret env file is read, sourced, printed, or committed.

## Verification

```bash
npm test -- tests/workbench/server.test.ts
npm run check
git diff --check
```

## Stop Conditions

- Stop before changing artifact contents, redaction behavior, or workbench
  workflow semantics.
- Stop before adding a new dependency.
- Stop before reading `.splunkready*`, `.env`, or other secret-bearing files.
