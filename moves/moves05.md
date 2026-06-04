# Move 05 - Build The Local Workbench Backend

## Goal

Create a dedicated local backend process for the SplunkReady Workbench. This is
the missing product layer that makes the UI executable instead of a read-only
artifact viewer.

## Scope

Expected files:

- `src/workbench/server.ts`
- `src/workbench/routes.ts`
- `src/workbench/config.ts`
- `src/workbench/redaction.ts`
- package scripts such as `workbench:dev`
- Vite integration or a standalone local server
- backend tests
- logs

Prefer Node built-ins first. Add a server dependency only if it materially
reduces risk and the user approves it.

## Plan

1. Create a localhost-only HTTP server.
2. Serve API routes under `/api/*`.
3. Serve the Vite dev app in development and the built UI in local packaged
   mode later.
4. Add server-side configuration:
   - managed artifact root;
   - max concurrent jobs;
   - live mode enabled/disabled based on server env;
   - redaction policy.
5. Add a health endpoint returning version, mode capability, artifact root, and
   live/SAIA availability without secrets.
6. Add allowlist routing. No arbitrary command names or shell strings.
7. Add request size limits and simple localhost-origin checks.

## Acceptance Criteria

- `npm run workbench:dev` starts a local backend and frontend.
- `/api/health` works and leaks no secrets.
- Unknown routes return structured errors.
- The backend cannot execute arbitrary CLI commands.
- The backend cannot write outside the managed artifact root.

## Verification

```bash
npx vitest run tests/workbench
npm run build
npm run ui:build
npm run check
git diff --check
```

Use browser automation to open the workbench and confirm health status renders.

## Stop Conditions

- Stop before browser-supplied credentials.
- Stop before generic CLI-over-HTTP.
- Stop before binding to non-local interfaces by default.
