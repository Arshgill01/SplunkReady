# Move 87: CLI Proof Command Extraction

## Goal

Continue the CLI modularization cap work by moving proof-oriented command
wrappers out of the root CLI executor.

## Scope

- Add a dedicated CLI proof command module.
- Move proof audit, manifest verification, certification index, suite proof,
  judge proof, MCP proof, LLM proof, and hosted-model proof command wrappers out
  of `src/cli.ts`.
- Preserve the existing command names, flags, defaults, JSON output, exported
  CLI workflow helpers, and package bin behavior.
- Keep deterministic grading authoritative and hosted model / LLM output
  advisory only.

## Non-goals

- Do not change fixture/live parity, grading behavior, proof semantics, MCP
  proof content, or Splunk mutation boundaries.
- Do not add new dependencies.
- Do not change UI source or behavior.
- Do not read, source, print, or commit `.splunkready*` or `.env*` files.

## Expected verification

- `npx tsc --noEmit`
- `npx vitest run tests/cli/flow.test.ts --testNamePattern "judge proof|mcp-proof|proof-audit|verify-manifest|suite-proof|certification-index|llm-proof|hosted-model"`
- `npm run check`
- `git diff --check`
