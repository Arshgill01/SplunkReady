# Move 167 - Splunkbase Submission Readiness

## Intent

Turn the live-installed, AppInspect-clean Splunk app package into a
submission-ready Splunkbase/Splunk Cloud app candidate. This is the
Use-of-Splunk capstone, but it must be evidence-driven rather than a badge claim.

## Scope

- Research current official Splunkbase and Splunk Cloud app submission
  requirements from Splunk documentation.
- Add a Splunkbase readiness checklist mapped to the package contents,
  AppInspect result, live install proof, screenshots, README, license, support
  metadata, and no-secret/no-handler/no-scripted-input claims.
- Add missing metadata required for submission only when it is safe and accurate.
- Produce `submission-evidence/splunkbase-readiness/` with the checklist,
  AppInspect report reference, live install proof reference, and any blocked
  requirements.
- If the user provides publisher/account access, submit the `.spl` package or
  document the exact external blocker. Do not claim "Available on Splunkbase"
  until Splunkbase actually lists it.

## Non-Goals

- Do not fabricate Splunkbase approval.
- Do not weaken AppInspect, credential, or no-auto-mutation boundaries just to
  satisfy a checklist.
- Do not submit to a paid or production-connected service without explicit
  operator confirmation.

## Verification

- Official documentation links captured in the readiness artifact.
- AppInspect still reports 0 errors and 0 failures.
- Live install proof remains `PASS`.
- `npm run check`

