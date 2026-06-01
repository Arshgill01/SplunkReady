# Stack Recommendation

Status: historical Wave 02 input. The accepted implementation decision is `docs/stack-decision.md`.

This file preserves the scaffold-time recommendation so future agents can see why the stack was chosen. It is historical context, not the current install manifest.

## Original Recommended Stack

Use TypeScript as the implementation spine.

Recommended choices:

- Runtime/package manager: Node.js with the repo's chosen package manager decided during Wave 02.
- Schema validation: Zod or an equivalent runtime validator.
- Tests: Vitest or the repo-native TypeScript test runner.
- CLI: small TypeScript CLI using the existing package setup.
- UI: defer UI until the schema/grader spine is stable.
- Diagrams: Mermaid or static SVG/PNG generated from source-controlled diagram text.

## Accepted Outcome

Wave 02 selected Node.js, npm, TypeScript, Zod, and Vitest. Later UI waves kept the UI dependency-light by generating a static TypeScript-backed HTML shell from contract, trace, violation, and receipt artifacts instead of adding React/Vite.

## Why TypeScript

SplunkReady is schema-heavy:

- Environment Contract
- Mission
- Trace Event
- Violation
- Readiness Receipt
- Policy Patch

TypeScript gives future agents a strong type spine while runtime validators prevent fixture/live drift.

## Historical Dependency Rule

Before Wave 02, agents were instructed not to install dependencies. Wave 02 has completed, and the accepted choices are documented in `docs/stack-decision.md`.

Wave 02 documented:

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

## Historical Wave 02 Gate

Wave 02 was allowed to complete after:

- `package.json` or equivalent manifest exists;
- schema validation dependency is justified;
- test command exists;
- fixture mode can run without secrets;
- `README.md` has basic development commands.
