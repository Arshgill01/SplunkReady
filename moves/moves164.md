# Move 164 - Splunk AppInspect MCP Composition

## Intent

Make the MCP story stronger than "SplunkReady has an MCP server" by composing
multiple Splunk-relevant MCP servers in one proof: Splunk MCP for investigation,
Splunk AppInspect MCP for app validation when tooling is available, and
SplunkReady MCP for deterministic certification.

## Scope

- Add a credential-free AppInspect MCP composition proof path.
- Prefer Splunk's official AppInspect MCP server command when available:
  `uvx splunk-appinspect[mcp] mcp-server`.
- If AppInspect tooling is unavailable, emit a public-safe blocked artifact that
  records the missing command/tooling without failing unrelated MCP proof paths.
- Feed the current Splunk app package from `submission-evidence/splunk-app-package/`
  into AppInspect validation when available.
- Record all MCP server roles in a composition summary:
  - mock or operator Splunk MCP: read-only investigation;
  - AppInspect MCP: Splunk app validation;
  - SplunkReady MCP: deterministic certification and receipt authority.
- Surface the AppInspect composition status in `mcp-proof` and the workbench.

## Non-Goals

- Do not claim Splunkbase approval or Splunk Cloud vetting from local AppInspect
  output.
- Do not require AppInspect for the default credential-free proof to pass unless
  the dependency is installed in the environment.
- Do not make AppInspect output a Readiness Receipt verdict source.
- Do not write to Splunk or auto-install the Splunk app.

## Verification

- Focused tests for AppInspect composition summary parsing and blocked-status
  handling.
- Local AppInspect smoke when `uvx` or `splunk-appinspect` is available, or a
  blocked artifact when unavailable.
- `node dist/src/cli.js mcp-proof --out submission-evidence/mcp-proof --live-mock --json`
- Workbench UI test for the AppInspect MCP composition panel.
- `npm run check`
