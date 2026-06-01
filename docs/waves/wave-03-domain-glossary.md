# Wave 03 - Domain Glossary

## Goal

Stabilize language before schemas and UI.

## Scope

Define:

- Environment Contract
- Mission
- Trace Event
- Violation
- Readiness Receipt
- Policy Patch
- Specimen Agent
- Fixture Adapter
- Live Adapter

## Files Owned

- `docs/domain-glossary.md`

## Acceptance Criteria

- Every core noun has a crisp definition.
- Glossary matches `docs/schemas/core-contracts.md`.
- No generic "scorecard" language replaces receipt/provenance.

## Verification

- `rg -n "Environment Contract|Readiness Receipt|Specimen Agent" docs/domain-glossary.md docs/schemas`

## Reviewer Checklist

- Are terms reused consistently?
- Any overloaded Splunk term used incorrectly?

## Stop Conditions

- Glossary conflicts with Splunk terminology or prior decisions.

