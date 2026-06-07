# SplunkReady MCP Client Session

Status: PASS

Protocol: stdio-jsonrpc

Mutation: no

Deterministic authority: yes

Requests: 24

Responses: 24

Methods:
- initialize
- tools/list
- resources/list
- resources/templates/list
- resources/read
- prompts/list
- prompts/get
- tools/call

Resources:
- splunkready://certification/posture
- splunkready://client-config/stdio
- splunkready://client-config/splunk-and-splunkready
- splunkready://client-config/claude-desktop
- splunkready://client-config/cursor
- splunkready://client-config/antigravity
- splunkready://client-config/zed
- splunkready://workflows/splunk-mcp-certification-loop
- splunkready://workflows/mcp-composition-scorecard
- splunkready://workflows/hosted-model-diagnostic
- splunkready://receipts/pass

Prompts:
- splunkready_certify_mcp_transcript
- splunkready_splunk_mcp_certification_loop
- splunkready_mcp_composition_review
- splunkready_hosted_model_diagnostic

Tools:
- splunkready_describe_certification
- splunkready_certify_mcp_transcript
- splunkready_certify_mcp_transcript_content
- splunkready_check_hosted_model_access
