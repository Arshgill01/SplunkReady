# Real Splunk Deployment Stress Proof

Move 173 created a fresh disposable Splunk Enterprise Docker deployment and ran
SplunkReady's flagship security proof against it.

## What This Proves

- Splunk Enterprise 10.4.0 started in Docker from a clean container.
- Operator-approved setup installed the generated
  `SplunkEnterpriseSecuritySuite` app and ingested synthetic `wineventlog`
  events.
- The deployment contained noisy traps: 80 benign authentication rows, a
  prompt-injection-like event, two decoy saved searches in the generated app,
  and a wrong-app duplicate named `search::ES - Lateral Movement Auth Chain`.
- SplunkReady discovered 14 indexes and 178 saved searches through the live
  adapter boundary.
- The exact saved search
  `SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain` returned
  four evidence refs.
- The live proof completed `NOT READY` score 60 to `READY` score 100 with
  `mutation: false`.

## Files

- `real-splunk-stress-summary.json`: public-safe summary of deployment, setup,
  stressors, readiness, receipts, and limitations.
- `live-security-readiness.redacted.json`: readiness report produced from the
  real deployment.
- `live-security-proof-summary.json`: proof summary with fail-to-pass status.
- `receipt-before-001.json` and `receipt-after-001.json`: public-safe readiness
  receipts.
- `mcp-bridge-session.redacted.jsonl`: redacted JSON-RPC transcript for the
  REST-backed MCP compatibility bridge.
- `mcp-bridge-session-summary.json`: aggregate transcript counts.
- `splunk-web-evidence-results.png`: Playwright screenshot of Splunk Web showing
  the four real search rows.
- `stress-seed-summary.json`: seed-data and trap summary.

## Boundary

This proof uses a narrow local MCP compatibility bridge backed by real Splunk
REST because a fresh Splunk Enterprise container does not expose the Splunk MCP
Server app by default. It does not claim hosted-model/SAIA availability.
