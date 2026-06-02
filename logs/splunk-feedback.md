# Splunk Developer Feedback Log

This log records Splunk-specific integration friction discovered while building SplunkReady. It is intentionally practical: each note should describe what happened, why it slowed development, and what would improve the Splunk developer experience.

## Setup Friction Points

### KVStore and local app readiness are not obviously connected to MCP readiness

Observed during Phase Live local setup. A local Splunk Enterprise trial can appear reachable before all supporting services and installed apps are ready. When MCP calls depend on knowledge-object inventory, app context, or saved-search discovery, the practical readiness signal is not just "Splunk is running"; developers also need to know whether KVStore/app services have finished initializing.

Impact:
- It is hard to tell whether an empty or partial MCP inventory means "no matching Splunk content exists" or "the local Splunk app stack is not ready yet."
- The certification flow can only produce a strong live receipt after the target Splunk content exists and is discoverable through the same read-only interface the agent will use.

Suggestion:
- Provide an MCP/server readiness endpoint or checklist that reports Splunk server status, KVStore status, app install status, and whether core MCP inventory tools can enumerate indexes and knowledge objects.

### Splunk Enterprise and MCP setup require multiple mental models

Observed during Phase Live setup. Developers must reason about Splunk Enterprise, the Splunk MCP Server app/endpoint, auth tokens, and local environment variables as one chain, but the setup surfaces are separate.

Impact:
- A failed `live-smoke` can come from the Enterprise instance, the MCP server app, the URL shape, token/auth scope, or local env loading.
- The first successful connection required careful separation of Splunk admin concepts from MCP bearer-token configuration.

Suggestion:
- Publish a single "local MCP smoke test" path for hackathon/developer use that starts from a fresh Splunk Enterprise trial and ends with a known-good read-only JSON-RPC `tools/call`.

### Token authentication needs clearer examples

Observed during Phase Live setup. SplunkReady expects `SPLUNKREADY_SPLUNK_MCP_TOKEN` and sends it only as a bearer token in the `Authorization` header. This is safe, but developers need to know which token type the MCP endpoint expects and how to verify it without leaking it into logs.

Impact:
- Token mistakes can look similar to URL, certificate, or app-readiness failures.
- Local tooling must avoid echoing the token while still showing enough detail to debug missing/invalid auth.

Suggestion:
- Provide a copy-pasteable curl example using a placeholder bearer token and a read-only `splunk_get_info` call.
- Include a short guide for token scope/lifetime and the expected error body for invalid or expired credentials.

### Local self-signed certificates force insecure development toggles

Observed during Phase Live live-green runs. The local MCP endpoint was reachable only after setting `NODE_TLS_REJECT_UNAUTHORIZED=0` for Node-based smoke/proof commands.

Impact:
- The warning is noisy and easy to normalize, even though disabling certificate verification should never become production guidance.
- Developers need a secure local certificate path or an explicit "local-only self-signed cert" workflow.

Suggestion:
- Provide local MCP certificate setup guidance for Node clients, including how to trust the Splunk certificate or configure a CA bundle without disabling TLS verification globally.

### Empty default indexes make live demos look broken even when MCP works

Observed while probing the user's live Splunk trial. `_internal` returned real rows, but `main` returned 0 rows and the Enterprise Security saved-search mission had no matching live saved search/content.

Impact:
- A fresh Splunk trial can successfully prove MCP connectivity while still failing realistic security missions because the target data/content is not installed.
- Developers need a known-good, read-only sample data path for live MCP demos.

Suggestion:
- Ship or document an official sample dataset and saved-search pack for MCP demos, with explicit read-only missions that can be run immediately after setup.

## MCP Server Limitations

### MCP response envelopes need normalization

Observed while implementing and testing the live adapter. MCP-compatible responses can place useful output in `result.structuredContent`, `result.output`, or `result.content[].text`.

Impact:
- Client implementers need to support multiple envelope shapes before they can reliably normalize Splunk inventory and saved-search output.
- Without documented canonical examples, live adapters need defensive parsing and broad tests.

Suggestion:
- Document canonical response envelopes for each Splunk MCP tool, including examples for successful inventory calls, no-result calls, and tool errors.

### Knowledge-object discovery depends on app context

Observed during fixture/live parity work. Saved searches can have the same display name in different apps, and the app context materially changes whether the object is valid for a mission.

Impact:
- A broad knowledge-object lookup by name can return both valid and wrong-app objects.
- Certification tooling needs app-aware lookup behavior to avoid accidental passes or confusing duplicate search choices.

Suggestion:
- Make app filtering prominent in MCP tool schemas and examples.
- Return stable object identifiers that include app context.

### Aggregated search results lose row-level evidence references

Observed during a live Gemini run. Gemini selected a `stats count by component, message` query. The MCP query returned counts, but the resulting trace had no row-level evidence refs, causing deterministic evidence rules to fail.

Impact:
- Certification tools need stable row/event evidence references for auditability.
- Aggregation can be useful for investigation, but it is not enough for a readiness receipt unless the agent first captures raw evidence rows or the MCP server provides provenance refs for aggregated results.

Suggestion:
- Document which query shapes preserve row-level evidence refs.
- Consider returning provenance metadata for aggregate rows, or provide a dedicated evidence-capture pattern in MCP examples.

## Developer Experience Suggestions

- Provide one local Splunk Enterprise plus MCP "happy path" with exact ports, URL shape, token instructions, and a known-good read-only smoke command.
- Include a machine-readable MCP capability document that lists available tools, input schemas, output shapes, and mutation/read-only classification.
- Expose readiness diagnostics for MCP server dependencies such as KVStore, installed apps, and knowledge-object inventory.
- Include examples showing how to safely debug bearer-token auth without printing secrets.
- Document how saved-search app context should be represented and filtered in MCP calls.
