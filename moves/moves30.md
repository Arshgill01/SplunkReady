# Move 30 - Workbench Response Security Headers

## Goal

Add conservative browser security headers to the local workbench server so the
packaged UI and API present a stronger security posture without changing
workflow behavior.

## Scope

Expected files:

- `src/workbench/server.ts`
- `tests/workbench/server.test.ts`
- `moves/README.md`
- logs

## Plan

1. Add a small server-side helper that applies safe response headers before API,
   packaged UI, or dev UI handling.
2. Keep headers conservative:
   - prevent MIME sniffing;
   - avoid referrer leakage;
   - keep resources same-origin;
   - deny framing.
3. Add real HTTP regression checks for API and static UI responses.

## Acceptance Criteria

- `/api/health` includes the hardening headers.
- Packaged static UI responses include the hardening headers.
- Existing fixture certification and artifact routes still work through the
  same local origin.
- No new dependency is introduced.
- No secret env file is read, sourced, printed, or committed.

## Verification

```bash
npm test -- tests/workbench/server.test.ts
npm run check
git diff --check
```

## Stop Conditions

- Stop before adding CSP rules that break Vite dev middleware or packaged module
  loading.
- Stop before changing API route behavior or artifact content.
- Stop before reading `.splunkready*`, `.env`, or other secret-bearing files.
