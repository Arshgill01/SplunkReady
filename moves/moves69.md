# Move 69: Live Action Workflow Extraction

## Trigger

After Move 68, `src/workflows/live-actions.ts` was the only remaining
workflow wrapper still dynamically importing `../cli.js`. The Minimax audit and
user feedback both called out superficial CLI reductions as unacceptable; this
move extracts the live implementation itself rather than only moving aliases.

## Scope

- Move live smoke, live saved-search candidate derivation, strict live security
  readiness, operator-owned live security kit generation, generic live proof,
  live security proof, and live security UI bundling into
  `src/workflows/live-actions.ts`.
- Keep CLI commands and exported compatibility names as thin delegators.
- Preserve the existing live proof boundaries:
  - no Splunk mutation;
  - strict `live-security-proof` requires LLM mode and exact readiness;
  - generic `live-proof` remains separate from the flagship security proof;
  - hosted-model/SAIA output remains advisory only.
- Add direct workflow tests for live action behavior and a no-CLI-import
  regression.

## Boundaries

- Do not change product scope.
- Do not make LLM or SAIA output authoritative.
- Do not remove deterministic checks.
- Do not introduce Splunk write operations.
- Do not read, source, print, or commit `.env*` or `.splunkready*` files.
- Do not change UI source; Playwright is not required.
- Do not use subagents.

## Acceptance

- `src/workflows/live-actions.ts` does not import `../cli.js`.
- Live action workflows can run directly without CLI ownership.
- Existing live CLI behavior remains covered by focused live CLI tests.
- `src/cli.ts` is materially reduced by moving live implementation code, not
  by deleting documentation or comments.
- Full `npm run check` passes.
