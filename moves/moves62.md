# Move 62: Proof Manifest and Index Workflow Extraction

## Trigger

Move 61 only reduced `src/cli.ts` by 74 lines, which is not enough to answer
the competitive audit's CLI-monolith cap. This move continues the extraction
with proof manifest, manifest verification, and certification index logic.

## Scope

- Move proof manifest hashing and verification out of `src/cli.ts`.
- Replace manifest-verification and certification-index workflow modules that
  imported the CLI dynamically with direct workflow implementations.
- Keep CLI command names, flags, artifact names, JSON shapes, and strict-gate
  behavior unchanged.
- Keep `src/cli.ts` focused on command wiring for these workflows.

## Boundaries

- Do not rename commands or flags.
- Do not make LLM grading authoritative.
- Do not change fixture/live interfaces.
- Do not read, source, print, or commit `.env*` or `.splunkready*` files.
- Do not change UI source; Playwright is not required.
- Do not use subagents.

## Acceptance

- `src/cli.ts` has a materially smaller line count than after Move 61.
- Manifest verification, certification index, and judge-proof focused coverage
  still passes.
- TypeScript validation and the canonical repository gate pass.
