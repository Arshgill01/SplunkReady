# Move 174 - Real Splunk Stress Replay Runner

## Intent

Turn the Move 173 real Splunk stress proof from a one-off operator session into
a reproducible, guarded local command that can create a disposable Splunk
deployment, seed the stress scenario, run SplunkReady's flagship proof, and
write redacted evidence.

## Scope

- Add an explicit `SPLUNKREADY_ALLOW_REAL_SPLUNK_SETUP=1` guard before any
  Docker or Splunk setup writes run.
- Add a Node runner that:
  - builds SplunkReady;
  - creates a disposable Splunk Enterprise Docker container;
  - generates the live security kit;
  - adds auth-noise rows, decoy saved searches, a wrong-app duplicate saved
    search, and a prompt-trap row;
  - starts the read-only real Splunk MCP compatibility bridge;
  - runs `live-security-check` and `live-security-proof`;
  - writes public-safe redacted evidence and an automation manifest.
- Add a package script for the guarded replay command.
- Add focused tests for the guard/help behavior without requiring Docker.
- Update logs with commands and validation results.

## Non-Goals

- Do not run this from the default `check` or judge path.
- Do not commit generated passwords, local env files, or raw unredacted logs.
- Do not claim hosted-model/SAIA PASS from this replay unless the strict hosted
  model diagnostic actually passes.
- Do not make SplunkReady auto-mutate an operator-owned deployment.

## Expected Files

- `moves/moves174.md`
- `scripts/run-real-splunk-stress-proof.mjs`
- `tests/scripts/real-splunk-stress-proof.test.ts`
- `package.json`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Verification

- `node scripts/run-real-splunk-stress-proof.mjs --help`
- `node scripts/run-real-splunk-stress-proof.mjs --out <tmp>` fails without
  `SPLUNKREADY_ALLOW_REAL_SPLUNK_SETUP=1`
- `SPLUNKREADY_ALLOW_REAL_SPLUNK_SETUP=1 node scripts/run-real-splunk-stress-proof.mjs --out artifacts/real-splunk-stress-replay --evidence-out submission-evidence/real-splunk-stress-replay --json`
- `npx vitest run tests/scripts/real-splunk-stress-proof.test.ts`
- `npm run check`
