# Move 123 - Hosted-Model Blocker Evidence

Status: implemented

## Goal

Make hosted-model and SAIA failures actionable instead of generic. When the live
Splunk MCP endpoint advertises SAIA tools but route invocation fails, the proof
should produce a stable blocker class and expose it through the CLI diagnostic,
MCP tool output, tracked MCP proof, and public workbench route.

## Scope

- Add a stable hosted-model blocker class to hosted-model diagnostics:
  `NONE`, `LIVE_CONFIG_MISSING`, `SAIA_TOOLS_NOT_ADVERTISED`,
  `SAIA_ROUTE_NOT_FOUND`, `SAIA_ACTION_FORBIDDEN`, and
  `SAIA_INVOCATION_BLOCKED`.
- Return the blocker class from `splunkready_check_hosted_model_access`.
- Surface hosted-model blocker fields in the MCP proof summary and Vite
  workbench.
- Keep SAIA advisory-only and deterministic rules authoritative.
- Update the live setup checklist with the current route-not-found interpretation.
- Regenerate credential-free MCP proof and public demo artifacts.

## Files Changed

- `src/workflows/hosted-model-actions.ts`
- `src/workflows/mcp-proof.ts`
- `src/mcp/server.ts`
- `ui/src/artifacts.ts`
- `ui/src/render.ts`
- `tests/workflows/hosted-model-actions.test.ts`
- `tests/cli/flow.test.ts`
- `tests/mcp/server.test.ts`
- `tests/ui/app.test.ts`
- `docs/live-setup-checklist.md`
- `submission-evidence/mcp-proof/*`

## Verification

- `npx tsc --noEmit && npx vitest run tests/workflows/hosted-model-actions.test.ts tests/cli/flow.test.ts --testNamePattern "hosted-model|SAIA"`
- `npx tsc --noEmit && npx vitest run tests/workflows/hosted-model-actions.test.ts tests/mcp/server.test.ts tests/cli/flow.test.ts tests/ui/app.test.ts --testNamePattern "hosted-model|SAIA|MCP proof summary|SplunkReady MCP server"`
- `npm run mcp-proof`
- `node dist/src/cli.js mcp-proof --out submission-evidence/mcp-proof --json`
- `npm run public-demo:build`
- `bash "$HOME/.codex/skills/playwright/scripts/playwright_cli.sh" open 'http://127.0.0.1:4179/?artifacts=artifacts%2Fmcp-proof#mcp-proof'`
- `bash "$HOME/.codex/skills/playwright/scripts/playwright_cli.sh" snapshot`
- `bash "$HOME/.codex/skills/playwright/scripts/playwright_cli.sh" console error`
- `bash "$HOME/.codex/skills/playwright/scripts/playwright_cli.sh" eval "..." --json`
- `npm run check`

## Result

Credential-free fixture MCP proof remains `PASS`, while live SAIA route failures
are now classified as `SAIA_ROUTE_NOT_FOUND` instead of being collapsed into a
generic blocked state. The public MCP proof route renders hosted-model blocker
rows and Playwright verified that the route loads without console errors or
artifact-load failures.

No Splunk mutation was introduced. No `.splunkready*` or `.env*` secret contents
were read, printed, sourced, or committed.
