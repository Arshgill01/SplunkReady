# Move 78: Refreshed Submission Evidence Pack

## Trigger

The minimax audit identified the tracked `submission-evidence/` pack as stale.
It still described Move 21 evidence and did not include the newer compiler
diagnostics, MCP resources/prompts, MCP client certification loop, or current
Playwright-verified workbench screenshots.

## Scope

- Regenerate the credential-free suite proof in `submission-evidence/suite-proof/`.
- Add the credential-free MCP proof bundle in `submission-evidence/mcp-proof/`.
- Refresh the redacted public proof export in `submission-evidence/public-proof-export/`.
- Capture current packaged workbench, trace timeline, and public export screenshots with Playwright.
- Refresh `submission-evidence/README.md`, `claim-ledger.md`, and evidence hashes.
- Fix any evidence-generation bug found while refreshing the pack.

## Boundaries

- Do not read, source, print, or commit `.env*` or `.splunkready*` files.
- Do not include ignored live proof artifacts or deployment inventory in the tracked pack.
- Do not make LLM output authoritative for readiness.
- Do not perform `npm publish` or deployment work.
- Do not change final submission video or form assets.
- Do not use subagents.

## Acceptance

- Suite proof audit and manifest verification pass from `submission-evidence/suite-proof/`.
- MCP transcript manifest verification passes from `submission-evidence/mcp-proof/`.
- Public proof export manifest verification passes from `submission-evidence/public-proof-export/`.
- Playwright screenshots are refreshed and tracked.
- Evidence pack SHA file verifies.
- Full repository checks pass.
