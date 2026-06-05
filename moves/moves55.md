# Move 55: Package Trace Bridge Exports

## Trigger

The trace bridge and callback capture helpers exist, but package consumers still
have to import from deep built paths such as `dist/src/integrations/...`.

## Scope

- Add stable package subpath exports for the agent trace bridge and callback
  trace capture helper.
- Emit TypeScript declarations so package consumers get usable types.
- Update examples to use package-style imports.
- Verify the exports against a packed/installable package artifact.

## Boundaries

- Do not add framework dependencies.
- Do not change trace schemas, grading behavior, receipts, or action runtime.
- Do not change UI source; Playwright is not required.
- Do not read, source, print, or commit `.env*` or `.splunkready*` files.
- Do not use subagents.

## Acceptance

- `splunkready/trace-bridge` imports `createSplunkReadyTraceBridge`.
- `splunkready/callback-trace-capture` imports
  `createSplunkReadyCallbackTraceCapture`.
- Published package contents include JavaScript and declaration files for those
  subpaths.
- Example docs use the stable package subpaths.
- Focused package-export verification and full repository checks pass.
