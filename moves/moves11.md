# Move 11 - Record The Public Demo And Submit Valuable Feedback

## Goal

Produce a compliant, high-signal public video and complete the separate Most
Valuable Feedback submission flow.

## Demo Video Requirements

The video must be under three minutes, publicly visible on YouTube, Vimeo, or
Youku, show the project functioning, visibly demonstrate how AI is used,
explain the problem, and state the value. An unlisted/private or fixture-only
video is insufficient.

## Video Storyboard

Use a timed rehearsal before recording:

1. **0:00-0:20 - Problem and category.** Agents can query Splunk, but teams need
   deployment-specific certification before trusting them.
2. **0:20-0:45 - Architecture.** Show the root diagram: adapter, compiler,
   mission, agent, trace, deterministic grader, receipt, and policy feedback.
3. **0:45-1:30 - Working fixture loop.** Run the repeatable fail-to-pass demo
   and show the before receipt, violations, policy-backed rerun, and READY
   receipt.
4. **1:30-2:05 - AI plus deterministic boundary.** Show a Gemini-backed specimen
   or verified live Gemini proof. Explain that AI is the subject and advisor;
   deterministic rules decide pass/fail.
5. **2:05-2:35 - Real Splunk evidence.** Show sanitized live MCP/security proof,
   mutation false, and SAIA status truthfully.
6. **2:35-2:55 - Developer impact.** Show MCP transcript certification and the
   Readiness Receipt as a CI artifact.

## Scope

Expected files:

- demo script/checklist
- README and Devpost public video links
- selected sanitized screenshots in Move 06
- concise feedback-form draft and confirmation record
- current wave and logs

Do not commit a large raw video unless repository policy explicitly chooses to.

## Feedback Submission Plan

1. Condense `logs/splunk-feedback.md` into actionable items with observed
   behavior, developer impact, and suggested improvement.
2. Cover MCP envelope behavior, local setup friction, saved-search context,
   ingestion/documentation issues, and SAIA entitlement opacity.
3. Submit the official Devpost feedback form before June 19, 2026 at 9:00 AM
   PDT. One feedback submission per entrant.
4. Record confirmation without personal data or secrets.

## Acceptance Criteria

- Final video is under three minutes and publicly accessible while logged out.
- Video visibly demonstrates AI usage and deterministic pass/fail separation.
- No credentials, private endpoints, private IPs, local paths, or copyrighted
  music appear.
- Video, README, Devpost, and public evidence tell the same story.
- Official feedback form is submitted and confirmation is recorded.

## Verification

```bash
npm run splunkready -- demo --out <video-fixture-dir>
npm run check
git diff --check
```

Manually verify duration, public accessibility, audio, legibility, links, and
secret redaction from a signed-out browser session.

## Stop Conditions

- Stop and rerecord if AI usage is only narrated but not demonstrated.
- Stop and rerecord if any secret or private endpoint appears.
- Do not claim a feedback prize merely because a feedback document exists.
