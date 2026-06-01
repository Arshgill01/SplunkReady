# Wave 66 - Live Smoke Safety Refresh

## Goal

Refresh live-smoke safety evidence against the current implementation without requiring live Splunk credentials.

## Scope

- Re-check the optional live smoke path from current source and tests.
- Prove the no-credential path skips cleanly, writes no live artifacts, and does not expose token values.
- Prove the mocked live path stays inventory-only and read-only through existing CLI tests.
- Record the current evidence in a focused report.
- Do not introduce live Splunk credentials, production endpoint assumptions, or write operations.
- Do not change adapter interfaces unless verification reveals a concrete defect.

## Files Owned

- live-smoke safety refresh report.
- wave index docs.
- current-state handoff docs.
- execution and verification logs.
- reviewer inbox files if new findings arrive.

## Acceptance Criteria

- Live smoke remains opt-in.
- Normal fixture verification and the no-credential live-smoke skip path require no live Splunk credentials.
- Skip output is actionable and does not reveal secret values.
- The mocked live smoke test proves the smoke path calls only inventory read-only tools.
- No Splunk mutation path is introduced.
- Goal remains open pending explicit user approval.

## Verification

- targeted no-credential `live-smoke` skip command.
- targeted CLI live-smoke tests.
- `npm run audit:reviewers`
- `bash scripts/verify-scaffold.sh && git diff --check`

## Reviewer Checklist

- Does the report prove current behavior rather than repeating old claims?
- Does any normal verification require live Splunk credentials?
- Does the live-smoke path stay inventory-only and read-only?
- Does the wave avoid claiming final completion?

## Stop Conditions

- Live smoke requires credentials for fixture or normal CI checks.
- Live smoke calls query, saved-search, write, or mutation-capable tools.
- Any output leaks a token or secret value.
