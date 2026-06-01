# Wave 13 - Knowledge Normalizer

## Goal

Normalize Splunk knowledge objects into stable internal records.

## Scope

- Saved searches.
- Macros.
- Lookups.
- Dashboards/panels.
- Field aliases/extractions.
- App contexts.

## Files Owned

- normalizer files.
- normalizer tests.

## Acceptance Criteria

- Each normalized object has id, type, name, app, owner/source when available.
- Dependencies are extracted where deterministic.
- Unknown fields are preserved as raw metadata.

## Verification

- normalizer tests.
- fixture object roundtrip.

## Reviewer Checklist

- Is app context preserved?
- Are raw objects accessible for debugging?

## Stop Conditions

- Normalization loses dependency information.

