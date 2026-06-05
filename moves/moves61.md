# Move 61: LLM Proof Workflow Extraction

## Trigger

The competitive audit identified the CLI monolith as a production-grade cap.
Move 60 added useful LLM proof behavior but grew `src/cli.ts` again. This move
extracts that new orchestration immediately instead of letting the monolith
compound.

## Scope

- Extract `llm-proof` receipt/audit summary orchestration into a workflow
  module.
- Keep CLI flags, output paths, JSON shape, and strict-gate behavior unchanged.
- Leave parser and command dispatch untouched.

## Boundaries

- Do not rename commands or flags.
- Do not make LLM grading authoritative.
- Do not change fixture/live interfaces.
- Do not read, source, print, or commit `.env*` or `.splunkready*` files.
- Do not change UI source; Playwright is not required.
- Do not use subagents.

## Acceptance

- `src/cli.ts` shrinks after extracting the Move 60 orchestration.
- `llm-proof` focused CLI coverage still passes.
- TypeScript validation and the canonical repository gate pass.
