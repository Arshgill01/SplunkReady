# MCP Category Scorecard

Status: PASS

Score: 100

Mutation: false

Deterministic authority: true

## Proof Surfaces

- SplunkReady MCP server: 6 tools, 13 resources, 1 resource template(s), 6 prompts.
- Mock Splunk MCP composition: PASS.
- Dual-server recorder session: PASS with 11 frame(s).
- AppInspect MCP composition: PASS.
- Fixture hosted-model MCP access: PASS.
- Operator-live hosted-model boundary: PASS (NONE).
- Zed external-client evidence tier: VERIFIED_STRONG; 15 tracked frame(s).

## Claim Boundary

- Zed JSONL contains Splunk investigation frames: yes.
- Zed JSONL contains visible `splunkready_recorder_flush` frame: yes.
- Zed certification is proven by adjacent artifacts: yes.

The current Zed evidence is real third-party-client evidence with a visible recorder-flush JSONL frame and a strong multi-step transcript.

## Warnings

- None.

## Evidence

- submission-evidence/mcp-proof/mcp-proof-summary.json
- docs/mcp-topology.md
- artifacts/mcp-proof/dual-server-session.jsonl
- artifacts/mcp-proof/mock-splunk-mcp-session.jsonl
- submission-evidence/mcp-proof/appinspect-mcp-composition.json
- submission-evidence/mcp-proof/zed-client-session/zed-mcp-recorder-session.jsonl
- submission-evidence/mcp-proof/zed-client-session/mcp-transcript-certification.json
- submission-evidence/mcp-proof/zed-client-session/receipt-external-001.json
- submission-evidence/screenshots/zed-mcp-strong-receipt.png
