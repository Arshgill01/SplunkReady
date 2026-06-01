# Stack Decision

Status: accepted for implementation.

## Decision

SplunkReady will use a TypeScript-first stack:

- Runtime and package manager: Node.js with npm.
- Schema validation: Zod.
- Tests: Vitest.
- CLI: a small TypeScript CLI run through npm scripts.
- UI: static TypeScript-generated HTML shell rendered from fixture/demo artifacts.

## Rationale

The project is contract-heavy: environment contracts, missions, trace events, violations, receipts, and policy patches must stay aligned across fixture and live modes. TypeScript gives a typed spine, and Zod gives runtime validation so fixture data, mocked live data, and future live adapter output can be checked through the same shapes.

Vitest is the test runner because it is fast, deterministic, and small enough for fixture-first development. Normal fixture checks must run without Splunk credentials. Live mode will stay disabled by default and will require explicit environment configuration in later waves.

The CLI should stay thin: it will orchestrate compile, run, grade, receipt, and patch commands without owning business logic. The UI was deliberately deferred until schema, adapter, mission, grader, and receipt contracts were stable, then implemented as a static artifact viewer so the fixture demo stays reproducible without a frontend dev server.

## Dependencies

Installed now:

- `zod`: runtime schemas and parse boundaries.
- `typescript`: static type checking for implementation files.
- `vitest`: deterministic unit and contract tests.
- `@types/node`: Node.js types for CLI and filesystem code.

Not installed:

- `vite`, `react`, `react-dom`, and related React packages. The implemented UI shell does not require them.

No paid service, database, hosted model, or live Splunk credential is required for normal fixture tests.

## Default Modes

- Fixture mode is the default mode for development and tests.
- Live mode is opt-in and must be safe to disable.
- Read-only Splunk behavior remains mandatory.
- The compiler, mission runner, grader, receipt generator, and policy patch exporter must depend on shared contracts rather than mode-specific branches.

## Commands

- `npm install`
- `npm test`
- `npm run verify:scaffold`
- `npm run check`
