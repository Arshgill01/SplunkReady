# Move 77: CLI Orphan Helper Cleanup

## Trigger

Move 76 left `src/cli.ts` at 883 lines. The first candidate was demo command
extraction, but implementation inspection showed `demoCommand` was already a
thin delegator into `fixture-certification`. The real remaining cleanup was an
orphaned helper block left behind by prior workflow extractions.

## Scope

- Remove unused CLI-local JSON/text IO helpers.
- Remove unused record-field helper functions.
- Remove now-unused filesystem imports.
- Keep command behavior unchanged.

## Boundaries

- Do not change CLI arguments or command output.
- Do not change fixture/live behavior.
- Do not change deterministic grading rules, receipts, or policy semantics.
- Do not read, source, print, or commit `.env*` or `.splunkready*` files.
- Do not change UI source; Playwright is not required.
- Do not use subagents.

## Acceptance

- `src/cli.ts` no longer contains the orphaned helper functions.
- TypeScript passes.
- Focused CLI command regressions pass.
- Full repository checks pass.
