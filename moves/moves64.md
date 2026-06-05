# Move 64: Official Hackathon Rubric Grounding

## Trigger

The Minimax audit flagged that the repo did not track the official hackathon
criteria, so probability estimates and award prioritization were based on
assumptions. The user also corrected the MCP category framing: Best Use of
Splunk MCP Server is about using Splunk MCP effectively, not merely building a
separate MCP server.

## Scope

- Add a tracked rubric file sourced from the official Splunk Agentic Ops
  Hackathon rules and announcement.
- Make the MCP bonus-prize implication explicit: SplunkReady's strongest MCP
  story is certifying behavior at the Splunk MCP Server boundary.
- Wire the rubric into the repo reading path and public materials list.
- Update risk tracking so future moves are grounded against the official
  criteria.

## Boundaries

- Do not claim video upload, feedback submission, npm publication, or hosted
  demo completion.
- Do not change product scope.
- Do not make LLM grading authoritative.
- Do not read, source, print, or commit `.env*` or `.splunkready*` files.
- Do not change UI source; Playwright is not required.
- Do not use subagents.

## Acceptance

- Official criteria are captured in `docs/hackathon-rubric.md` with source URLs.
- `MANIFEST.md`, `README.md`, and `logs/risk-register.md` reference the rubric
  or its consequences.
- Scaffold, submission-copy audit, and canonical repository checks pass.
