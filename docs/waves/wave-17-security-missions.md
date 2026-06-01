# Wave 17 - Security Missions

## Goal

Generate flagship security investigation missions.

## Scope

- Lateral movement investigation.
- Dashboard silence diagnosis.
- Saved-search discipline.
- True-positive/false-positive evidence task.

## Files Owned

- mission generator files.
- mission fixtures.
- mission tests.

## Acceptance Criteria

- Missions exercise wrong field, saved search, app context, and evidence traps.
- Missions are grounded in contract objects.
- Each mission has expected deterministic checks.

## Verification

- mission generation tests.
- `rg -n "lateral|dashboard|saved search|evidence" fixtures* src*`

## Reviewer Checklist

- Is story strong enough for video?
- Are traps too artificial?

## Stop Conditions

- Mission cannot be explained in judge language.

