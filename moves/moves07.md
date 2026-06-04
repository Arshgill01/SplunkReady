# Move 07 - Capture SAIA Proof When Entitlement Is Actually Green

## Goal

Convert the already-implemented Splunk AI Assistant path into defensible public
proof if, and only if, tenant activation plus the active MCP identity's
entitlement succeeds before submission.

## Source Truth

- `saia_explain_spl` and `saia_optimize_spl` routing already exists.
- `query` to `spl` payload mapping already exists and is tested.
- `hosted-model-diagnostic` and `hosted-model-proof` already exist.
- MCP tool failures may arrive in an HTTP 200 envelope; raw `curl` status is not
  a readiness signal.
- Receipt-integrated SAIA assistance only applies to eligible SPL violations.
  The current live security proof's violations do not necessarily trigger it.

## Scope

Expected files only after a successful diagnostic:

- current live/SAIA playbook documentation
- regenerated proof artifacts used by Move 06
- README and Devpost claims updated by Move 10
- focused code/tests only if successful live evidence exposes a real defect
- current wave and logs

Do not add a new activation script or duplicate the existing diagnostic.

## Plan

1. Require credentials to be exported in the operator shell according to the
   chosen secret-handling policy. Never echo or pass them through the UI.
2. Run the existing non-executing diagnostic:

   ```bash
   npm run splunkready -- hosted-model-diagnostic --mode live --require-pass true --out <fresh-dir>
   ```

3. If it is blocked, record the exact sanitized status and stop this move.
4. If it passes, run a fresh standalone hosted-model proof and verify that
   explanation and optimization fields are non-empty and mutation is false.
5. Rerun the flagship live security proof into one fresh output directory so
   hosted-model status, receipts, proof audit, and manifest are atomic.
6. Distinguish in all copy:
   - entitlement diagnostic;
   - standalone hosted-model proof;
   - receipt-integrated assistance, only when an eligible SPL violation proves
     it.
7. Export sanitized evidence through Move 06.

## Acceptance Criteria

- Success is declared only when `hosted-model-diagnostic --require-pass true`
  exits zero.
- Proof output identifies the hosted tools and remains non-authoritative.
- No claim says SAIA affected verdict or score.
- No claim says the live security receipt contains SAIA remediation unless the
  public receipt proves it.
- A blocked entitlement does not block the core submission.

## Verification

```bash
npm run splunkready -- hosted-model-diagnostic --mode live --require-pass true --out <diagnostic-dir>
npm run splunkready -- hosted-model-proof --mode live --out <hosted-proof-dir>
npm run splunkready -- proof-audit --out <atomic-live-proof-dir> --require-pass true
npm run splunkready -- verify-manifest --out <atomic-live-proof-dir>
npm run check
git diff --check
```

## Stop Conditions

- Stop when entitlement remains blocked; do not write code around an external
  permission failure.
- Stop before raw `curl` probes, browser tokens, or secret-bearing screenshots.
- Stop before presenting Gemini as a Splunk-hosted model.
