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

### Live missions need a compatibility bridge from discovered content

Observed while adding live-derived mission generation. The MCP inventory can prove that a deployment is reachable and read-only, but a certification mission still needs runnable content: saved searches that return rows, accessible indexes, and evidence-preserving query shapes. A fresh Splunk trial often has `_internal` data but no Enterprise Security saved searches.

Impact:
- Developers can complete MCP setup successfully and still lack a mission that demonstrates their agent against live Splunk data.
- Without a guided derivation path, product demos drift back to fixture-only evidence even when live MCP works.

Suggestion:
- Provide examples for deriving simple read-only validation tasks from live inventory, such as "run a saved search that returned rows" or "query `_internal` with `head 10` and return raw evidence."
- Expose candidate quality signals in MCP inventory or docs: app, saved-search name, whether it is runnable, whether it returned rows recently, and whether returned rows preserve event/provenance refs.

Follow-up implementation note:
- SplunkReady added `live-proof` to bridge this gap locally: it compiles the live contract, scans read-only saved-search candidates, derives a mission, and runs the receipt flow. This helped clarify that an official MCP onboarding path should not stop at inventory; it should also include a first runnable read-only proof task for the discovered deployment.

Real endpoint follow-up:
- A guided `live-proof` run against the configured local endpoint checked 12 saved-search candidates and found 0 with rows, then correctly fell back to `_internal`. The fallback receipt was `READY` before and after policy injection, which is useful live proof but not the richer patch loop. A developer-facing MCP flow would benefit from "candidate returned rows recently" and "suitable for demo/certification" signals before an agent tries to build a mission around saved searches.

### Flagship security content readiness needs exact diagnostics

Observed while adding `live-security-check`. The live MCP endpoint exposed the required read-only tools, but the exact flagship saved search `SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain` was absent, and the preferred `wineventlog` index was absent. The command could therefore report a precise security-story blocker without attempting to fabricate a live pass.

Impact:
- Developers can have a fully connected MCP endpoint but still be unable to run a realistic security certification story.
- Generic saved-search inventory is not enough; the developer needs to know whether the exact mission dependency exists and whether it returns row-level evidence.
- Without a diagnostic like this, teams waste time tuning agents when the actual blocker is deployment content.

Suggestion:
- Provide an MCP/server-side readiness endpoint or documented checklist for demo-grade security content: required apps, saved searches, indexes, sourcetypes, and evidence-preserving result fields.
- Include example installation/setup steps for a read-only lateral-movement saved search and synthetic-but-realistic events in a local trial.
- Expose saved-search metadata that indicates whether the search has returned rows recently and which indexes/sourcetypes it depends on.

### Saved-search app context is easy to get wrong during setup

Observed while generating the `live-security-kit` operator setup bundle. A saved search named `ES - Lateral Movement Auth Chain` is not enough; the contract and mission require the app-scoped reference `SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain`. A generated setup app with a different directory name would produce a saved search with the wrong app context even if the visible saved-search name looked correct.

Impact:
- Operators can install content that appears valid in Splunk search UI but still fails SplunkReady because MCP inventory reports a different app namespace.
- Developers need to understand whether "app" means the visible app label, the app directory, or another stable object namespace.
- This is a high-friction setup edge for local trials where Enterprise Security is not installed.

Suggestion:
- Document saved-search app namespace behavior explicitly in MCP onboarding examples.
- Return app-qualified object refs in a canonical field such as `ref` alongside `app` and `name`.
- Provide a clean local-trial example for app-scoped saved-search setup without requiring a full Enterprise Security install.

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

### Saved-search discovery works best with exact object names

Observed while adding the DNS exfiltration readiness mission. A human mission title such as "Investigate suspicious DNS exfiltration" is useful to a developer, but it is a weak MCP discovery query. The certification trace became more useful when the agent searched for the exact preferred saved-search name, `DNS - Suspicious Exfiltration Queries`, before running it.

Impact:
- Discovery traces that return zero knowledge objects are harder to explain, even if a later policy-backed saved-search run succeeds.
- Agent developers need examples that distinguish "mission prompt text" from "knowledge-object lookup text."

Suggestion:
- Document exact-name and app-scoped saved-search lookup examples for MCP clients.
- If possible, return structured search/discovery hints in saved-search inventory so agents can query by stable ids, tags, or normalized aliases instead of free-form mission titles.

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
- Provide a first-class "derive a safe live demo mission from this deployment" guide for fresh Splunk trials that have `_internal` data but no Enterprise Security content.
