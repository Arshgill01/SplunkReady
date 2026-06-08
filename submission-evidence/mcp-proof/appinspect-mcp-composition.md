# AppInspect MCP Composition

Status: PASS

Command: uvx splunk-appinspect[mcp] mcp-server

App package: submission-evidence/splunk-app-package/SplunkReady-0.1.6.spl

AppInspect server: AVAILABLE (AppInspect MCP Server 2.14.7)

Tools: inspect_app

Validation status: SUCCESS

Validation summary:
- error: 0
- failure: 0
- future_failure: 0
- not_applicable: 144
- skipped: 1
- success: 103
- warning: 1

Static validation counts:
- failures: 0
- errors: 0
- warnings: 1

Next steps:
- All validation checks passed. No fixes from AppInspect required.

Composition:
- splunk: Read-only investigation MCP server for deployment data, saved searches, and evidence rows. (operational-evidence-source)
- appinspect: Splunk AppInspect MCP server for advisory static validation of the packaged Splunk app. (advisory-static-validation)
- splunkready: SplunkReady MCP server for deterministic transcript certification and Readiness Receipt output. (deterministic-receipt-authority)

Authority:
- Deterministic Readiness Receipt authority: splunkready
- AppInspect authority: advisory-static-validation
- Mutation: no
