# Draft Splunk Feedback Form Answers

Date: 2026-06-12

Status: exact-field draft packet. The public Devpost feedback page embeds the
official Google Form, and its public form payload exposes the question labels
below. Do not claim the form has been submitted until a confirmation page or
receipt exists.

Official feedback form URL: `https://splunk.devpost.com/details/feedback`

Embedded Google Form URL:
`https://docs.google.com/forms/d/e/1FAIpQLSde9xP1zGdcXuXX1h1bY42U9kPlitArLmKZweiLCLEH3x27Xg/viewform?embedded=true`

Public requirement mapping verified on 2026-06-12:

- Entrant must be registered for the hackathon on Devpost.
- Entrant must complete the online feedback form during the Feedback Period.
- Feedback should be complete and actionable, such as bug reports, UI
  improvements, suggested integrations, or SDK/documentation improvements.
- One feedback submission per entrant.
- The Google Form says feedback must be submitted by 9am PT on June 19, 2026.

## Exact Form Mapping

### Section 1: Basics

Full Name: fill with entrant's first and last name.

Devpost Username: fill with entrant's Devpost username.

Did you submit a project?: `Yes`, if SplunkReady is submitted before feedback
submission; otherwise `No`.

### Section 2: Splunk AI Capabilities - Overview

Which Splunk AI capabilities did you try or use during this hackathon?:

- AI for Splunk Apps (Python SDK AI agentic workflows), if used directly.
- Splunk MCP Server.
- Splunk AI Assistant (SAIA), if the hosted-model/SAIA activation path was
  exercised.
- Splunk AI Toolkit (AITK), only if actually used.
- Splunk Hosted Models, if the hosted-model tooling path was exercised.

Which area were you most focused on during the hackathon?:

Developer tooling and security: I built SplunkReady, a certification harness
that proves whether an AI agent is safe and correct enough to operate on a
specific Splunk deployment.

How would you rate your overall experience in the Splunk AI Hackathon?: `4`
or `5`. Use `4` if you want the rating to match the friction-heavy feedback;
use `5` only if the final submission experience is smooth.

How likely are you to recommend Splunk AI tools to a colleague or friend?:
`8`. Use `9` only if the final MCP and hosted-model setup path is fully
working without manual workaround.

Would you continue using Splunk AI capabilities beyond this hackathon?:
`Definitely yes`.

### Section 3a: AI for Splunk Apps (Python SDK)

Did you use AI for Splunk Apps (Python SDK) during the hackathon?: answer
truthfully based on final implementation. If no direct Python SDK AI agentic
workflow was used, choose `No` and skip this section.

What were the strengths and limitations of building agentic workflows with the
Python SDK?:

The useful part is that Splunk is clearly investing in agentic workflows as a
first-class developer path. The limitation I hit while building SplunkReady is
that readiness evidence still has to be assembled across setup, MCP tool
schemas, sample data, AppInspect, and live/fixture parity. The SDK path would
be stronger if it shipped with a canonical "agent readiness" example that
starts from a fresh Splunk instance and ends with a deterministic, read-only
proof trace.

What features or improvements would make the Python SDK significantly more
useful for your work?:

Add a readiness scaffold that validates auth, app context, indexes, saved
searches, sample data freshness, and row-level evidence preservation before an
agent runs. For safety-focused agent work, the most valuable SDK helper would
not be another planner; it would be a deterministic preflight harness that says
what the agent is allowed to use and what evidence must be preserved.

How would you rate AI for Splunk Apps (Python SDK) overall?: `4` if used
directly and the above friction matches the final experience.

### Section 3b: Splunk MCP Server

Did you use the Splunk MCP Server during the hackathon?: `Yes`.

What were the strengths and limitations of the Splunk MCP Server?:

Splunk MCP was the most important integration surface for SplunkReady because
it let the project treat Splunk as an agent-operable system without hardcoding
direct REST calls into the product logic. The strongest part is tool-based
access to Splunk inventory, saved searches, search execution, and adjacent
AI/SAIA tooling. The limitation is that MCP setup can prove "the server is
reachable" before it proves "this deployment has a known-good, read-only,
evidence-preserving workflow." A fresh Splunk environment can expose MCP tools
and still lack runnable saved searches, row-returning sample data, correct app
context, field extraction, hosted-model entitlement, or clear activation
state. Those failures look similar from the client side, which makes teams
debug the agent when the blocker is actually environment readiness.

What improvements or additional capabilities would you like to see in the
Splunk MCP Server?:

Publish an official MCP readiness ladder for fresh Splunk trials: validate
Splunk server, KVStore, app, auth, and MCP endpoint readiness; run a token-safe
read-only JSON-RPC smoke call; discover an app-qualified saved search; execute
that saved search with exact argument names; return row-level evidence refs
from official sample data; and report hosted-model/SAIA tools as available,
forbidden, not routed, or pending activation. Also align saved-search inventory
fields with run-tool arguments, or document the exact translation from
inventory `name` to run argument `saved_search_name`.

How would you rate the Splunk MCP Server overall?: `4`.

### Section 3c: Splunk AI Assistant (SAIA) for SPL

Did you use the Splunk AI Assistant (SAIA) for SPL during the hackathon?:
answer based on final use. If the work only reached discoverable/activation
state and not successful SAIA calls, choose `No` unless the final lap changes
that.

How useful was the AI Assistant for generating and editing SPL queries?:
`4` if a successful SAIA path is used; otherwise skip.

What would you improve about the Splunk AI Assistant?:

Hosted-model and SAIA tools need clearer readiness diagnostics. In my build,
read-only Splunk MCP calls could work while hosted-model tools were visible but
not necessarily available to the active user because of entitlement, routing,
or activation state. Tool discovery should expose whether each AI Assistant or
hosted-model capability is available, forbidden, not routed, or pending
activation without requiring a prompt execution. SPL-related schemas should
also call out argument-name differences, such as `query` for search execution
versus `spl` for SAIA explanation/optimization.

How would you rate the Splunk AI Assistant (SAIA) for SPL overall?: `4` if
used successfully.

### Section 3d: Splunk AI Toolkit (AITK)

Did you use the Splunk AI Toolkit (AITK) during the hackathon?: answer
truthfully. If not used, choose `No`.

### Section 3e: Splunk Hosted Models

Did you use Splunk Hosted Models during the hackathon?: answer based on final
successful use. If only discovery/activation was tested, choose `No` unless the
final lap changes that.

Which hosted model(s) did you use?: select only the models actually used.

What were the strengths and limitations of the model(s) you used?:

The hosted-model path is promising because it keeps AI capabilities close to
Splunk data and developer workflows. The limitation for this build was not
model quality; it was readiness visibility. A tool can appear in the available
surface while the active user still lacks entitlement, routing, or activation.
That makes it hard to distinguish "my prompt failed" from "my tenant is not
ready."

What additional models or capabilities would you like to see hosted on Splunk?:

For agent certification, the highest-value hosted capability would be an
advisory SPL reviewer that explains risk without becoming the authoritative
pass/fail judge. It should flag broad searches, missing time bounds, missing
evidence refs, and likely field-extraction mistakes, while leaving final
approval to deterministic policy checks.

How would you rate Splunk Hosted Models overall?: `4` if used successfully.

### Section 4: Setup & Documentation

How long did it take you to get your Splunk development environment set up,
and what was the biggest barrier or frustration you encountered?:

The environment came together, but the time cost was in distinguishing similar
failure modes: Splunk Enterprise readiness, MCP endpoint/auth readiness,
KVStore/app readiness, saved-search namespace, sample-data freshness, field
extraction, and hosted-model entitlement. The biggest frustration was that a
green connection does not necessarily mean a developer has a known-good
read-only proof task. I had to build SplunkReady's own readiness checks around
fixture/live parity, MCP transcripts, saved-search verification, AppInspect
evidence, and receipt artifacts to make those states explicit.

How would you rate the following Splunk documentation and learning resources?:

- AI capability-specific docs: `Helpful`.
- Code examples and sample projects: `Somewhat Helpful` or `Helpful`.
- Community Slack channel support: answer based on actual usage.

What documentation was missing, hard to find, or out of date?:

The missing doc is a complete agentic readiness path for MCP: fresh Splunk
trial, token-safe MCP smoke call, app-qualified saved-search discovery,
read-only saved-search execution with exact argument names, row-level evidence
refs, and hosted-model readiness diagnostics. Response-envelope examples would
also help: useful MCP output can appear in `structuredContent`, `output`, or
`content[].text`, and client authors need canonical examples for each common
tool.

### Section 5: Overall Feedback

If you could make one change to the Splunk developer experience, what would it
be?:

Make "readiness" a first-class developer product. Before a developer builds an
agent, Splunk should be able to tell them whether their environment, MCP
endpoint, auth, app context, saved searches, sample data, field extraction,
evidence refs, and hosted-model entitlements are ready for a safe read-only
agent workflow. That one readiness ladder would turn a loose collection of
powerful capabilities into a predictable agentic developer experience.

Is there anything else you'd like to share with the Splunk team?:

SplunkReady exists because Splunk's agentic stack is powerful enough that
teams now need deployment-specific certification, not just demos. The product
does not try to replace Splunk MCP, Splunk AI Assistant, AppInspect, or hosted
models. It composes them into a deterministic readiness receipt so operators
can see what an agent touched, what evidence it preserved, which policies it
violated, and why it is or is not ready for a specific Splunk deployment. The
main opportunity is to make that kind of proof easier for every developer to
produce from official Splunk tooling.

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
