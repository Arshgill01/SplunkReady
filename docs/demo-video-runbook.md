# Demo Video Runbook

Move 23 status: prepared and locally rehearsable. Public upload is still required before this can be marked complete.

Source requirement: the Splunk Agentic Ops Hackathon page says the demo video must be under three minutes, show the project working, demonstrate AI use, explain the problem/value, and be publicly posted on YouTube, Vimeo, or Youku with the link included on the submission form.

## Public Link Status

- Public video URL: not submitted yet.
- Signed-out access check: not run yet.
- Duration check: not run yet.
- Upload target: YouTube, Vimeo, or Youku.
- Do not add the video link to `README.md` or `docs/devpost-submission.md` until the public URL works signed out.

## Recording Setup

Use the workbench as the primary surface:

```bash
npm install
SPLUNKREADY_WORKBENCH_PORT=4340 npm run workbench
```

Open:

```text
http://127.0.0.1:4340/#certification-replay
```

Recording constraints:

- Keep the final video under 180 seconds.
- Record the executable UI, not static Markdown or screenshots.
- Crop or hide the browser address bar if possible.
- Do not show `.splunkready*`, `.env*`, shell history, tokens, private endpoints, or raw live artifacts.
- Fixture certification is safe to show publicly.
- Live proof should only be shown if the visible artifact is sanitized and `mutation: false` is visible.

## Three-Minute Script

Target timing:

| Time | Shot | Narration |
| --- | --- | --- |
| 0:00-0:20 | Workbench landing and product name | "SplunkReady certifies AI agents before they touch production Splunk. It is not a SOC copilot; it is a readiness gate for Splunk-connected agents." |
| 0:20-0:45 | Start fixture certification | "This fixture path requires no live credentials, but it uses the same internal adapter boundary as live MCP mode." |
| 0:45-1:20 | Open run result, failed trace, violations | "The naive specimen searches too broadly, uses the wrong field, skips saved-search provenance, and reaches an unsupported conclusion. Deterministic grader rules produce the failed Readiness Receipt." |
| 1:20-1:45 | Policy guidance and rerun/result | "SplunkReady exports reviewable policy guidance. Hosted-model-style assistance can explain or suggest patches, but deterministic rules remain the pass/fail authority." |
| 1:45-2:15 | READY receipt and evidence refs | "After the policy-backed rerun, the same mission passes with saved-search provenance, row evidence, and a READY receipt." |
| 2:15-2:35 | Public proof export or evidence pack | "The proof bundle is manifest-verifiable and the public export is redacted before sharing." |
| 2:35-2:55 | External trace or MCP transcript path | "Any Splunk-connected agent can emit the canonical trace schema or MCP transcript and use SplunkReady as the pre-production certification gate." |
| 2:55-3:00 | Close | "The output is a Readiness Receipt for this agent, this mission, and this Splunk deployment." |

## Shot Checklist

- `Run fixture certification` is clicked in the browser.
- A managed job reaches `succeeded`.
- A failed-before state is visible: `NOT READY`, deterministic rule IDs, or violation count.
- A corrected-after state is visible: `READY / 100/100`.
- At least one evidence ref or saved-search provenance detail is visible.
- The public proof export/redaction boundary is visible.
- AI use is explained honestly:
  - bundled deterministic specimen is used for reproducible local proof;
  - Gemini-backed specimen is available only when env-gated;
  - hosted-model assistance is advisory and not the pass/fail judge.
- No secrets, private endpoints, personal data, or local absolute paths are visible.

## Verification Checklist

Run before uploading:

```bash
npm run check
git diff --check
```

Manual checks after upload:

- Open the video URL in a signed-out browser profile.
- Confirm duration is less than 3 minutes.
- Confirm audio is clear or captions are legible.
- Confirm no secrets, private endpoints, or local filesystem paths are visible.
- Confirm README and Devpost copy link to the public URL only after the signed-out check passes.

