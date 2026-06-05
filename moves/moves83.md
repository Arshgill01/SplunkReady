# Move 83: Netlify Static Demo Config

## Goal

Reduce the hosted-demo friction cap by making the public demo export directly
deployable as a static Netlify site.

## Scope

- Add `netlify.toml` at the repository root.
- Configure Netlify to run `npm run public-demo:build` and publish
  `artifacts/public-demo`.
- Add SPA fallback routing for hash/query-linked workbench views.
- Add basic security and immutable asset cache headers.
- Add a local Netlify deploy script that builds the public demo and runs a
  draft Netlify deploy when authentication is available.
- Ignore Netlify local state.
- Verify the generated publish directory in Playwright.

## Non-goals

- Do not claim a hosted URL unless deployment actually succeeds.
- Do not commit Netlify state, tokens, or environment variables.
- Do not read, source, print, or commit `.splunkready*` or `.env*` files.
- Do not add Netlify Functions, identity, billing, or production Splunk access.

## Expected verification

- `npm run public-demo:build`
- `npx vite --host 127.0.0.1 --port 4338 artifacts/public-demo`
- Playwright open/snapshot/screenshot for
  `http://127.0.0.1:4338/?artifacts=artifacts%2Fmcp-proof#mcp-proof`
- `npm run check`
- `git diff --check`
