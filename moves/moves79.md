# Move 79: MCP Proof Workbench View

## Goal

Make the MCP award proof judge-visible in the Vite workbench without inventing a
new product surface or weakening deterministic authority.

## Scope

- Load `mcp-proof-summary.json` as a typed workbench artifact.
- Add a focused `MCP` workbench view that renders:
  - SplunkReady MCP tools, resources, and prompts;
  - the agent-driven Splunk MCP certification loop;
  - the certified Splunk MCP boundary;
  - deterministic authority and no-mutation posture.
- Add a default artifact preset for `artifacts/mcp-proof`.
- Verify the view with focused UI tests, Playwright, and the canonical gate.

## Non-goals

- Do not add Splunk write operations.
- Do not make MCP, LLM, or SAIA output authoritative for pass/fail.
- Do not replace Splunk MCP with a SplunkReady copilot.
- Do not read, source, print, or commit `.splunkready*` or `.env*` files.

## Expected verification

- `npx tsc --noEmit`
- `npx vitest run tests/ui/app.test.ts --testNamePattern "MCP proof|artifact base|artifact source"`
- Playwright browser verification against the local workbench MCP view.
- `npm run check`
