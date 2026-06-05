# Move 88: CLI External Command Extraction

## Goal

Continue the CLI modularization cap work by moving external trace, MCP
transcript, LLM-agent, and demo command wrappers out of the root CLI executor.

## Scope

- Add a dedicated external command module.
- Move `grade-trace`, `import-mcp-transcript`,
  `certify-mcp-transcript`, `llm-agent`, and `demo` command wrappers out of
  `src/cli.ts`.
- Remove stale root CLI imports made unnecessary by prior workflow and command
  extractions.
- Preserve the existing command names, flags, defaults, JSON output, exported
  CLI workflow helpers, and package bin behavior.

## Non-goals

- Do not change fixture/live parity, grading behavior, external trace import
  semantics, LLM-agent behavior, MCP behavior, or Splunk mutation boundaries.
- Do not add new dependencies.
- Do not change UI source or behavior.
- Do not read, source, print, or commit `.splunkready*` or `.env*` files.

## Expected verification

- `npx tsc --noEmit`
- `npx vitest run tests/cli/flow.test.ts --testNamePattern "grade-trace|import-mcp-transcript|certify-mcp-transcript|llm-agent|demo|judge proof|package"`
- `npm run check`
- `git diff --check`
