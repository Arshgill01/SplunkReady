# Wave 45 - Judge Resilience

## Goal

Harden the project for external judging, fresh clones, and final submission review.

## Scope

- Fresh clone instructions.
- Dependency and Node version checks.
- License and submission copy review.
- Final artifact cleanup.
- Reviewer Critical and High finding closure.

## Files Owned

- judge resilience report.
- README and submission docs if gaps are found.
- execution and verification logs.

## Acceptance Criteria

- A fresh checkout can run the fixture demo from README instructions.
- Submission copy matches the product boundary.
- No unresolved Critical or High reviewer findings remain.
- Repo is clean except intentional final artifacts.

## Verification

- README setup dry run.
- `npm run check`
- demo command from `docs/demo-script.md`
- reviewer inbox audit

## Reviewer Checklist

- Would a judge see a real product rather than scaffolding?
- Are limitations and live-mode boundaries explicit?

## Stop Conditions

- Any submission claim is not backed by contract, trace, violation, receipt, or documented limitation.
