# Move 97: Static Hosted Demo Request Hygiene

## Goal

Remove avoidable static-host 404 noise from the public MCP proof route so the
hosted demo behaves like a deliberate static export rather than a local
workbench trying to reach unavailable APIs and absent optional proof files.

## Scope

- Add per-artifact file manifests to the public demo export.
- Use artifact manifests in the Vite UI to load only proof files that are known
  to exist in a static bundle.
- Detect the public demo export manifest before probing local workbench
  `/api/*` endpoints.
- Keep the local workbench behavior unchanged when no public demo manifest is
  present.
- Verify the public MCP proof route with Playwright, including console and
  network inspection.

## Non-goals

- Do not remove local workbench APIs or executable workflows.
- Do not hide missing required proof artifacts from export audits.
- Do not read, source, print, or commit `.splunkready*` / `.env*` files.
- Do not make LLM, SAIA, or MCP output authoritative for pass/fail.
- Do not introduce Splunk write operations or auto-mutation.

## Expected verification

- `npx vitest run tests/ui/app.test.ts --testNamePattern "artifact manifests|static-host|normalizes artifact base"`
- `npx vitest run tests/scripts/public-demo-export.test.ts`
- `npm run public-demo:build && npm run audit:public-demo-export`
- Playwright open/snapshot/console/requests for
  `http://127.0.0.1:4340/?artifacts=artifacts%2Fmcp-proof&v=move97#mcp-proof`
- `npm run check`
- `git diff --check`
