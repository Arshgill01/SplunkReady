# Move 191 - Recapture Strong Zed MCP Recorder Evidence

## Status

Completed on 2026-06-08.

## Objective

Attempt to replace the compact Move 183 Zed evidence with a stronger real
desktop-client MCP session captured after Move 189's recorder flush-frame fix.
The target is a Zed-initiated session whose tracked JSONL visibly contains the
`splunkready_recorder_flush` request/response frame, both downstream server IDs,
Splunk investigation tool calls, deterministic certification, and
`mutation: false`.

## Expected touched files

- `moves/moves191.md`
- `docs/execplans/mcp-zed-external-client-session.md`
- `submission-evidence/mcp-proof/zed-client-session/*`
- `submission-evidence/mcp-proof/mcp-category-scorecard.json`
- `submission-evidence/mcp-proof/mcp-category-scorecard.md`
- `submission-evidence/screenshots/zed-mcp-recorder-summary.png`
- `submission-evidence/README.md`
- `submission-evidence/claim-ledger.md`
- `submission-evidence/evidence-pack-sha256.txt`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Verification

- Local recorder gateway sanity check with mock Splunk and SplunkReady MCP.
- Zed UI driven through Computer Use, not a scripted-only MCP client.
- Leak scan of tracked Zed artifacts before committing.
- `node scripts/audit-mcp-category-evidence.mjs --out submission-evidence/mcp-proof`
- `npx vitest run tests/scripts/mcp-category-evidence.test.ts`
- `npm run audit:submission-copy`
- evidence-pack SHA-256 regeneration and verification
- `npm run check` if source or guarded submission claims change.

## Boundaries

- Do not mutate live Splunk.
- Do not commit raw Zed settings, endpoint URLs, tokens, headers, local env file
  names, or local secret paths.
- Do not claim stronger third-party-client evidence unless the tracked redacted
  Zed JSONL actually contains it.
- Do not publish `0.1.6`; Move 190 remains blocked on npm OTP.

## Result

- Backed up the user's Zed settings, temporarily configured a credential-free
  `splunkready-recorder` context server, and drove Zed Agent through Computer
  Use in a disposable workspace.
- Verified the recorder gateway locally before using Zed.
- First Zed pass failed certification because the agent picked the wrong saved
  search; the failed artifact stayed untracked.
- Recaptured a passing Zed session by explicitly requiring the exact saved
  search `SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain`,
  token `host=win-finance-07`, and final evidence refs.
- Tracked the redacted Zed session and certification artifacts under
  `submission-evidence/mcp-proof/zed-client-session/`.
- Captured `submission-evidence/screenshots/zed-mcp-recorder-summary.png`,
  showing the Zed tool calls and the PASS/READY summary.
- Updated the MCP category scorecard so the Zed evidence tier is
  `VERIFIED_COMPACT_WITH_FLUSH`, score `98`, with one remaining
  compact-session warning.

## Claim Boundary

The MCP category evidence is now stronger than Move 188: it is real Zed
third-party-client evidence with visible Splunk investigation frames and a
visible `splunkready_recorder_flush` JSONL frame. It is still a compact 7-frame
session, so the public claim must not describe it as a large external-client
transcript.
