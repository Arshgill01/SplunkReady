# Move 151 - Real External MCP-Client Session Evidence

## Intent

Capture a real third-party MCP-client session using SplunkReady MCP once higher
leverage product surfaces are complete.

## Scope

- Configure a non-Claude external MCP client if practical.
- Capture and redact real JSON-RPC frames.
- Add `externalClientSession` to MCP proof evidence.
- Track screenshots only if they show real tool calls and receipts.

## Parking Rationale

This move is deliberately parked behind Moves 147-150 because prior attempts at
desktop recording consumed time without enough product proof. It remains useful,
but it should not block mock live proof, receipt chain, interactive demo, or
policy registry work.

## Verification

- Redacted session has 50+ JSON-RPC frames.
- Session includes `splunkready_certify_mcp_transcript_content`.
- MCP proof reports `externalClientSession: VERIFIED`.

## Result

Parked.
