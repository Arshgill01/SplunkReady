# Move 86: CLI Option Parser Extraction

## Goal

Make CLI modularization real by extracting command-line defaults, usage text,
option types, and argument parsing out of `src/cli.ts`.

## Scope

- Add a dedicated CLI options module.
- Move `CliOptions`, `CliOutput`, default paths, `usage`,
  `defaultCliOptions`, and `parseArgs` out of `src/cli.ts`.
- Keep command execution behavior unchanged.
- Keep package bin behavior unchanged.
- Preserve existing CLI tests as the behavioral contract.

## Non-goals

- Do not change CLI command names, flags, defaults, or JSON output.
- Do not change fixture/live parity, grading behavior, MCP behavior, or Splunk
  mutation boundaries.
- Do not add new dependencies.
- Do not read, source, print, or commit `.splunkready*` or `.env*` files.

## Expected verification

- `npx tsc --noEmit`
- `npx vitest run tests/cli/flow.test.ts --testNamePattern "compile|demo|judge proof|mcp-proof|llm-proof|package"`
- `npm run check`
- `git diff --check`
