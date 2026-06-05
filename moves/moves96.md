# Move 96: GitHub Pages Deployment Verification

## Goal

Close or precisely document the hosted-demo cap by running the manual GitHub
Pages public demo workflow and verifying the resulting public URL when GitHub
provides one.

## Scope

- Trigger the `Public Demo Pages` workflow on `splunkready-build`.
- Watch the workflow to completion and record the run status.
- If deployment succeeds, extract the Pages URL from the workflow/deployment
  metadata.
- Open the resulting URL with Playwright and verify the public demo renders the
  MCP proof route without requiring live Splunk or Gemini secrets.
- Record the result and any blockers in the logs.

## Non-goals

- Do not change UI source or behavior.
- Do not add or read deployment secrets.
- Do not source or print `.splunkready*` / `.env*` files.
- Do not claim a hosted URL unless the workflow succeeds and the URL is opened
  successfully.
- Do not change deterministic grading, LLM/SAIA authority, MCP behavior, or
  Splunk mutation boundaries.

## Expected verification

- `gh workflow run "Public Demo Pages" --ref splunkready-build`
- `gh run watch <run-id> --exit-status`
- `gh run view <run-id> --json conclusion,status,url`
- Playwright open/snapshot/eval for the deployed Pages URL, if available.
- `git diff --check`
