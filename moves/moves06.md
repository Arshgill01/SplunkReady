# Move 06 - Produce A Sanitized Public Evidence Pack

## Goal

Give judges tracked, internally consistent evidence for the strongest claims
without committing secrets, private addresses, stale bundles, or ignored local
artifacts.

## Why This Is Required

Current proof directories under `artifacts/` are ignored and not available to a
judge cloning the repository. Local bundles also disagree: the flagship proof
can be green while a UI bundle or certification index is stale, and current
live evidence may expose private network details.

## Scope

Expected files:

- a new tracked `submission-evidence/` directory
- a small documented redaction/export procedure or script
- proof summaries, selected receipts, audits, manifests, and screenshots
- a claim ledger mapping public claims to public evidence
- `.gitignore` only if required to allow the curated directory
- current wave and logs

The public pack is a curated export, not a second source of truth for runtime
artifacts.

## Plan

1. Freeze the source commit used for final evidence.
2. Regenerate one atomic fixture proof bundle with current code and verify its
   manifest.
3. Regenerate the live security proof if credentials and the operator-owned
   environment remain available. Otherwise use the latest verified proof and
   label its date and source commit.
4. Redact:
   - tokens, keys, raw authorization headers, and environment values;
   - private hostnames, private IPs, local filesystem paths, and user names;
   - raw MCP error bodies that may contain endpoint data.
5. Re-run schema validation, proof audit, and manifest generation on the
   redacted export where applicable.
6. Track only high-signal artifacts:
   - fail-to-pass summary;
   - before/after receipts;
   - proof audit and manifest;
   - sanitized trace excerpts;
   - hosted-model diagnostic/proof status;
   - screenshots used in README/Devpost.
7. Create a claim ledger with claim, status, date, source commit, public
   evidence path, and verification command.
8. Exclude stale, failing, or conflicting bundles from the judge path.

## Acceptance Criteria

- Every major README/Devpost claim links to tracked evidence or is clearly
  labeled conditional.
- No secret or private endpoint information is present.
- Public evidence is tied to a commit and date.
- Proof status is internally consistent.
- The pack does not claim live SAIA invocation unless Move 07 passes.

## Verification

```bash
npm run splunkready -- proof-audit --out <final-proof-dir> --require-pass true
npm run splunkready -- verify-manifest --out <final-proof-dir>
npm run audit:submission-copy
git diff --check
git status --short
```

Run the repository's tracked-secret scan and manually inspect every screenshot.

## Stop Conditions

- Stop before committing raw live artifacts.
- Stop if redaction invalidates a claimed hash without regenerating the public
  manifest.
- Do not publish a failing certification index as the final proof.
