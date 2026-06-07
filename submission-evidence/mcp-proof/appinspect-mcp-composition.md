# AppInspect MCP Composition

Status: PASS

Command: uvx splunk-appinspect[mcp] mcp-server

App package: submission-evidence/splunk-app-package/SplunkReady-0.1.3.spl

AppInspect server: AVAILABLE (AppInspect MCP Server 2.14.7)

Tools: inspect_app

Validation status: SUCCESS

Validation summary:
- error: 0
- failure: 2
- future_failure: 0
- not_applicable: 2
- skipped: 237
- success: 8
- warning: 0

Static validation counts:
- failures: 2
- errors: 0
- warnings: 0

Next steps:
- Fix all errors in the `validation_results` with result `failure` one by one
- Rerun `inspect_app` tool

Composition:
- splunk: Read-only investigation MCP server for deployment data, saved searches, and evidence rows. (operational-evidence-source)
- appinspect: Splunk AppInspect MCP server for advisory static validation of the packaged Splunk app. (advisory-static-validation)
- splunkready: SplunkReady MCP server for deterministic transcript certification and Readiness Receipt output. (deterministic-receipt-authority)

Authority:
- Deterministic Readiness Receipt authority: splunkready
- AppInspect authority: advisory-static-validation
- Mutation: no
