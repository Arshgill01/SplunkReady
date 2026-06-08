# ExecPlan: Zed External MCP-Client Session

Created: 2026-06-08

## Objective

Unpark the external MCP-client evidence move by proving that a real third-party
client, Zed Agent, can consume SplunkReady's MCP surface and produce a
certifiable Readiness Receipt from the session.

The point is not another scripted `mcp-proof`. The value is showing that the
same MCP contract works when an external agent harness initiates the tool calls,
uses Splunk investigation tools, and asks SplunkReady to certify the captured
transcript.

## Why The Previous Attempt Failed

- Desktop capture showed mostly static windows and did not prove tool use.
- The run did not establish that the external client, rather than SplunkReady's
  own scripts, initiated MCP calls.
- There was no redacted JSON-RPC session tied to a receipt.
- There were no useful screenshots showing MCP tools, tool calls, and the
  certification result together.
- Without the recorder gateway, separate `splunk` and `splunkready` servers
  made it hard to reconstruct one dual-server session cleanly.

## Strategy

Use the existing `splunkready mcp-recorder` gateway as the client-facing MCP
server for Zed. The recorder proxies to two downstream servers:

- `splunk`: the credential-free mock Splunk MCP server, for read-only
  investigation tools.
- `splunkready`: SplunkReady's own MCP server, for certification and hosted
  model diagnostics.

Zed should connect to the recorder gateway. Zed's agent should call Splunk
tools through the recorder, then call the recorder flush tool so the session is
written, redacted, summarized, and certified.

## Success Criteria

### Tier 0: Harness Sanity

- A local recorder gateway can start with
  `--server splunk=mock-splunk-mcp --server splunkready=mcp`.
- A local probe can list the tools exposed by the recorder.
- The recorder output directory is writable and contains no credentials.

This tier does not count as external-client evidence. It only proves the
harness is ready before using Zed.

### Tier 1: Zed Configuration Proof

- Zed has a dedicated SplunkReady recorder context server configured with no
  secrets and no write-capable Splunk endpoint.
- The config uses absolute local paths or the published package command so Zed
  can start the server from an empty workspace.
- A screenshot or settings excerpt proves the context server exists without
  leaking tokens, endpoint URLs, or user secrets.

This tier still does not count as external-client evidence.

### Tier 2: Zed-Triggered MCP Session

This is the evidence bar.

- Zed Agent is opened in an empty workspace.
- If the UI exposes it, the model is set to GPT-5.5 and reasoning is set to low.
- Zed itself triggers MCP tool calls through the recorder gateway.
- The redacted session includes calls to at least one Splunk investigation tool
  and the recorder flush/certification path.
- The session summary references the Zed client, both downstream server IDs, the
  tools used, and the generated receipt path.
- The certification receipt keeps `mutation: false`.
- Screenshots show the Zed MCP context/tool surface, the agent session with tool
  use, and the receipt or session artifact.

## Evidence Targets

- `submission-evidence/mcp-proof/zed-client-session/`
- `submission-evidence/screenshots/zed-mcp-context-server.png`
- `submission-evidence/screenshots/zed-mcp-session.png`
- `submission-evidence/screenshots/zed-mcp-receipt.png`
- `moves/moves183.md`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

If the Zed agent cannot call MCP tools because of client, model, account, or UI
limitations, write a blocker record instead of claiming success.

## Stop Conditions

- Do not claim third-party client evidence unless Zed itself initiates MCP
  calls.
- Do not commit raw Zed logs, endpoint URLs, tokens, headers, env file names, or
  local secret paths.
- Do not mutate a real Splunk deployment during this move.
- Do not make LLM output authoritative for receipt verdicts.
- Do not destructively edit the user's Zed settings. If settings must change,
  back them up first and make the smallest reversible addition.

## Expected Verification

- `node dist/src/cli.js mcp-recorder --help`
- a local recorder MCP probe or equivalent tool-list sanity check
- Zed UI screenshots captured through Computer Use or Playwright/browser
  tooling where practical
- leak scan of any tracked recorder/session artifacts
- focused MCP tests if source changes are needed
- `npm run check` before commit if source or audit guards change

## Open Questions

- Whether Zed's installed Agent UI exposes GPT-5.5 and low-reasoning controls.
- Whether Zed displays MCP tool calls clearly enough for useful screenshots.
- Whether Zed can drive a multi-step tool flow reliably without needing a
  scripted harness. If not, the honest result is a blocker plus local recorder
  proof, not a third-party-client claim.

## Outcome

Completed on 2026-06-08 as Move 183.

What worked:

- Zed Agent was opened in a disposable workspace with the project-local
  `splunkready-recorder` MCP context server.
- Zed's visible agent UI showed GPT-5.5 with Low reasoning.
- Zed itself initiated MCP tool calls through the recorder gateway.
- The final Zed session called:
  - `splunk__splunk_get_knowledge_objects`;
  - `splunk__splunk_run_saved_search`;
  - `splunkready_recorder_flush`.
- The recorder certified the actual captured frames, not a reconstructed
  transcript, and produced a `READY` Readiness Receipt with score `100`,
  `mutation: false`, and evidence refs `evt-102`, `evt-118`, `evt-141`.

Evidence:

- `submission-evidence/mcp-proof/zed-client-session/zed-mcp-recorder-session.jsonl`
- `submission-evidence/mcp-proof/zed-client-session/zed-mcp-recorder-session.md`
- `submission-evidence/mcp-proof/zed-client-session/mcp-transcript-certification.json`
- `submission-evidence/mcp-proof/zed-client-session/receipt-external-001.json`
- `submission-evidence/screenshots/zed-mcp-recorder-summary.png`

Findings from the failed attempts:

- Zed requires `initialize.capabilities`; the recorder gateway now returns MCP
  tool capabilities.
- Editor clients may launch MCP servers from an arbitrary workspace; the
  recorder now resolves built-in downstream SplunkReady paths from the package
  root instead of the client workspace.
- Asking an editor LLM to reconstruct full JSON-RPC transcripts is fragile. Zed
  produced syntactically valid JSONL but summarized structured Splunk responses,
  which failed the strict inline transcript gate. The better product path is the
  recorder gateway: capture the actual frames and certify them with
  `splunkready_recorder_flush`.
- `splunkready_recorder_flush` must return both MCP text `content` and
  `structuredContent`; Zed treated structured-only output as a client-visible
  failure even while disk certification succeeded.

## Move 191 Continuation

Move 191 recaptured the Zed evidence after the recorder gateway began
persisting `splunkready_recorder_flush` frames.

What improved:

- Zed Agent again ran in a disposable workspace with GPT-5.5 Low visible in the
  UI.
- Zed itself triggered `splunk__splunk_get_knowledge_objects`,
  `splunk__splunk_run_saved_search`, and `splunkready_recorder_flush`.
- The tracked redacted Zed JSONL now contains 7 frames, including the visible
  recorder-flush request/response frame.
- The certification artifact reports `PASS`, the receipt reports `READY`,
  score `100`, `mutation: false`, and evidence refs `evt-102`, `evt-118`, and
  `evt-141`.
- The MCP category scorecard now reports score `98` and
  `zedEvidenceTier: "VERIFIED_COMPACT_WITH_FLUSH"`.

Remaining boundary:

- This is real third-party-client evidence with visible flush, but it remains a
  compact 7-frame session. Do not claim a large external-client transcript until
  a future run captures one.

Operational lesson:

- A vague Zed prompt picked the wrong saved search (`search::Lateral Movement
  Investigation`) and failed deterministic certification. The passing prompt
  named the exact app, saved search, token, and evidence expectations:
  `SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain`,
  `host=win-finance-07`, and refs `evt-102`, `evt-118`, `evt-141`.
