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

### Sample event timestamps can silently expire out of relative search windows

Observed while hardening the `live-security-kit` operator setup bundle. The flagship saved search intentionally uses `earliest=-24h latest=now`, but fixed CSV timestamps can fall outside that window as soon as the generated kit gets old. The setup can look installed correctly while `live-security-check` still reports zero rows.

Impact:
- Developers may debug MCP, saved-search names, app context, or agent behavior when the real issue is stale sample data.
- A generated local setup kit needs either fresh event timestamps or very explicit instructions to regenerate/import immediately before running the readiness diagnostic.
- This problem is especially easy to miss because the saved search exists and runs, but returns no evidence refs.

Suggestion:
- Official sample data packs should document their intended search windows and whether timestamps are static or generated.
- MCP demo setup guides should include a row-count verification step immediately after data import.
- When possible, provide sample-data import commands or packs that generate current timestamps for relative-time demos.

### Saved-search configuration keys vary enough to break clean local installs

Observed while installing the generated `live-security-kit` app into a local Splunk Enterprise 10.4 trial. Splunk accepted the app and restarted, but emitted a configuration warning for `is_scheduled = 0` in `savedsearches.conf`: `Invalid key in stanza [ES - Lateral Movement Auth Chain]`. The saved search is intentionally unscheduled, and the correct generated config can rely on `disabled = 0` plus dispatch-time settings without this invalid key.

Impact:
- A setup bundle can work while still producing warnings that reduce confidence in the live proof.
- Developers may waste time debugging app install health when the issue is a stale or invalid saved-search config key.
- Demo setup should be warning-free wherever possible because every warning looks like product fragility.

Suggestion:
- Splunk saved-search setup examples should clearly distinguish supported keys for savedsearches.conf in current Splunk Enterprise versions.
- MCP/demo sample packs should include a `splunk btool check` or equivalent config-validation step before asking developers to run proof commands.

### One-shot CSV ingestion may index events before usable field extraction appears

Observed during the local flagship proof setup. `splunk add oneshot` accepted the generated CSV and `eventcount` showed three rows in `wineventlog`, but the saved search returned zero rows because fields such as `src`, `dest`, and `eventRef` were not available as searchable fields. A direct `_raw` search showed the events existed; adding `rex field=_raw` inside the saved search made the same rows evidence-preserving and runnable.

Impact:
- Developers can successfully ingest sample data and still get zero rows from a field-filtered saved search.
- The failure mode looks like missing data, stale timestamps, or MCP trouble even though the events are present in the index.
- Demo setup needs to be robust to fresh local-trial parsing differences and one-shot import behavior.

Suggestion:
- Sample-data packs should either include transforms proven to apply for one-shot ingestion or use self-contained saved searches that extract required fields from `_raw`.
- Splunk MCP demo docs should recommend verifying both `eventcount` and a field-level query before assuming a saved search is ready.

Follow-up:
- The saved search also needed to rely on `dispatch.earliest_time = -24h` / `dispatch.latest_time = now` instead of embedding `earliest=-24h latest=now` inside the SPL string. The direct CLI query returned rows when the time bounds were passed as dispatch options, while the embedded-time saved-search form returned zero rows in this local trial.

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

### Saved-search run tool uses `saved_search_name`, not the inventory `name` field

Observed while closing the flagship live proof gap. The MCP knowledge-object inventory reports saved searches with a `name` field, but `splunk_run_saved_search` rejected `{ app, name }` with `Missing required argument: saved_search_name`. The correct argument was `{ app, saved_search_name }`.

Impact:
- Client implementers can naturally pass the inventory field back into the run tool and get a server-side argument error.
- If the client parser does not treat MCP `isError: true` as an error, this can silently look like a zero-row saved search instead of an argument mismatch.
- This adds avoidable friction to the central MCP workflow: discover saved search, then run saved search.

Suggestion:
- Align tool input names with inventory output names where possible, or document the translation prominently.
- Include a canonical discover-then-run JSON-RPC example for saved searches with app context.
- Consider returning machine-readable tool errors in `structuredContent` as well as text content so clients can classify argument mistakes reliably.

### Aggregated search results lose row-level evidence references

Observed during a live Gemini run. Gemini selected a `stats count by component, message` query. The MCP query returned counts, but the resulting trace had no row-level evidence refs, causing deterministic evidence rules to fail.

Impact:
- Certification tools need stable row/event evidence references for auditability.
- Aggregation can be useful for investigation, but it is not enough for a readiness receipt unless the agent first captures raw evidence rows or the MCP server provides provenance refs for aggregated results.

Suggestion:
- Document which query shapes preserve row-level evidence refs.
- Consider returning provenance metadata for aggregate rows, or provide a dedicated evidence-capture pattern in MCP examples.

### SAIA tools use `spl` while SplunkReady's internal adapter uses `query`

Observed while adding a hosted-model proof command. The internal adapter contract represents SPL strings as `{ query }`, matching `splunk_run_query` and deterministic violation evidence. The live MCP `saia_explain_spl` tool rejected that shape with `Missing required argument: spl`; the correct MCP input is `{ spl }`.

Impact:
- Developers can naturally reuse a violating query payload as SAIA input and hit a live-only argument error.
- The mismatch is easy to miss in fixture tests unless live adapter tests assert the exact MCP payload.
- This creates friction in the core hosted-model remediation loop: violation query -> explain -> optimize.

Suggestion:
- Document SAIA input schemas beside `splunk_run_query` examples and call out the `query` versus `spl` naming difference.
- Consider accepting `query` as an alias for `spl`, or align tool argument names across SPL-related MCP tools.
- Provide a canonical explain/optimize JSON-RPC example for a broad SPL query.

## Developer Experience Suggestions

- Provide one local Splunk Enterprise plus MCP "happy path" with exact ports, URL shape, token instructions, and a known-good read-only smoke command.
- Include a machine-readable MCP capability document that lists available tools, input schemas, output shapes, and mutation/read-only classification.
- Expose readiness diagnostics for MCP server dependencies such as KVStore, installed apps, and knowledge-object inventory.
- Include examples showing how to safely debug bearer-token auth without printing secrets.
- Document how saved-search app context should be represented and filtered in MCP calls.
- Provide a first-class "derive a safe live demo mission from this deployment" guide for fresh Splunk trials that have `_internal` data but no Enterprise Security content.
