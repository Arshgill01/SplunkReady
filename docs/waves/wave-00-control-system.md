# Wave 00 - Control System

## Goal

Make the repository navigable before implementation begins.

## Scope

- Root docs are present.
- Logs are initialized.
- Reviewer loop is documented.
- Scaffold verifier exists.

## Files Owned

- `AGENTS.md`
- `MANIFEST.md`
- `PLAN.md`
- `DECISIONS.md`
- `QUALITY-BAR.md`
- `logs/*`
- `scripts/verify-scaffold.sh`

## Acceptance Criteria

- A new agent can identify the product, build loop, and current phase in under five minutes.
- Verification command reports required docs and waves.
- No source implementation files are required yet.

## Verification

- `bash scripts/verify-scaffold.sh`
- `find . -maxdepth 3 -type f | sort`

## Reviewer Checklist

- Does `AGENTS.md` prevent one-shot execution?
- Are stop conditions explicit?
- Are logs ready for use?

## Stop Conditions

- Missing root guidance.
- Verifier does not check wave count.

