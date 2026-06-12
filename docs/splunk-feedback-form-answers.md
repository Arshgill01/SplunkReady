# Draft Splunk Feedback Form Answers

Date: 2026-06-12

Status: draft answer bank. When the official feedback form is opened, map these
answers to the exact questions before submitting. Do not claim the form has been
submitted until a confirmation page or receipt exists.

## Short Project Context

I built SplunkReady, a certification harness for Splunk-connected AI agents.
The project uses Splunk MCP, live and fixture Splunk contracts, captured MCP
transcripts, AppInspect evidence, and Splunk app packaging to answer a specific
question: before an agent operates on a Splunk deployment, can it safely and
correctly use that deployment's indexes, saved searches, fields, and evidence?

That build path exercised fresh Splunk Enterprise setup, local Splunk MCP
connectivity, saved-search discovery and execution, Splunk AI Assistant hosted
model tooling, AppInspect, Splunk app packaging, and Splunk Web rendering.

## Most Valuable Feedback

The biggest developer-experience gap is that Splunk MCP setup currently proves
"the server is reachable" before it proves "a developer has a known-good,
read-only, evidence-preserving workflow." A fresh Splunk environment can expose
MCP tools and still lack runnable saved searches, row-returning sample data,
proper app context, field extraction, or hosted-model entitlement. Those failure
modes look similar from the client side, which makes developers debug the agent
when the actual blocker is environment readiness.

The most useful improvement would be an official MCP readiness path that starts
from a fresh Splunk trial and ends with a known-good read-only JSON-RPC call,
including:

- server, KVStore, app, and MCP endpoint readiness;
- token/auth validation without leaking secrets;
- a canonical discover-then-run saved-search example;
- sample data that returns row-level evidence refs immediately;
- per-tool entitlement status, especially for SAIA hosted-model tools.

## Specific MCP Feedback

The discover-then-run saved-search workflow needs tighter schema alignment and
examples. Inventory returns saved-search metadata with fields such as app and
name, but the run tool expects `saved_search_name`. That is easy to get wrong
because the natural client behavior is to pass inventory fields directly into
the run call. The fix can be either schema alignment or a canonical example
showing the exact translation:

1. call knowledge-object inventory;
2. choose an app-qualified saved search;
3. call `splunk_run_saved_search` with the exact required argument names;
4. preserve row-level evidence refs in the result.

MCP response envelopes should also be documented with concrete examples.
During implementation, useful output appeared in `result.structuredContent`,
`result.output`, and `result.content[].text`. Client authors can handle this,
but official examples would reduce trial-and-error and make integrations more
consistent.

## Specific Hosted Models / SAIA Feedback

Hosted-model tools can be visible but still unavailable to the active user. In
my implementation, read-only Splunk MCP calls worked, and hosted-model tools
were discoverable, but direct SAIA calls could still fail due to entitlement or
route state. Tool discovery alone is not enough; developers need a safe
permission diagnostic that reports each hosted-model tool as available,
forbidden, not routed, or pending activation.

The SAIA tenant-code activation path also needs clearer browser-safe handling.
The local flow generated a tenant code, but an insecure `http://` submission
link was blocked by browser/firewall behavior. Manually using the secure
`https://www.splunk.com/en_us/form/tenantcodesubmit.html` path worked better.
The local app should show the HTTPS submission URL directly and expose a clear
wait-state diagnostic after code submission.

## Specific Sample Data / Demo Readiness Feedback

Official sample data for MCP demos should be designed for relative-time
readiness. Fixed timestamps silently age out of searches like `earliest=-24h`,
which makes a correctly installed demo look broken. A sample pack should either
generate current timestamps at install time or include a clear row-count
verification step immediately after ingest.

Field extraction also matters. I saw one-shot CSV ingestion create events that
were visible in `_raw` and counted by `eventcount`, while field-filtered saved
searches returned zero rows until the saved search extracted fields with `rex`.
For MCP demos, sample saved searches should be self-contained enough to preserve
the fields and row-level evidence refs required by agents and audit tools.

## Specific AppInspect / Splunk App Feedback

AppInspect is useful, but the path from "locally clean package" to "publicly
available Splunkbase/Splunk Cloud app" still contains external blockers that
should be easier to distinguish. In SplunkReady I could produce a credential-free
`.spl` package, AppInspect precertification, install proof, Splunk Web proof,
and receipt-store proof. That is strong local readiness evidence, but publisher
account setup, Splunkbase upload, and Splunk Cloud review remain separate
external steps.

It would help to have a more explicit "local package readiness" versus
"external marketplace approval" checklist so hackathon projects can report
their status honestly without overstating availability.

## What Worked Well

Splunk MCP made it possible to treat Splunk as an agent-operable system without
hardcoding direct REST calls into the product logic. AppInspect and Splunk app
packaging also gave useful production-readiness signals. The strongest part of
the ecosystem is that it supports real enterprise-grade proof when the developer
can connect MCP traces, package validation, and reproducible evidence.

## Suggested Product Improvements

- Publish a one-command local MCP smoke test for fresh trials.
- Provide a small official saved-search and sample-data pack for MCP demos.
- Add per-tool entitlement/readiness diagnostics to MCP tool discovery or a
  companion readiness endpoint.
- Align saved-search inventory field names with run-tool argument names.
- Document response-envelope variants for common MCP tools.
- Provide canonical row-level evidence-preserving SPL examples.
- Make hosted-model activation state visible from the local Splunk side.
- Separate local app package readiness from Splunkbase/Splunk Cloud approval in
  official checklists.

## Closing Summary

The biggest opportunity is to make Splunk's agentic developer path feel like a
guided readiness ladder: connect MCP, validate auth, discover content, run a
known-good read-only task, preserve evidence, then layer agents and hosted
models on top. That would reduce setup ambiguity and help developers build
agentic Splunk apps that are safer, easier to debug, and easier to trust.

