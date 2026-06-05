# Move 74: Suite Proof Workflow Extraction

## Trigger

After the judge-proof extraction, the largest remaining proof orchestration block
inside `src/cli.ts` was `suite-proof`: suite manifest parsing, mission loop
execution, receipt parsing, fail-to-pass classification, summary writing, and
compiler diagnostics. That kept core proof behavior coupled to the CLI monolith.

## Scope

- Move suite proof orchestration into `src/workflows/suite-proof.ts`.
- Keep the CLI command as a thin step-wiring delegator.
- Preserve the same fixture-only boundary and strict fail-to-pass behavior.
- Keep compiler diagnostics attached to suite proof output.
- Add direct workflow tests with fake mission receipts and diagnostics.
- Keep workflow source independent from `../cli.js`.

## Boundaries

- Do not change deterministic grading rules or receipt semantics.
- Do not make LLM/SAIA output authoritative.
- Do not change fixture/live adapter parity.
- Do not call live Splunk or mutate Splunk.
- Do not read, source, print, or commit `.env*` or `.splunkready*` files.
- Do not change UI source; Playwright is not required.
- Do not use subagents.

## Acceptance

- `src/cli.ts` no longer owns suite proof aggregation logic.
- `src/workflows/suite-proof.ts` writes suite summaries and compiler
  diagnostics.
- Focused workflow and CLI suite-proof regressions pass.
- Full repository checks pass.
