# Move 67: Fixture Certification Workflow Extraction

## Trigger

The Minimax audit and user feedback called out that reducing `src/cli.ts` by a
few dozen lines was not meaningful modularization. The executable workbench
fixture certification path still reached back into the CLI through a dynamic
`../cli.js` import, so the local backend was not truly workflow-owned.

## Scope

- Move reusable fixture certification primitives into
  `src/workflows/certification-actions.ts`.
- Make `src/workflows/fixture-certification.ts` build its default compile,
  evaluate, receipt, rerun, UI shell, and proof-audit steps without importing
  the CLI.
- Keep the CLI as a command parser/composer that calls workflow-owned
  certification actions.
- Preserve deterministic grading authority, advisory-only LLM/SAIA behavior,
  fixture/live adapter parity, and no Splunk mutation.
- Add a regression test that prevents the fixture workflow from importing the
  CLI again.

## Boundaries

- Do not change product scope.
- Do not make LLM output authoritative.
- Do not remove deterministic checks.
- Do not add dependencies.
- Do not introduce Splunk write operations.
- Do not read, source, print, or commit `.env*` or `.splunkready*` files.
- Do not change UI source; Playwright is not required.
- Do not use subagents.

## Acceptance

- `src/workflows/fixture-certification.ts` no longer imports `../cli.js`.
- The backend fixture certification workflow runs directly from workflow-owned
  steps.
- CLI `demo`, `firewall-check`, and `judge-proof` paths keep working.
- Workbench fixture certification HTTP job coverage keeps working.
- `src/cli.ts` line count drops materially from the Move 66 checkpoint.
- Full `npm run check` passes.
