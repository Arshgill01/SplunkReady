# Wave 32 - Policy Patch Export

## Goal

Export a policy patch that improves agent behavior.

## Scope

- Saved-search discovery rule.
- Evidence rule.
- Query budget rule.
- Untrusted-data rule.
- Contract injection summary.

## Files Owned

- policy patch generator files.
- tests.

## Acceptance Criteria

- Patch is machine-readable and human-readable.
- Patch references violations.
- Patch does not mutate Splunk.

## Verification

- policy patch tests.
- before/after fixture rerun.

## Reviewer Checklist

- Does patch fix observed failures?
- Is patch too broad or unsafe?

## Stop Conditions

- Patch is generic prompt fluff.

