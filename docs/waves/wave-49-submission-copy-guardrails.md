# Wave 49 - Submission Copy Guardrails

## Goal

Make product-boundary and submission-copy checks repeatable before future submission edits.

## Scope

- Add a deterministic copy audit for README and submission docs.
- Check required product-lock phrases and anti-drift boundaries.
- Keep the audit local and dependency-free.
- Avoid blocking legitimate negative statements such as "Not a chatbot."

## Files Owned

- submission copy audit script.
- package scripts.
- execution and verification logs.
- reviewer inbox files if new findings arrive.
- wave index docs if needed.

## Acceptance Criteria

- Audit verifies product name, tagline, engine, receipt artifact, submission track, and flagship story.
- Audit verifies fixture/live boundaries and non-mutation claims.
- Audit verifies anti-drift exclusions are stated in judge-facing docs.
- `npm run audit:submission-copy` passes.
- Normal fixture checks still require no live Splunk credentials.

## Verification

- `npm run audit:submission-copy`
- `npm run audit:reviewers`
- `npm run check`
- `bash scripts/verify-scaffold.sh`

## Reviewer Checklist

- Does the audit protect against chatbot/copilot/dashboard/generic-eval drift without forbidding required negative statements?
- Are every audited claims backed by docs, traces, receipts, or limitations?

## Stop Conditions

- Audit script becomes a substitute for evidence-backed product claims.
