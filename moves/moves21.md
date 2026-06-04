# Move 21 - Produce The Submission Evidence Pack

## Goal

Create a tracked, sanitized evidence package that judges can inspect without
access to ignored local `artifacts/`, live credentials, or private deployment
details.

## Scope

Expected files:

- `submission-evidence/` or equivalent tracked evidence directory
- export/redaction workflow from Move 19 if available
- proof summaries, selected receipts, audits, manifests, and screenshots
- claim ledger mapping public claims to evidence
- `.gitignore` adjustment only if needed
- logs

## Plan

1. Regenerate final fixture proof artifacts from the frozen commit.
2. Regenerate live proof artifacts only if the operator-owned environment is
   available and current.
3. Export/redact evidence through Move 19 or a manual equivalent.
4. Include receipts, traces or trace excerpts, policy patches, proof audits,
   manifests, hosted-model status, and workbench screenshots.
5. Redact tokens, endpoints, private IPs, user paths, and raw MCP error bodies.
6. Add a claim ledger with claim, status, evidence path, verification command,
   date, and source commit.
7. Exclude stale or contradictory bundles.

## Acceptance Criteria

- Judge-facing evidence is tracked and accessible from a clone.
- Every major public claim has an evidence path or is labeled conditional.
- No secrets or private deployment identifiers are present.
- Manifest/audit status is internally consistent.

## Verification

```bash
npm run splunkready -- proof-audit --out <final-proof-dir> --require-pass true
npm run splunkready -- verify-manifest --out <final-proof-dir>
npm run audit:submission-copy
git diff --check
```

Run a secret scan and manually inspect every screenshot.

## Stop Conditions

- Stop before committing raw live artifacts.
- Stop if redaction invalidates hashes without regenerating manifests.
- Stop before citing ignored local artifacts as public evidence.
