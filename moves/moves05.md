# Move 05 - Ship One Safe Interactive Fixture Certification Workflow

## Goal

Make the primary Vite artifact app capable of running one real, receipt-led
fixture certification loop without creating a broad or unsafe control plane.

This preserves the strongest recommendation from both reports while cutting the
original proposal down to a deadline-sized vertical slice.

## Product Boundary

- Vite is a **localhost operator workbench** during `ui:dev`.
- The generated static shell remains the portable, self-contained receipt
  artifact.
- The only initial executable action is the fixture fail-to-pass demo.
- The server owns output paths and credentials. The browser owns neither.

## Scope

Expected files:

- a reusable workflow module outside `src/cli.ts`
- a thin CLI call site for the existing `demo` command
- a narrow Vite development middleware route
- `ui/src/main.ts`, `ui/src/render.ts`, `ui/src/artifacts.ts`, and restrained CSS
- focused workflow, middleware, UI, and browser tests
- docs for the local interactive command
- current wave and logs

Do not decompose the full CLI. Extract only the reusable readiness-loop
orchestration required by this move.

## Plan

1. Extract a directly callable fixture demo workflow returning structured run
   metadata and optional structured phase updates.
2. Keep the CLI behavior and artifact contract stable by making `demo` call the
   extracted workflow.
3. Add one allowlisted localhost-only endpoint such as `POST /api/demo`.
   - no command name from the request;
   - no arbitrary output path;
   - no environment variables, hostnames, tokens, or live-mode selection;
   - server allocates a new run directory under a fixed managed root.
4. Complete the run, audit its artifacts, and only then expose the new bundle to
   the UI.
5. Replace the sham replay action with a truthful **Run fixture certification**
   action. Show structured phases, completion, failure recovery, and refreshed
   artifacts.
6. Preserve receipt authority:
   - no waivers;
   - no client-side scoring;
   - no receipt edits;
   - label the rerun as policy-backed, not as applying a patch to Splunk.
7. Add resilient loading, focus handling, reduced-motion support, and verified
   mobile layout fixes. Preserve existing no-gradient/no-glass design rules.

## Acceptance Criteria

- Clicking the action creates a fresh audited fixture run and displays it.
- The browser cannot choose a filesystem path or provide credentials.
- A failed run leaves prior audited bundles unchanged.
- Static `ui:build` remains a static artifact app; docs do not imply otherwise.
- Receipt, trace, policy, and audit provenance remain inspectable.

## Verification

```bash
npx vitest run tests/cli/flow.test.ts tests/ui/app.test.ts tests/ui/shell.test.ts
npm run ui:build
npm run check
git diff --check
```

Use browser automation at desktop and mobile widths to verify run creation,
artifact refresh, errors, keyboard focus, and no secret-bearing output.

## Stop Conditions

- Stop before exposing live commands or all CLI commands.
- Stop before accepting browser credentials or output paths.
- Stop if the UI changes verdicts, scores, violations, or receipt artifacts.
- Stop if this move grows into a full CLI refactor.
