# Move 189 - MCP Recorder Flush Frame Capture

## Status

Implemented on 2026-06-08.

## Objective

Close the artifact-shape gap found in Move 188: the recorder gateway certified
through `splunkready_recorder_flush`, but persisted session JSONL did not
include the flush request/response frame. That made third-party-client evidence
harder to audit even when the desktop client had actually triggered the flush.

## Expected touched files

- `moves/moves189.md`
- `src/mcp/recorder-gateway.ts`
- `tests/cli/flow.test.ts`
- `submission-evidence/mcp-proof/dual-server-session.jsonl`
- `submission-evidence/mcp-proof/dual-server-session.md`
- `submission-evidence/mcp-proof/mcp-category-scorecard.json`
- `submission-evidence/mcp-proof/mcp-category-scorecard.md`
- `submission-evidence/evidence-pack-sha256.txt`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Boundaries

- Do not claim the existing Zed tracked JSONL is upgraded unless a new Zed
  desktop session is actually captured.
- Do not mutate live Splunk.
- Do not make MCP or LLM output authoritative over deterministic receipt rules.
- This source change makes published `splunkready@0.1.5` stale until a future
  release; log that explicitly.

## Verification

- `npx vitest run tests/cli/flow.test.ts -t "MCP recorder gateway"`
- `npm run mcp-proof -- --out submission-evidence/mcp-proof`
- `node scripts/audit-mcp-category-evidence.mjs --out submission-evidence/mcp-proof`
- evidence-pack SHA-256 regeneration and verification
- `npm run check`

## Result

- `splunkready_recorder_flush` is now recorded as a redacted SplunkReady MCP
  request/response pair in recorder gateway session JSONL.
- The recorder rewrites and recertifies the final persisted session after the
  flush response frame is added, so `frameCount` and imported MCP transcript
  `recordCount` agree.
- The regenerated first-party dual-server recorder session now has 11 frames,
  two visible `splunkready_recorder_flush` frames, zero skipped records, zero
  unmatched calls, one final answer, and `mutation: false`.
- The MCP category scorecard still reports `PASS_WITH_LIMITATIONS` because the
  older Zed desktop session remains compact and has not been replaced by a new
  Zed-captured session.
