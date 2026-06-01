# Wave 08 - Fixture Knowledge Objects

## Goal

Seed Splunk knowledge-object traps.

## Scope

- Saved searches.
- Dashboards/panels.
- Macros.
- Lookups.
- Field aliases.
- Data model hints.
- App contexts.

## Files Owned

- fixture knowledge-object files.

## Acceptance Criteria

- Wrong-field trap exists: `src_ip` vs `src`.
- Saved search trap exists.
- App-context trap exists.
- Objects include stable ids and app names.

## Verification

- fixture validation tests.
- `rg -n "src_ip|src|saved search|app" fixtures* src*`

## Reviewer Checklist

- Are traps plausible Splunk failures?
- Does each trap support a deterministic grade?

## Stop Conditions

- Trap can only be detected by an LLM.

