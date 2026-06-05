# SplunkReady MCP Proof

Status: PASS

Server: splunkready

Protocol: 2025-06-18

Mutation: no

Tools:
- splunkready_describe_certification destructive=false readOnly=true
- splunkready_certify_external_trace destructive=false readOnly=true
- splunkready_certify_mcp_transcript destructive=false readOnly=true

Resources:
- splunkready://certification/posture (application/json)
- splunkready://examples/external-trace-pass (application/json)
- splunkready://examples/mcp-transcript-pass (application/jsonl)
- splunkready://examples/pass-receipt (text/markdown)
- splunkready://client-config/stdio (application/json)
- splunkready://workflows/splunk-mcp-certification-loop (text/markdown)

Prompts:
- splunkready_certify_mcp_transcript arguments=3
- splunkready_capture_trace arguments=2
- splunkready_explain_receipt arguments=1
- splunkready_splunk_mcp_certification_loop arguments=3

Agent-driven workflow: PASS
- MCP client discovers SplunkReady certification posture and stdio configuration.
- Agent investigates through Splunk MCP read-only tools and preserves the JSON-RPC transcript.
- Agent calls SplunkReady MCP to certify the captured Splunk MCP transcript.
- Agent explains the generated Readiness Receipt without overriding the deterministic verdict.

Transcript certification: PASS

Splunk MCP boundary: PASS
- Certified tool calls: splunk_get_knowledge_objects, splunk_run_saved_search
- Saved-search execution: yes
- Evidence refs: evt-102, evt-118, evt-141
- Receipt: submission-evidence/mcp-proof/mcp-transcript-certification/receipt-external-001.json

Receipt: submission-evidence/mcp-proof/mcp-transcript-certification/receipt-external-001.json
