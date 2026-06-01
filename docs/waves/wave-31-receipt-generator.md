# Wave 31 - Readiness Receipt Generator

## Goal

Generate the main enterprise artifact.

## Scope

- Markdown receipt.
- JSON receipt.
- Trace references.
- Before/after support.

## Files Owned

- receipt generator files.
- receipt templates.
- tests.

## Acceptance Criteria

- Receipt includes agent, environment, contract, suite, verdict, score, violations, evidence, policy patch summary.
- Critical issue list is readable.
- Every claim has trace or violation id.

## Verification

- receipt snapshot tests.
- provenance checks.

## Reviewer Checklist

- Would this belong in change review?
- Is provenance complete?

## Stop Conditions

- Receipt is just a dashboard export.

