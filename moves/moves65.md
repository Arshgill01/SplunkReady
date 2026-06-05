# Move 65: Proof Audit Workflow Extraction

## Trigger

The user challenged the earlier CLI modularization as insufficient: reducing
`src/cli.ts` by only a small number of lines does not address the production
quality signal called out by the Minimax audit. The proof audit implementation
was still a dense workflow embedded in the CLI.

## Scope

- Move proof audit ownership from `src/cli.ts` into
  `src/workflows/proof-audit.ts`.
- Keep the CLI as a thin caller for `proof-audit`.
- Export shared proof audit types and `classifyProofLoop` from the workflow
  module so suite, live, and judge proof code can depend on a workflow module
  instead of CLI-local types.
- Add direct workflow tests for suite proof audit success and strict failure.
- Record the actual CLI line-count change.

## Boundaries

- Do not change proof audit semantics.
- Do not change deterministic grading authority.
- Do not read, source, print, or commit `.env*` or `.splunkready*` files.
- Do not change UI source; Playwright is not required for this move.
- Do not use subagents.

## Acceptance

- `src/cli.ts` no longer owns the proof audit implementation.
- `src/workflows/proof-audit.ts` owns proof audit report generation and strict
  gate handling.
- Focused proof audit, CLI, and workbench tests pass.
- Full `npm run check` passes.
- The move log reports the real CLI line-count delta.
