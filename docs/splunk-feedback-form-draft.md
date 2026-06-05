# Splunk Feedback Form Draft

Move 23 status: draft prepared from `logs/splunk-feedback.md`. Official feedback submission is still required before this can be marked complete.

Source requirement: the Splunk Agentic Ops Hackathon rules describe a separate feedback period for Most Valuable Feedback, and the Devpost challenge page exposes a Feedback Form link.

## Submission Status

- Official feedback form URL: `https://splunk.devpost.com/details/feedback`
- Submitted: no.
- Confirmation recorded: no.
- Personal data included in this draft: no.
- Do not claim feedback submission in README, Devpost copy, logs, or final reports until the official form is actually submitted.

## Short Summary

While building SplunkReady, the biggest developer-experience gap was not basic MCP connectivity. The harder gap was turning a reachable Splunk deployment into a reliable, read-only, evidence-preserving agent certification loop. Developers need clearer MCP readiness diagnostics, canonical discover-then-run examples, safer local TLS guidance, and better live-demo content signals.

## Detailed Feedback

### 1. MCP readiness should include Splunk service and content readiness

A local Splunk trial can appear reachable while KVStore, app services, saved searches, or sample content are not ready. MCP inventory may then be empty or partial, and it is hard to tell whether the problem is connectivity, app readiness, permissions, or missing content.

Suggested improvement:

- Provide a single MCP/server readiness endpoint or checklist that reports Splunk server status, KVStore status, app install status, index inventory, knowledge-object inventory, and basic read-only tool availability.

### 2. Provide a known-good local MCP smoke path

The setup chain spans Splunk Enterprise, the MCP server app, endpoint URL shape, bearer-token auth, TLS/certificates, and local env loading. A failed smoke test can come from any layer.

Suggested improvement:

- Publish a copy-pasteable local MCP smoke path for a fresh Splunk Enterprise trial that ends with a known-good JSON-RPC `tools/call` for `splunk_get_info`.
- Include placeholder bearer-token examples and expected invalid-token responses without encouraging token logging.

### 3. Local TLS guidance needs a secure path

During local proof runs, Node clients may require `NODE_TLS_REJECT_UNAUTHORIZED=0` against self-signed local Splunk certificates. That works for local experimentation but is risky to normalize.

Suggested improvement:

- Document how Node clients should trust a local Splunk certificate or configure a CA bundle without globally disabling TLS verification.

### 4. Live demos need official sample data and saved searches

A fresh Splunk trial can prove MCP connectivity while still lacking demo-grade security content. For example, a saved-search-based lateral movement mission needs the expected app-scoped saved search, runnable index data, current timestamps, and row-level evidence fields.

Suggested improvement:

- Provide an official read-only sample dataset and saved-search pack for MCP demos.
- Include a row-count verification step and field-level query check immediately after import.
- Make sample timestamps fresh or document their intended search windows clearly.

### 5. Saved-search app context should be explicit

Saved-search names alone are ambiguous. The same visible saved-search name can exist in different apps, and the stable app namespace can differ from what developers expect during local setup.

Suggested improvement:

- Return canonical app-qualified refs such as `SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain`.
- Show discover-then-run examples that include app context.

### 6. Align inventory and run-tool argument names

The knowledge-object inventory reports saved searches with a `name` field, but `splunk_run_saved_search` expects `saved_search_name`. Passing `{ app, name }` naturally produces an argument error.

Suggested improvement:

- Align tool input names with inventory output names where possible, or document the translation prominently.
- Return machine-readable tool errors in structured content so clients can classify argument mistakes reliably.

### 7. Document evidence-preserving query patterns

Aggregated SPL such as `stats count by ...` can be useful for investigation, but it loses row-level evidence refs needed for auditable readiness receipts.

Suggested improvement:

- Document which query shapes preserve row/event evidence refs.
- Provide an official pattern for "capture raw evidence first, aggregate second."
- Consider returning provenance metadata for aggregate rows.

### 8. Hosted-model tool entitlement needs a separate diagnostic

SAIA tools can appear available in tool discovery while still returning action-forbidden errors for the active MCP user. Developers need to distinguish missing tool, missing token, and missing hosted-model entitlement.

Suggested improvement:

- Expose per-tool entitlement or permission status in MCP discovery.
- Provide a safe "SAIA permission check" example that does not execute a search.
- Document required role/capability/entitlement for `saia_explain_spl` and `saia_optimize_spl`.

### 9. SAIA SPL argument naming should be called out

The live SAIA tools expect `spl`, while normal query paths often use `query`. Reusing a violating query payload as SAIA input can therefore fail only at live runtime.

Suggested improvement:

- Document the `query` versus `spl` naming difference beside the query and SAIA examples.
- Consider accepting `query` as an alias for `spl`.

### 10. Tenant-code activation status should be visible

The local AI Assistant flow can generate a tenant code, but activation then depends on a delayed external token flow. The local developer has little visibility into whether the code is queued, accepted, rejected, or pending manual activation.

Suggested improvement:

- Add a local activation-status diagnostic or a clear status page for tenant-code submissions.
- Use HTTPS-only tenant-code submission links and show the secure fallback URL directly in the local app.

## Why This Matters

Agentic Splunk apps need more than "the model can call an MCP tool." They need a reliable path from deployment inventory to evidence-preserving, read-only proof. Better readiness diagnostics and canonical MCP examples would reduce setup time, prevent false debugging trails, and make hackathon demos and production prototypes easier to validate safely.

