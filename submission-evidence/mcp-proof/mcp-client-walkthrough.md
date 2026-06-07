# Splunk MCP Client Walkthrough

Status: PASS

Mutation: no

Deterministic authority: yes

## Servers

- splunk: Existing Splunk MCP Server performs the read-only investigation and returns deployment evidence. existingMcpServer=true
- splunkready: SplunkReady MCP certifies the captured Splunk MCP transcript into a deterministic Readiness Receipt. existingMcpServer=false

## Stages

- client-discovers-two-servers: MCP client is configured with existing Splunk MCP plus SplunkReady MCP
  - Server: client
  - Evidence: splunkready://client-config/splunk-and-splunkready
- splunk-mcp-investigates: Agent investigates through read-only Splunk MCP tools
  - Server: splunk
  - Evidence: splunk_get_knowledge_objects, splunk_run_saved_search
- transcript-preserved: MCP JSON-RPC request/response transcript is preserved without secrets
  - Server: client
  - Evidence: examples/sample-mcp-transcript-pass.jsonl
- splunkready-certifies: SplunkReady certifies the captured transcript
  - Server: splunkready
  - Evidence: artifacts/mcp-proof/mcp-transcript-certification/receipt-external-001.json
- receipt-is-authoritative: Readiness Receipt is the authoritative verdict
  - Server: splunkready
  - Evidence: certificationStatus=PASS; deterministicAuthority=true; mutation=false

## Transcript

- Path: examples/sample-mcp-transcript-pass.jsonl
- Splunk tools: splunk_get_knowledge_objects, splunk_run_saved_search
- Splunk tool calls: 2
- Saved-search execution: yes
- Evidence refs: evt-102, evt-118, evt-141

## Receipt

- Path: artifacts/mcp-proof/mcp-transcript-certification/receipt-external-001.json
- Status: PASS
- Authoritative: yes
