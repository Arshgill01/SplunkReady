# Draft Splunk Feedback Form Answers

Date: 2026-06-12

Status: field-mapped draft packet. The public Devpost feedback page and rules
confirm that the Most Valuable Feedback path uses an online feedback form and
expects complete, actionable comments. The exact Google Form question labels
were not exposed in the publicly fetched HTML, so this packet maps the likely
fields without claiming exact form text. Do not claim the form has been
submitted until a confirmation page or receipt exists.

Official feedback form URL: `https://splunk.devpost.com/details/feedback`

Public requirement mapping verified on 2026-06-12:

- Entrant must be registered for the hackathon on Devpost.
- Entrant must complete the online feedback form during the Feedback Period.
- Feedback should be complete and actionable, such as bug reports, UI
  improvements, suggested integrations, or SDK/documentation improvements.
- One feedback submission per entrant.

## Paste-Ready Field Mapping

### Project / Entrant Context

I built SplunkReady, a Splunk-native certification harness for AI agents. It
uses fixture and live Splunk contracts, Splunk MCP traces, deterministic trace
grading, AppInspect evidence, Splunk app packaging, and Readiness Receipts to
answer one question: before an agent operates on a Splunk deployment, can it
safely and correctly use that deployment's indexes, saved searches, fields, and
evidence?

### Primary Feedback Summary

The biggest developer-experience gap is that Splunk MCP setup can prove "the
server is reachable" before it proves "a developer has a known-good, read-only,
evidence-preserving workflow." A fresh Splunk environment can expose MCP tools
and still lack runnable saved searches, row-returning sample data, correct app
context, field extraction, hosted-model entitlement, or a clear activation
state. Those failures look similar from the client side, which makes developers
debug the agent when the blocker is actually environment readiness.

### Most Actionable Improvement

Publish an official MCP readiness ladder for fresh Splunk trials:

- validate Splunk server, KVStore, app, auth, and MCP endpoint readiness;
- run a token-safe read-only JSON-RPC smoke call;
- discover an app-qualified saved search;
- execute that saved search with exact argument names;
- return row-level evidence refs immediately from official sample data;
- report hosted-model/SAIA tools as available, forbidden, not routed, or
  pending activation.

### Bug / Friction Report

The saved-search discover-then-run path needs tighter schema alignment. MCP
inventory naturally returns fields such as app and name, while the run tool
expects `saved_search_name`. Passing inventory output directly into the run
call is easy to get wrong. Either align the field names or document the exact
translation in a canonical discover-then-run example.

### Documentation Improvement

Document MCP response envelopes with concrete examples. During the build,
useful output appeared across `result.structuredContent`, `result.output`, and
`result.content[].text`. Client authors can normalize this, but official
examples would reduce trial-and-error and make integrations more consistent.

### SDK / Integration Improvement

Tool discovery should expose readiness, not just presence. Hosted-model tools
can be visible but unavailable to the active user because of entitlement,
routing, or activation state. A safe permission diagnostic should report each
hosted-model tool as available, forbidden, not routed, or pending activation
without executing a prompt or search.

### Sample Data / Demo Improvement

Official MCP demo data should be relative-time safe. Fixed timestamps silently
age out of searches like `earliest=-24h`, making a correctly installed demo
look broken. The sample pack should generate current timestamps at install time
or include a row-count verification step, and saved searches should preserve the
fields and row-level evidence refs required by agents and audit tools.

### App Packaging / AppInspect Improvement

AppInspect gives useful local readiness evidence, but hackathon projects need a
clear distinction between "local package readiness" and "external
Splunkbase/Splunk Cloud approval." A checklist separating credential-free local
packaging, AppInspect precertification, install proof, Splunk Web proof,
publisher-account setup, marketplace upload, and cloud review would help teams
report status honestly.

### Impact

These changes would make Splunk's agentic developer path feel like a guided
readiness ladder: connect MCP, validate auth, discover content, run a known-good
read-only task, preserve evidence, then layer agents and hosted models on top.
That would reduce setup ambiguity and help developers build agentic Splunk apps
that are safer, easier to debug, and easier to trust.

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
