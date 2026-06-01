# Wave 24 - Field and Sourcetype Checks

## Goal

Grade queries against the Environment Contract.

## Scope

- Field existence.
- Canonical field mapping.
- Sourcetype existence.
- Restricted index checks.

## Files Owned

- contract rule files.
- rule tests.

## Acceptance Criteria

- `src_ip` fails when contract defines canonical `src`.
- Unknown sourcetype fails or warns by mission severity.
- Restricted index access fails.

## Verification

- field/sourcetype tests.

## Reviewer Checklist

- Are contract lookups deterministic?
- Are warnings vs failures well defined?

## Stop Conditions

- Rule depends on model interpretation of query intent.

