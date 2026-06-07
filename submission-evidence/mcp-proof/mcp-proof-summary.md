# SplunkReady MCP Proof

Status: PASS

Server: splunkready

Protocol: 2025-06-18

Mutation: no

Tools:
- splunkready_describe_certification destructive=false readOnly=true
- splunkready_certify_external_trace destructive=false readOnly=true
- splunkready_certify_mcp_transcript destructive=false readOnly=true
- splunkready_certify_mcp_transcript_content destructive=false readOnly=true
- splunkready_review_mcp_composition destructive=false readOnly=true
- splunkready_check_hosted_model_access destructive=false readOnly=true

Resources:
- splunkready://certification/posture (application/json)
- splunkready://examples/external-trace-pass (application/json)
- splunkready://examples/mcp-transcript-pass (application/jsonl)
- splunkready://examples/pass-receipt (text/markdown)
- splunkready://client-config/stdio (application/json)
- splunkready://client-config/splunk-and-splunkready (application/json)
- splunkready://client-config/claude-desktop (application/json)
- splunkready://client-config/cursor (application/json)
- splunkready://client-config/antigravity (application/json)
- splunkready://client-config/zed (application/json)
- splunkready://workflows/splunk-mcp-certification-loop (text/markdown)
- splunkready://workflows/mcp-composition-scorecard (text/markdown)
- splunkready://workflows/hosted-model-diagnostic (text/markdown)

Resource templates:
- splunkready://receipts/{receiptId} (text/markdown)

Templated receipt:
- splunkready://receipts/pass

Dual-server MCP client kit:
- Resource: splunkready://client-config/splunk-and-splunkready
- Existing Splunk MCP role: investigate with read-only Splunk tools
- SplunkReady MCP role: certify the captured Splunk MCP transcript

Prompts:
- splunkready_certify_mcp_transcript arguments=3
- splunkready_capture_trace arguments=2
- splunkready_explain_receipt arguments=1
- splunkready_splunk_mcp_certification_loop arguments=3
- splunkready_mcp_composition_review arguments=1
- splunkready_hosted_model_diagnostic arguments=2

Agent-driven workflow: PASS
- MCP client discovers SplunkReady certification posture and stdio configuration.
- Agent investigates through Splunk MCP read-only tools and preserves the JSON-RPC transcript.
- Agent calls SplunkReady MCP to certify the captured Splunk MCP transcript.
- Agent explains the generated Readiness Receipt without overriding the deterministic verdict.

Transcript certification: PASS

Inline transcript certification: PASS
- Output: artifacts/mcp-proof/mcp-inline-transcript-certification

MCP composition review: PASS
- Score: 100
- Splunk tools: splunk_get_knowledge_objects, splunk_run_saved_search
- Evidence refs: evt-102, evt-118, evt-141

Hosted-model access check: PASS
- Blocker: NONE
- Permission: OK
- Permission blocker: NONE
- Passed tools: saia_generate_spl, saia_explain_spl, saia_optimize_spl, saia_ask_splunk_question
- Blocked tools: none
- Output: artifacts/mcp-proof/mcp-hosted-model-access

Operator live hosted-model status: BLOCKED
- Artifact: artifacts/live-hosted-model-diagnostic/hosted-model-diagnostic.json
- Blocker: SAIA_REST_HANDLERS_NOT_REGISTERED
- Permission: BLOCKED
- Permission blocker: SAIA_REST_HANDLERS_NOT_REGISTERED
- Route probe: NOT_REGISTERED
- Passed tools: none
- Blocked tools: saia_generate_spl, saia_explain_spl, saia_optimize_spl, saia_ask_splunk_question
- Summary: The MCP contract advertises hosted-model tools, but Splunk AI Assistant's splunkd REST handlers are not registered for the SAIA routes.

Splunk MCP boundary: PASS
- Certified tool calls: splunk_get_knowledge_objects, splunk_run_saved_search
- Saved-search execution: yes
- Evidence refs: evt-102, evt-118, evt-141
- Receipt: artifacts/mcp-proof/mcp-transcript-certification/receipt-external-001.json

MCP composition scorecard: PASS (100/100)
- dual-server-client-config: PASS - Client config includes separate splunk and splunkready MCP servers.
- external-mcp-client-configs: PASS - Claude Desktop, Cursor, Antigravity, and Zed MCP client templates are discoverable as credential-free resources.
- discoverable-resources-and-prompts: PASS - 13 resources, 1 resource template(s), and 6 prompts expose the composed workflow.
- existing-splunk-mcp-boundary: PASS - 2 captured splunk_* tool calls are certified.
- official-splunk-mcp-tool-coverage: PASS - 1 mission-scoped Splunk MCP core tool(s), 2 investigation tool(s), and 4 SAIA hosted-model tool(s) are covered.
- saved-search-evidence: PASS - 3 evidence refs from saved-search output.
- readiness-receipt-authority: PASS - Path transcript certification returned PASS; inline transcript certification returned PASS; deterministic rules remain authoritative.
- composition-review-tool: PASS - splunkready_review_mcp_composition returned PASS with score 100.
- no-splunkready-mutation: PASS - SplunkReady certification reports mutation=false across workflow, boundary, path transcript, inline transcript, hosted-model access, and receipt artifacts.
- hosted-model-advisory-access: PASS - Hosted-model access check returned PASS; SAIA remains advisory and deterministic rules remain authoritative.

Official Splunk MCP tool coverage: PASS
- Captured core tools: splunk_get_knowledge_objects
- Investigation tools: splunk_get_knowledge_objects, splunk_run_saved_search
- Hosted-model tools: saia_generate_spl, saia_explain_spl, saia_optimize_spl, saia_ask_splunk_question
- Mission-scoped out tools: splunk_get_info
- splunk-knowledge-object-context: PASS - Captured transcript discovers saved searches, macros, and lookups through Splunk MCP.
- splunk-investigation-execution: PASS - Captured transcript executes a validated saved search and returns event refs.
- mission-scoped-tool-boundary: PASS - The certified security mission does not call splunk_get_info because mission allowedTools scope excludes it; deterministic SAF-003 remains authoritative.
- saia-hosted-model-tools: PASS - 4/4 SAIA hosted-model tools passed in the MCP proof.

MCP client walkthrough: PASS
- Artifact: artifacts/mcp-proof/mcp-client-walkthrough.json
- Markdown: artifacts/mcp-proof/mcp-client-walkthrough.md
- Existing Splunk MCP server: Existing Splunk MCP Server performs the read-only investigation and returns deployment evidence.
- SplunkReady role: SplunkReady MCP certifies the captured Splunk MCP transcript into a deterministic Readiness Receipt.
- client-discovers-two-servers: MCP client is configured with existing Splunk MCP plus SplunkReady MCP (client) - splunkready://client-config/splunk-and-splunkready
- splunk-mcp-investigates: Agent investigates through read-only Splunk MCP tools (splunk) - splunk_get_knowledge_objects, splunk_run_saved_search
- transcript-preserved: MCP JSON-RPC request/response transcript is preserved without secrets (client) - examples/sample-mcp-transcript-pass.jsonl
- splunkready-certifies: SplunkReady certifies the captured transcript (splunkready) - artifacts/mcp-proof/mcp-transcript-certification/receipt-external-001.json
- receipt-is-authoritative: Readiness Receipt is the authoritative verdict (splunkready) - certificationStatus=PASS; deterministicAuthority=true; mutation=false

MCP client session: PASS
- Artifact: artifacts/mcp-proof/mcp-client-session.jsonl
- Markdown: artifacts/mcp-proof/mcp-client-session.md
- Protocol: stdio-jsonrpc
- Requests: 25
- Responses: 25
- Methods: initialize, tools/list, resources/list, resources/templates/list, resources/read, prompts/list, prompts/get, tools/call
- Resources read: splunkready://certification/posture, splunkready://client-config/stdio, splunkready://client-config/splunk-and-splunkready, splunkready://client-config/claude-desktop, splunkready://client-config/cursor, splunkready://client-config/antigravity, splunkready://client-config/zed, splunkready://workflows/splunk-mcp-certification-loop, splunkready://workflows/mcp-composition-scorecard, splunkready://workflows/hosted-model-diagnostic, splunkready://receipts/pass
- Prompts fetched: splunkready_certify_mcp_transcript, splunkready_splunk_mcp_certification_loop, splunkready_mcp_composition_review, splunkready_hosted_model_diagnostic
- Tools called: splunkready_describe_certification, splunkready_review_mcp_composition, splunkready_certify_mcp_transcript, splunkready_certify_mcp_transcript_content, splunkready_check_hosted_model_access

Receipt: artifacts/mcp-proof/mcp-transcript-certification/receipt-external-001.json
