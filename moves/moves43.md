# Move 43: One-Command Judge Proof

## Status

Implemented.

## Problem

The strongest proof paths existed, but they were split across several commands and README sections. A judge or developer could miss the complete certification story or abandon the setup before seeing suite proof, firewall proof, proof manifests, and the certification index together.

## Scope

- Add a fixture-only `judge-proof` CLI command.
- Add `npm run judge-proof` as the fresh-clone local proof command.
- Compose existing strict gates instead of adding a new grader path:
  - `suite-proof` with `--require-fail-to-pass true`;
  - suite `proof-audit --require-pass true`;
  - suite `verify-manifest`;
  - `firewall-check`;
  - firewall `verify-manifest`;
  - strict `certification-index`.
- Write `judge-proof-summary.json` and `.md`.
- Document the command in README.

## Boundaries

- Fixture-only. Live Splunk proof remains operator-owned and separate.
- No Splunk mutation.
- No LLM pass/fail authority.
- No UI change in this move.
- No new dependency.

## Verification

- `npm test -- tests/cli/flow.test.ts -t "judge proof"`
- `npm run build`
- `npm run judge-proof`
- `npm run check`
- `git diff --check`
