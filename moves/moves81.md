# Move 81: Public Demo Static Export

## Goal

Reduce the no-hosted-demo cap by making the current workbench and
credential-free evidence exportable as one static folder.

## Scope

- Add a `public-demo:build` script that builds the Vite workbench and exports
  it to `artifacts/public-demo`.
- Copy only tracked, credential-free evidence into the export:
  `mcp-proof`, `suite-proof`, `public-proof-export`, and screenshots.
- Write a `public-demo-manifest.json` with the default MCP proof URL and
  no-mutation posture.
- Refuse symlinks during export so ignored secret files cannot be smuggled into
  the static bundle.
- Let optional artifact loads tolerate static-host SPA fallback HTML.
- Verify the generated static export in Playwright.

## Non-goals

- Do not deploy to an external host in this move.
- Do not publish the npm package.
- Do not read, source, print, or commit `.splunkready*` or `.env*` files.
- Do not change deterministic grading or Splunk mutation boundaries.

## Expected verification

- `npx tsc --noEmit`
- `npx vitest run tests/scripts/public-demo-export.test.ts`
- `npx vitest run tests/ui/app.test.ts tests/scripts/public-demo-export.test.ts --testNamePattern "MCP proof|static-host|public demo"`
- `npm run public-demo:build`
- `npx vite --host 127.0.0.1 --port 4338 artifacts/public-demo`
- Playwright open/snapshot/screenshot for
  `http://127.0.0.1:4338/?artifacts=artifacts%2Fmcp-proof#mcp-proof`
- `npm run check`
- `git diff --check`
