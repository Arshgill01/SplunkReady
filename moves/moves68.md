# Move 68: Policy Action Workflow Extraction

## Trigger

After Move 67, policy workbench actions were the next workflow surface still
using a dynamic `../cli.js` import. The Minimax audit specifically called out
CLI modularization as a production-quality cap, and the workbench should own
its server-safe workflows instead of depending on CLI exports.

## Scope

- Move `policy-backed-rerun` orchestration into
  `src/workflows/policy-actions.ts`.
- Move `firewall-check` workflow execution into
  `src/workflows/policy-actions.ts`.
- Keep the CLI exports as compatibility aliases that call workflow-owned
  functions.
- Add direct workflow tests for policy-backed rerun, firewall check, and no CLI
  import regression.

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

- `src/workflows/policy-actions.ts` no longer imports `../cli.js`.
- Policy-backed rerun still grades before without firewall and reruns after
  with the compiled firewall.
- Firewall check still rejects unsafe SPL before Splunk execution.
- Direct workflow, CLI, and workbench policy checks pass.
- Full `npm run check` passes.
