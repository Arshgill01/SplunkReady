# Move 51: Suite Compiler Diagnostics

## Trigger

The competitive audit called out that deterministic grading can look boring or
less AI-native unless SplunkReady makes the compiler evidence obvious.

## Scope

- Add a suite-level Agent Readiness Compiler diagnostics artifact generated from
  existing readiness profiles, receipts, and deterministic violation files.
- Include the diagnostics in `suite-proof` and therefore in `judge-proof`
  artifacts.
- Show rule activations, before/after violation counts, resolved rules,
  deployment signals, evidence refs, trace refs, pass/fail authority, and
  advisory LLM boundaries.
- Add focused CLI coverage proving the diagnostics are artifact-backed.
- Update README, risk/audit logs, move index, execution log, and verification
  log.

## Boundaries

- Do not make LLM/SAIA output authoritative.
- Do not add new dependencies.
- Do not change fixture/live adapter interfaces.
- Do not add Splunk mutation.
- Do not change UI source in this move; Playwright is not required.
- Do not read, source, print, or commit `.env*` or `.splunkready*` files.

## Acceptance

- `suite-proof` writes `compiler-diagnostics.json` and
  `compiler-diagnostics.md`.
- The diagnostics derive from existing proof artifacts, not synthetic claims.
- `judge-proof` includes those diagnostics through the suite-proof gate.
- Focused CLI tests pass.
- Full repository check passes before commit.
