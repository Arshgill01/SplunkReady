# Move 114 - Hosted Model Env File Support

## Goal

Make the live SAIA / hosted-model proof runnable from an operator-owned secret
file without requiring agents to read, source, print, or commit that file.

## Scope

- Add `--env-file <path>` to `hosted-model-proof` and
  `hosted-model-diagnostic`.
- Parse simple `KEY=value` / `export KEY=value` files without adding a
  dependency.
- Use the explicit env file only inside hosted-model commands.
- Let env-file values drive the proof run when the option is supplied.
- Keep artifacts secret-safe: setup artifacts record only variable names and
  set/missing/invalid status, never token values.
- Add CLI regression coverage with a temporary `.splunkready-test` file and a
  mock Splunk MCP server.
- Document the operator workflow in the live setup checklist.

## Verification

- `npx tsc --noEmit`
- `npx vitest run tests/cli/flow.test.ts --testNamePattern "hosted-model"`
- `git diff --check`
- `npm run check`

## Boundaries

- Do not read, source, print, or commit real `.splunkready*` or `.env*` files.
- Do not make SAIA or any LLM authoritative for pass/fail readiness.
- Do not mutate Splunk.
- Do not add a dependency.
- Do not use subagents.
