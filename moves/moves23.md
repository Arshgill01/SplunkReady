# Move 23 - Record Public Demo Video And Submit Feedback

## Goal

Produce the required public demo video and complete the separate Splunk feedback
submission while keeping both grounded in actual product behavior.

## Scope

Expected files:

- demo script/checklist
- README/Devpost video link
- feedback-form draft or confirmation record without personal data
- logs

Do not commit large raw video files unless explicitly approved.

## Plan

1. Use the workbench as the primary video surface.
2. Show fixture certification from UI: start run, progress, NOT READY, policy
   feedback, rerun, READY.
3. Show live MCP/security evidence if available, with mutation false.
4. Show AI usage: Gemini-backed specimen or live Gemini proof, while explaining
   deterministic rules decide verdicts.
5. Show external trace or MCP transcript certification briefly.
6. Keep video under three minutes and publicly visible on an accepted host.
7. Scrub for secrets, private endpoints, and local paths.
8. Condense `logs/splunk-feedback.md` into the official feedback form and
   record submission confirmation.

## Acceptance Criteria

- Public video link works while signed out.
- Video is under three minutes and demonstrates actual AI usage.
- Video shows the executable UI, not just static artifacts.
- Feedback form is submitted before the official deadline.
- No secrets or private deployment details are visible.

## Verification

```bash
npm run workbench
npm run check
git diff --check
```

Manual checks: signed-out video access, duration, audio, legibility, and redaction.

## Stop Conditions

- Stop and rerecord if the video only shows a static reader.
- Stop and rerecord if any secret or private endpoint appears.
- Do not claim feedback submission until the form is actually submitted.
