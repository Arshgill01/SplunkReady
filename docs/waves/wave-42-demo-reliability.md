# Wave 42 - Demo Reliability Iteration

## Goal

Keep improving the judge-facing demo after final QA instead of stopping at the original wave list.

## Scope

- Demo timing stability.
- Artifact completeness checks.
- Local preview reliability.
- Screenshot and route verification.

## Files Owned

- demo reliability report.
- verification log.
- narrowly scoped CLI or UI fixes if evidence shows a demo blocker.

## Acceptance Criteria

- Demo still rehearses under 3 minutes.
- Generated artifacts are complete and linked from the UI.
- Primary route `splunkready-shell.html#rerun-receipts` opens cleanly.
- Any fixes preserve fixture/live adapter parity.

## Verification

- `npm run check`
- demo command from `docs/demo-script.md`
- browser or screenshot verification of the generated UI route

## Reviewer Checklist

- Can a judge reproduce the demo from the README?
- Are all claims backed by receipt, trace, or policy patch artifacts?

## Stop Conditions

- Demo reliability changes alter the product boundary or hide fixture mode.
