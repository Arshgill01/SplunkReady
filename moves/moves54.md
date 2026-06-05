# Move 54: GitHub Workflow Diagnostics Artifact

## Trigger

Move 52 added a composite action `diagnostics-path` output, but the example
workflow still only uploaded the whole proof directory.

## Scope

- Update the GitHub workflow example to expose and upload the diagnostics file
  path returned by the composite action.
- Document the diagnostics output in the examples guide.
- Add a focused regression test for the example workflow text.

## Boundaries

- Do not add live credentials or production deployment behavior.
- Do not change the composite action implementation.
- Do not change UI source; Playwright is not required.
- Do not read, source, print, or commit `.env*` or `.splunkready*` files.
- Do not use subagents.

## Acceptance

- The example workflow references `steps.splunkready.outputs.diagnostics-path`.
- The example uploads the diagnostics artifact separately from the proof bundle.
- Example documentation tells CI users what the diagnostics path contains.
- Focused tests and full repository checks pass.
