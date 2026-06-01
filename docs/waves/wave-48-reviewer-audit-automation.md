# Wave 48 - Reviewer Audit Automation

## Goal

Make reviewer inbox auditing repeatable so continuation waves do not rely on pasted one-off scripts.

## Scope

- Add a repo-native reviewer inbox audit command.
- Include numbered wave files and `unknown-wave` reviewer files.
- Fail when the latest reviewer verdict for any group is failing.
- Report pass-with-concerns counts without blocking.
- Keep the audit deterministic and credential-free.

## Files Owned

- reviewer audit script.
- package scripts.
- execution and verification logs.
- reviewer inbox files if new findings arrive.
- wave index docs if needed.

## Acceptance Criteria

- `npm run audit:reviewers` exits nonzero on unresolved latest failing reviewer verdicts.
- Current reviewer inbox audit passes.
- Audit output includes the number of audited reviewer groups and pass-with-concerns files.
- Normal fixture checks still require no live Splunk credentials.

## Verification

- `npm run audit:reviewers`
- `npm run check`
- `bash scripts/verify-scaffold.sh`

## Reviewer Checklist

- Does the audit cover late reviewer files and unknown-wave findings?
- Could a failing latest reviewer verdict be missed by filename ordering or parsing?

## Stop Conditions

- Audit automation hides or waives Critical/High findings implicitly.
