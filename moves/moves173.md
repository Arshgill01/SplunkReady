# Move 173 - Real Splunk Deployment Stress Proof

## Intent

Create a fresh Splunk Enterprise deployment, seed it with operator-approved
security content and noisy trap data, and run SplunkReady against that real
deployment so the evidence pack contains a public-safe live proof that is not a
fixture-only or mock-only claim.

## Scope

- Start a clean Docker Splunk Enterprise container with a generated local
  password stored only under ignored `artifacts/`.
- Generate and install the SplunkReady live security kit into that deployment.
- Seed realistic lateral-movement evidence plus noisy saved searches and
  prompt-injection-like event text to pressure-test app scoping, evidence refs,
  broad-search avoidance, and deterministic receipt checks.
- If the plain Splunk deployment cannot expose the repo's expected MCP endpoint,
  add a narrow local MCP compatibility bridge backed by real Splunk REST calls.
- Run live smoke/readiness/proof commands against the real deployment and record
  redacted JSON/Markdown evidence in `submission-evidence/real-splunk-stress/`.
- Document the exact setup, writes, validation commands, and open limitations.

## Non-Goals

- Do not claim hosted-model/SAIA PASS if the deployed Splunk instance still
  lacks working SAIA REST handlers.
- Do not make Splunk writes part of any default judge path.
- Do not commit generated credentials, raw env files, or unredacted local logs.
- Do not replace fixture or live-mock proof paths.

## Expected Files

- `moves/moves173.md`
- `scripts/real-splunk-mcp-bridge.mjs` if MCP compatibility is required
- `submission-evidence/real-splunk-stress/`
- `submission-evidence/claim-ledger.md`
- `submission-evidence/README.md`
- `submission-evidence/evidence-pack-sha256.txt`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Verification

- `docker run --platform linux/amd64 ... splunk/splunk:latest`
- `curl -sk -u "$SPLUNK_USERNAME:$SPLUNK_PASSWORD" "$SPLUNK_MANAGEMENT_URL/services/server/info?output_mode=json"`
- `npm run build`
- `node dist/src/cli.js live-security-kit --out artifacts/real-splunk-stress/live-security-kit --json`
- `node dist/src/cli.js live-security-check --out artifacts/real-splunk-stress/live-security-check --json`
- `node dist/src/cli.js live-security-proof --out artifacts/real-splunk-stress/live-security-proof --json`
- `npm run audit:submission-copy`
- `npm run check`
