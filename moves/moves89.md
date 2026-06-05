# Move 89: CLI Live Command Extraction

## Goal

Continue the CLI modularization cap work by moving live-mode command wrappers
and live CLI helper exports out of the root CLI executor.

## Scope

- Add a dedicated live command module.
- Move `live-smoke`, `live-candidates`, `live-security-check`,
  `live-security-kit`, `live-security-proof`, `live-security-ui-bundle`, and
  `live-proof` command wrappers out of `src/cli.ts`.
- Move live `run*FromCli` helper exports out of `src/cli.ts`.
- Preserve `live-smoke` status/message handling, command names, flags,
  defaults, JSON output, exported CLI workflow helpers, and package bin
  behavior.

## Non-goals

- Do not change fixture/live parity, live workflow behavior, strict live
  security requirements, LLM-agent behavior, MCP behavior, or Splunk mutation
  boundaries.
- Do not add new dependencies.
- Do not change UI source or behavior.
- Do not read, source, print, or commit `.splunkready*` or `.env*` files.

## Expected verification

- `npx tsc --noEmit`
- `npx vitest run tests/cli/flow.test.ts --testNamePattern "live-smoke|live-candidates|live-security-check|live-security-kit|live-security-proof|live-security-ui-bundle|live-proof|hosted-model"`
- `npm run check`
- `git diff --check`
