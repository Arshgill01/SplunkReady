# SplunkReady MCP Client Session

Status: PASS

Protocol: stdio-jsonrpc

Mutation: no

Deterministic authority: yes

Requests: 18

Responses: 18

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
- splunkready://workflows/splunk-mcp-certification-loop
- splunkready://workflows/mcp-composition-scorecard
- splunkready://receipts/pass

Prompts:
- splunkready_certify_mcp_transcript
- splunkready_splunk_mcp_certification_loop
- splunkready_mcp_composition_review

Tools:
- splunkready_describe_certification
- splunkready_certify_mcp_transcript
- splunkready_certify_mcp_transcript_content
- splunkready_check_hosted_model_access
