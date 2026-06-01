# Wave 47 - Demo Artifact Integrity

## Goal

Tighten verification that the fixture demo artifact bundle is complete, parseable, and internally cross-referenced for judge review.

## Scope

- Check demo artifact lists against files on disk.
- Verify receipt Markdown and JSON agree on verdicts and rule IDs.
- Verify UI route and rehearsal metadata point at real generated files.
- Keep checks fixture-only and credential-free.

## Files Owned

- CLI flow tests or focused artifact integrity tests.
- artifact integrity report.
- execution and verification logs.
- reviewer inbox files if new findings arrive.
- wave index docs if needed.

## Acceptance Criteria

- Demo artifact metadata references only files that exist.
- Before and after receipt Markdown agree with JSON verdicts.
- Required deterministic rule IDs remain visible in judge-facing artifacts.
- Fixture mode still requires no live Splunk credentials.
- No generated artifacts are committed.

## Verification

- targeted artifact integrity test.
- `npm run check`
- fixture demo command and artifact inspection.
- reviewer inbox audit.

## Reviewer Checklist

- Could a judge open the artifact bundle and trace the fail -> patch -> rerun -> pass story without hidden local state?
- Are receipt claims backed by JSON, Markdown, UI, trace, violation, or rehearsal artifacts?

## Stop Conditions

- Any artifact integrity check starts depending on live Splunk credentials.
