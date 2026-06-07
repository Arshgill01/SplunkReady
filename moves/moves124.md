# Move 124 - Official Splunk MCP Tool Coverage

Status: implemented

## Goal

Strengthen the Best Use of MCP story by showing how SplunkReady composes with
the existing Splunk MCP Server and Splunk AI Assistant tools, instead of relying
only on SplunkReady's local MCP certifier surface.

## Scope

- Add an `officialSplunkMcpToolCoverage` block to `mcp-proof-summary.json`.
- Record official Splunk MCP tools/configuration documentation URLs in the proof
  metadata.
- Require the MCP composition scorecard to include official Splunk MCP usage
  coverage.
- Surface the coverage block in the Vite MCP proof route.
- Keep mission-scoped deterministic tool limits intact.

## Important Finding

An attempted transcript-level `splunk_get_info` call correctly failed the strict
certification gate with `SAF-003` because the security mission does not allow
that tool. The final implementation does not weaken the mission. It records
`splunk_get_info` as mission-scoped out, while the certified transcript keeps
the allowed Splunk MCP investigation tools:

- `splunk_get_knowledge_objects`
- `splunk_run_saved_search`

Hosted-model coverage remains the four SAIA tools:

- `saia_generate_spl`
- `saia_explain_spl`
- `saia_optimize_spl`
- `saia_ask_splunk_question`

## Files Changed

- `src/workflows/mcp-proof.ts`
- `ui/src/artifacts.ts`
- `ui/src/render.ts`
- `tests/cli/flow.test.ts`
- `tests/ui/app.test.ts`
- `submission-evidence/mcp-proof/mcp-proof-summary.json`
- `submission-evidence/mcp-proof/mcp-proof-summary.md`
- `submission-evidence/claim-ledger.md`

## Verification

- `npx tsc --noEmit && npx vitest run tests/cli/flow.test.ts tests/ui/app.test.ts --testNamePattern "MCP|mcp|certifies an MCP"`
- `npm run mcp-proof`
- `node dist/src/cli.js mcp-proof --out submission-evidence/mcp-proof --json`
- `npm run public-demo:build`
- `bash "$HOME/.codex/skills/playwright/scripts/playwright_cli.sh" open 'http://127.0.0.1:4179/?artifacts=artifacts%2Fmcp-proof#mcp-proof'`
- `bash "$HOME/.codex/skills/playwright/scripts/playwright_cli.sh" snapshot`
- `bash "$HOME/.codex/skills/playwright/scripts/playwright_cli.sh" console error`
- `bash "$HOME/.codex/skills/playwright/scripts/playwright_cli.sh" eval "..." --json`

## Result

The public MCP proof route now renders `Official Splunk MCP tool coverage` with
`official-splunk-mcp-tool-coverage: PASS`, `mission-scoped-tool-boundary: PASS`,
the certified Splunk MCP investigation tools, the four SAIA hosted-model tools,
and `splunk_get_info` explicitly shown as mission-scoped out. No Splunk mutation
or LLM-as-grader behavior was introduced.
