# Move 183 - Zed External MCP-Client Session

## Intent

Unpark Move 151 by attempting a real Zed Agent session against SplunkReady's MCP
recorder gateway. The goal is to prove a third-party client can consume the
SplunkReady MCP surface, route read-only Splunk investigation calls, and produce
a certifiable Readiness Receipt without relying on SplunkReady's own scripted
proof harness.

## Scope

- Ground the work in `docs/execplans/mcp-zed-external-client-session.md`.
- Sanity-check the recorder gateway before opening Zed.
- Configure or verify a Zed context server for the SplunkReady recorder, without
  leaking secrets or mutating real Splunk.
- Use Computer Use to open Zed in an empty workspace and drive the Agent UI.
- Attempt to set GPT-5.5 and low reasoning if the Zed UI exposes those controls.
- Capture screenshots and redacted session artifacts only if Zed itself
  initiates MCP tool calls.
- If Zed cannot consume MCP tools, log the precise blocker and preserve the
  harness sanity evidence without claiming third-party-client proof.

## Expected touched files

- `docs/execplans/mcp-zed-external-client-session.md`
- `moves/moves183.md`
- `submission-evidence/mcp-proof/zed-client-session/`
- `submission-evidence/screenshots/zed-mcp-context-server.png`
- `submission-evidence/screenshots/zed-mcp-session.png`
- `submission-evidence/screenshots/zed-mcp-receipt.png`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

Additional source or test files may be touched only if the recorder gateway has
a real product bug that blocks external-client use.

## Verification

- `node dist/src/cli.js mcp-recorder --help`
- local recorder gateway/tool-list sanity check
- Zed UI inspection through Computer Use
- leak scan for tracked Zed/MCP session evidence
- focused MCP tests if code changes are made
- `npm run check` if source or audit guards change

## Claim Rule

Do not update the claim ledger with external-client evidence unless a redacted
session proves that Zed itself initiated MCP tool calls.

## Result

Implemented.

The Zed Agent external-client run proved the useful third-party-client path:

- Zed was opened in a disposable workspace with a project-local
  `splunkready-recorder` MCP context server.
- Zed used GPT-5.5 with Low reasoning in the visible agent UI.
- Zed initiated MCP tool calls itself; this was not a local proof script.
- Zed called `splunk__splunk_get_knowledge_objects` and
  `splunk__splunk_run_saved_search` against the mock Splunk MCP server through
  the recorder gateway.
- Zed then called `splunkready_recorder_flush`, which certified the actual
  captured frames into a deterministic Readiness Receipt.

Evidence:

- `submission-evidence/mcp-proof/zed-client-session/zed-mcp-recorder-session.jsonl`
- `submission-evidence/mcp-proof/zed-client-session/zed-mcp-recorder-session.md`
- `submission-evidence/mcp-proof/zed-client-session/mcp-transcript-certification.json`
- `submission-evidence/mcp-proof/zed-client-session/receipt-external-001.json`
- `submission-evidence/screenshots/zed-mcp-recorder-summary.png`

Verification:

- focused MCP server and recorder tests passed;
- TypeScript build passed;
- Zed-driven recorder summary reports `Status: PASS`;
- transcript certification reports `status: "PASS"`;
- receipt reports `verdict: "READY"`, `score: 100`, and `mutation: false`;
- tracked text evidence scan found no local paths, bearer headers, token names,
  secret names, password strings, or endpoint values.

Implementation notes:

- The first Zed attempt exposed that the recorder gateway `initialize` response
  was missing `capabilities`, which Zed requires.
- The second Zed attempt exposed that downstream SplunkReady MCP defaults were
  resolved from Zed's workspace instead of the package root.
- The direct inline transcript certification tool was too easy for an editor
  agent to misuse because Zed reconstructed summarized tool outputs instead of
  the full structured MCP response. The tool description now documents the
  expected JSONL shape, but the production-grade external-client path is the
  recorder gateway: record actual frames, then flush/certify them.
- The final Zed attempt exposed that `splunkready_recorder_flush` returned only
  `structuredContent`; it now returns normal MCP text content plus structured
  content so editor clients can display the PASS.
