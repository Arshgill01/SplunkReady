# Strong Zed MCP External Client Session ExecPlan

## Goal

Remove the MCP category's remaining compact-session limitation by capturing a
stronger real Zed Agent session through the SplunkReady MCP recorder gateway.
The proof should raise the scorecard from `PASS_WITH_LIMITATIONS` to `PASS`
when the Zed JSONL contains at least 12 frames and a visible recorder flush.

## Current Reality

- Move 207 replaced the compact Zed evidence with a 15-frame Zed Agent session.
- The tracked JSONL contains Splunk investigation frames and a visible
  `splunkready_recorder_flush` frame.
- `scripts/audit-mcp-category-evidence.mjs --require-strong` now reports
  `PASS`, score `100`, and `zedEvidenceTier: "VERIFIED_STRONG"`.
- `docs/mcp-topology.md` now describes the Zed proof as strong,
  credential-free third-party-client evidence, not an operator-live Splunk
  session.
- The Zed settings change was made through a dedicated credential-free
  recorder context server rather than the live Splunk env-backed servers.

## Design

1. Back up `~/.config/zed/settings.json`.
2. Add or refresh one Zed context server named `splunkready-recorder` that runs:
   `node dist/src/cli.js mcp-recorder --server splunk=mock-splunk-mcp --server splunkready=mcp --out artifacts/zed-external-mcp-client-session-strong --fixture fixtures/adapter-fixture.json`.
3. Open Zed in an empty disposable workspace.
4. Use the visible Agent UI with GPT-5.5 Low if the controls are available.
5. Prompt Zed to perform a deliberately multi-step read-only investigation:
   describe certification posture, inspect mock Splunk info, inspect knowledge
   objects more than once, run the saved search, review composition, then flush.
6. Copy the generated recorder artifacts into
   `submission-evidence/mcp-proof/zed-client-session/`.
7. Run the MCP category audit with `--require-strong`.
8. Capture public-safe screenshots of the Zed session and resulting receipt or
   artifact summary.
9. Update claim ledger, README, topology, and durable logs.

## Success Criteria

- Zed itself initiates MCP tool calls.
- The tracked JSONL has at least 12 frames.
- The tracked JSONL includes server IDs `splunk` and `splunkready`.
- The tracked JSONL includes `splunk_get_knowledge_objects`,
  `splunk_run_saved_search`, and `splunkready_recorder_flush`.
- Evidence refs include `evt-102`, `evt-118`, and `evt-141`.
- The certification artifact reports `PASS`.
- The receipt reports `READY`, score `100`, and `mutation: false`.
- Redaction scan reports no endpoint, token, local path, or secret material.
- MCP category scorecard status is `PASS` and `zedEvidenceTier` is
  `VERIFIED_STRONG`.

## Stop Conditions

- Stop before committing any raw Zed settings, raw local paths, endpoints,
  tokens, cookies, env values, or live Splunk deployment inventory.
- Stop before using the live Splunk env-backed context servers for this proof.
- Stop before describing scripted local probes as third-party-client evidence.
- Stop if Zed cannot initiate MCP calls; record the blocker and keep the
  current compact evidence boundary.

## Verification

- Redacted Zed settings shape inspection.
- Computer Use screenshots or OS screenshots after Zed produces the session.
- `node scripts/audit-mcp-category-evidence.mjs --out submission-evidence/mcp-proof --require-strong`
- `npx vitest run tests/scripts/mcp-category-evidence.test.ts`
- `npx vitest run tests/scripts/submission-copy-audit.test.ts`
- leak scan over the refreshed Zed session artifacts and screenshots where
  text extraction is practical.
- `npm run check`.

## Outcome

The strong Zed session passed the focused gate. The discarded first attempt is
documented because it proved the deterministic grader still blocks a real
third-party client when it uses a read-only but mission-disallowed Splunk tool.
