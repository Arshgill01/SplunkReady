# Stack Recommendation

Status: recommendation, not installed.

## Recommended Stack

Use TypeScript as the implementation spine.

Recommended choices:

- Runtime/package manager: Node.js with the repo's chosen package manager decided during Wave 02.
- Schema validation: Zod or an equivalent runtime validator.
- Tests: Vitest or the repo-native TypeScript test runner.
- CLI: small TypeScript CLI using the existing package setup.
- UI: Vite + React after schema/grader spine is stable.
- Diagrams: Mermaid or static SVG/PNG generated from source-controlled diagram text.

## Why TypeScript

SplunkReady is schema-heavy:

- Environment Contract
- Mission
- Trace Event
- Violation
- Readiness Receipt
- Policy Patch

TypeScript gives future agents a strong type spine while runtime validators prevent fixture/live drift.

## Dependency Rule

Do not install dependencies until Wave 02.

Wave 02 must document:

- chosen package manager;
- chosen schema validator;
- chosen test runner;
- chosen UI stack;
- why each dependency is needed.

## Default Bias

Favor:

- small dependencies;
- fixture-first testing;
- plain files for demo artifacts;
- deterministic test output;
- no external service required for fixture demo.

Avoid:

- heavy agent frameworks before the adapter/grader spine exists;
- database dependency for fixture mode;
- paid service dependency;
- UI-first implementation.

## Acceptance Gate For Wave 02

Wave 02 cannot complete until:

- `package.json` or equivalent manifest exists;
- schema validation dependency is justified;
- test command exists;
- fixture mode can run without secrets;
- `README.md` has basic development commands.

