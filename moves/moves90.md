# Move 90: CLI Dispatch Extraction

## Goal

Finish the current CLI modularization pass by moving command routing out of the
root CLI entrypoint.

## Scope

- Add a dedicated CLI dispatch module.
- Move root command routing for fixture, external trace, proof, live, receipt,
  rerun, and demo commands out of `src/cli.ts`.
- Move hosted-model CLI helper exports into the proof command module.
- Keep `src/cli.ts` responsible for entrypoint behavior, bundled path
  resolution, output formatting, and CLI error formatting.
- Preserve command names, flags, defaults, JSON output, unknown-command help
  text, exported CLI workflow helpers, and package bin behavior.

## Non-goals

- Do not change fixture/live parity, grading behavior, proof semantics, LLM or
  SAIA authority, MCP behavior, live workflow behavior, or Splunk mutation
  boundaries.
- Do not add new dependencies.
- Do not change UI source or behavior.
- Do not read, source, print, or commit `.splunkready*` or `.env*` files.

## Expected verification

- `npx tsc --noEmit`
- `npx vitest run tests/cli/flow.test.ts --testNamePattern "compile|demo|judge proof|mcp-proof|live-smoke|hosted-model|package|Unknown command"`
- `npm run check`
- `git diff --check`
