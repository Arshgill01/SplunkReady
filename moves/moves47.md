# Move 47: Live Security Strict Readiness Contract

## Status

Implemented.

## Problem

The flagship lateral-movement proof is intentionally stricter than generic live
MCP evidence, but a fresh Splunk trial may not contain the required Enterprise
Security saved search or row-level security evidence. Without an explicit
contract, a judge could read a blocked fresh-trial diagnostic as a broken
security story or assume SplunkReady silently downgraded to `_internal` proof.

## Scope

- Add machine-readable strict proof mode metadata to `live-security-check`.
- Add setup requirements for saved-search presence, evidence rows, evidence
  identifiers, and operator-owned setup.
- Add an explicit fallback policy that separates generic `live-proof` evidence
  from strict `live-security-proof` evidence.
- Surface the strict mode, setup requirements, and generic fallback boundary in
  the workbench.
- Keep older local readiness artifacts readable by the UI.
- Document the fresh-trial blocked state in README and live demo docs.

## Boundaries

- No Splunk mutation.
- No browser-secret entry.
- No LLM pass/fail authority.
- No fallback from the flagship security proof to `_internal`.
- No new dashboard workflow or heavy dependency.
- No secret env file read.
- No subagents.

## Verification

- `npm test -- tests/cli/flow.test.ts -t "flagship live security readiness|exact live security blockers"`
- `npm test -- tests/ui/app.test.ts -t "live proof summaries"`
- `npm run build`
- `npm run ui:build`
- `npx --yes --package playwright node --input-type=module - <<'EOF' ... EOF`
- `npm run check`
- `git diff --check`
