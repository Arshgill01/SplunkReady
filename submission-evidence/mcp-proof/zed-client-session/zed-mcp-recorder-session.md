# MCP Composition Recorder

Status: PASS

Mutation: no

Deterministic authority: yes

Artifact: artifacts/zed-external-mcp-client-session-strong/mcp-recorder-session.jsonl

Frames: 15

Servers: splunk, splunkready

Requests: 7

Responses: 7

Splunk tools:
- splunk_get_knowledge_objects
- splunk_run_query
- splunk_run_saved_search

SplunkReady tools:
- splunkready_describe_certification
- splunkready_recorder_flush

Evidence refs:
- evt-102
- evt-118
- evt-141

Redaction: PASS
- endpoint material present: no
- token material present: no
- local path material present: no

Certification: PASS
