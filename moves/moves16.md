# Move 16 - Add Browser And API Test Harness

## Goal

Protect the new workbench surface with real API and browser coverage, not only
unit tests.

## Scope

Expected files:

- test helpers for starting the workbench server
- API route tests
- browser or Playwright-style tests if existing tooling supports it
- screenshots for local QA if useful
- package scripts
- logs

## Plan

1. Add a test server fixture that starts the backend on a random local port.
2. Cover health, job creation, job state, events, artifact reads, and path
   traversal rejection.
3. Cover fixture certification from the browser.
4. Cover failed job rendering.
5. Cover mobile-width layout for the main run screen.
6. Keep tests deterministic and credential-free.

## Acceptance Criteria

- Workbench API has route-level coverage.
- The executable fixture UI is covered end-to-end.
- Path containment and secret redaction have tests.
- Tests run in the normal offline gate.

## Verification

```bash
npx vitest run tests/workbench tests/ui/app.test.ts
npm run check
npm run ui:build
git diff --check
```

## Stop Conditions

- Stop before adding flaky sleeps.
- Stop before using live credentials in tests.
- Stop before relying only on manual screenshots for the main workflow.
