# Move 206 - MCP Proof Route Live Mock Schema Fix

## Status

Completed locally on 2026-06-08. Branch-tip CI pending after commit.

## Objective

Fix the public/installed workbench MCP proof route so the current tracked
`mcp-proof-summary.json` loads and renders the live mock Splunk MCP evidence
instead of failing artifact schema validation on `liveMockSplunkMcp`.

## Expected touched files

- `moves/moves206.md`
- `docs/execplans/mcp-proof-route-schema-drift.md`
- `ui/src/artifacts.ts`
- `ui/src/render.ts`
- `tests/ui/app.test.ts`
- `submission-evidence/screenshots/mcp-proof-route-live-mock.png`
- `submission-evidence/screenshots/mcp-proof-live-mock-panel.png`
- `submission-evidence/README.md`
- `submission-evidence/claim-ledger.md`
- `submission-evidence/evidence-pack-sha256.txt`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Verification

- `npx vitest run tests/ui/app.test.ts --testNamePattern "tracked MCP proof|MCP proof summary"`
- `npm run public-demo:build`
- Playwright opened
  `http://127.0.0.1:4175/?artifacts=artifacts%2Fmcp-proof#mcp-proof`,
  verified no artifact-load failure, and captured
  `submission-evidence/screenshots/mcp-proof-route-live-mock.png`.
- Playwright scrolled to the `Live mock Splunk MCP` panel and captured
  `submission-evidence/screenshots/mcp-proof-live-mock-panel.png`.
- `npx vitest run tests/ui/app.test.ts`
- `npm run audit:public-demo-export`
- `npm run check`
- branch-tip CI

## Boundaries

- Do not change the MCP proof generator contract unless the evidence contract is
  wrong.
- Do not add Playwright as a repository dependency.
- Do not write or expose Splunk credentials, endpoints, tokens, cookies, or raw
  operator inventory.
- Do not claim a closed desktop-client MCP session from this route proof; this
  move only fixes the first-class workbench presentation of tracked MCP
  evidence.
