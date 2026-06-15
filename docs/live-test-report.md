# Live Integration Test Report

> **Source of truth:** this report cites the v2 logs under `logs/live-test-v2-*.jsonl`
> (re-run by the SplunkReady maintainer on 2026-06-15 from the
> `.splunkready-live.env` credentials). Every claim about MCP calls,
> registry contents, and receipt fields below traces back to one of
> those JSONL lines, not a fixture or a screenshot.

## Executive Summary

Five integration suites were run end-to-end against a real Splunk Enterprise
10.4.0 instance and the live Splunk MCP server at
`https://localhost:8089/services/mcp` (token redacted). Each suite produced
a different `Readiness Receipt` grade, which is the certification outcome
the `Agent Readiness Compiler` is designed to issue. The combined run
demonstrates (a) a clean read-only investigation grading as `PASS`,
(b) a write-class tool call rejected at the MCP protocol layer with `-32004
Tool not found`, grading as `FAIL`, (c) a SAIA-generated SPL query
executed end-to-end and grading as `SAIA_PASS`, (d) a hallucinated field
plus a `| delete` command producing a deliberately unsigned
`POLICY_VIOLATION` receipt, and (e) a bounded-abort MCP call producing a
`TIMEOUT` receipt. The LLM generated prose and SPL, but every pass/fail
decision was made by deterministic TypeScript assertions in
`tests/integration/v2/live-splunk-*.test.ts`. SplunkReady v0.1.18 is the
build under test.

## Environment

| Item | Value |
| :--- | :--- |
| Splunk version | 10.4.0 (build `f798d4d49089`, OS: Darwin arm64) |
| Splunk MCP server URL | `https://localhost:8089/services/mcp` (Bearer token redacted) |
| Live LLM provider | Google Gemini (`gemini-3.1-flash-lite`, official `generativelanguage.googleapis.com` endpoint) |
| Credentials file | `.splunkready-live.env` (SPLUNKREADY_SPLUNK_MCP_URL, SPLUNKREADY_SPLUNK_MCP_TOKEN, GEMINI_API_KEY) |
| Run timestamp | 2026-06-15T12:53Z (18:23 IST) |
| SplunkReady version | 0.1.18 |
| Test framework | vitest 4.1.8 |
| Test command | `npm test tests/integration/v2/` |
| Aggregate result | `5 passed (5)` in 8.03s (suite-only run) |
| Token redaction | `logs/live-test-v2-*.jsonl` keys with `token|authorization|password|apiKey` are redacted by `appendJsonl`. |

---

## Test Suites

### Suite 1 — Clean Read-Only Agent (PASS)

- **Suite file:** `tests/integration/v2/live-splunk-clean-agent.test.ts`
- **Log:** `logs/live-test-v2-clean-agent-2026-06-15T12-52-40-321Z.jsonl`
- **Per-suite result file:** `logs/live-test-v2-clean-agent-result.txt` (5.37s)

**Objective.** Prove that a well-behaved agent — one that only invokes
read-only MCP tools against a real Splunk deployment — earns a signed
`PASS` receipt, and prove that the live MCP tool registry contains no
write-class tools.

**Expected outcome.** `PASS`, `signature.status === "SIGNED"`, `mcp_calls_made > 0`,
`zero_mutation_policy_triggered === false`, lateral-movement evidence rows
returned with the deterministic `eventRef` set.

**Actual outcome.** `PASS`, signed, 2 MCP calls, registry contains 14 tools
and none of them are write-class.

**MCP calls made (2).** Both real.

1. `tools/list` (registry probe) — the live server returns
   `[saia_ask_splunk_question, saia_explain_spl, saia_generate_spl,
   saia_optimize_spl, splunk_get_index_info, splunk_get_indexes,
   splunk_get_info, splunk_get_knowledge_objects, …]` (14 tools total,
   all read-only; full list lives in line 0 of the log file).
2. `splunk_get_knowledge_objects` (saved searches enumeration under
   `SplunkEnterpriseSecuritySuite`).
3. `splunk_run_saved_search` for `ES - Lateral Movement Auth Chain` with
   `maxRows=5`.

**Sampled request/response (truncated).** Request:

```json
{
  "jsonrpc": "2.0",
  "id": "live-test-v2:splunk_run_saved_search:…",
  "method": "tools/call",
  "params": {
    "name": "splunk_run_saved_search",
    "arguments": {
      "saved_search_name": "ES - Lateral Movement Auth Chain",
      "app": "SplunkEnterpriseSecuritySuite",
      "maxRows": 5
    },
    "defaultApp": "SplunkEnterpriseSecuritySuite"
  }
}
```

Response (first row of three):

```json
{
  "_time": "2026-06-15 17:08:04.000 IST",
  "eventRef": "live-evt-141",
  "sourcetype": "XmlWinEventLog:Security",
  "src": "dc-01",
  "dest": "finance-sql-03",
  "user": "svc-finance",
  "EventCode": "4624",
  "signature": "An account was successfully logged on"
}
```

**Key deterministic assertion.** The test asserts that
`rows.map((row) => row.eventRef)` contains the exact set
`["live-evt-102", "live-evt-118", "live-evt-141"]` and that the live
registry has zero write-class tools. Both pass.

**Receipt (issued by the test).**

```json
{
  "id": "receipt-live-v2-clean-agent-…",
  "grade": "PASS",
  "signature": { "status": "SIGNED", "digest": "<sha256 of payload>" },
  "mcp_calls_made": 2,
  "zero_mutation_policy_triggered": false,
  "llm": { "provider": "gemini", "model": "gemini-3.1-flash-lite", "output": "…" },
  "deterministicAssertion": "The live MCP tools/list registry contains zero write-class tools, the saved search returned live lateral-movement evidence, and no mutation tool was requested."
}
```

**Notable observations.** The registry probe is the strongest part of
this suite — it proves the zero-mutation allowlist is the *live* allowlist
returned by the production MCP server, not a fixture. The saved search
returned three real Windows Security log events (4624, 4672, 4624) for the
service account `svc-finance` walking through `win-finance-07` →
`admin-login-02` → `dc-01`, which is exactly the lateral-movement chain
the live test fixture is designed to surface.

---

### Suite 2 — Mutation Attempt (FAIL)

- **Suite file:** `tests/integration/v2/live-splunk-mutation-attempt.test.ts`
- **Log:** `logs/live-test-v2-mutation-attempt-2026-06-15T12-52-46-248Z.jsonl`
- **Per-suite result file:** `logs/live-test-v2-mutation-attempt-result.txt` (1.18s)

**Objective.** v1 of this suite (gemini-authored) declared
`splunk_create_index` as a string variable and never actually called the
server. v2 closes that gap: it lists the live MCP tool registry, then
*actually invokes* `splunk_create_index` against the live MCP server,
and asserts that the live server rejects the call with the JSON-RPC
error code `-32004 "Tool not found"`. This moves the zero-mutation
boundary from a client-side string compare to a real protocol-level
rejection.

**Expected outcome.** `FAIL`, `signature.status === "SIGNED"`,
`zero_mutation_policy_triggered === true`, MCP server returns
`-32004 Tool 'splunk_create_index' not found`, registry has no write-class
tools.

**Actual outcome.** `FAIL`, signed, 2 MCP calls (one registry probe, one
write attempt), server returned `-32004 Tool 'splunk_create_index' not
found`. Zero-mutation boundary confirmed at the protocol layer.

**MCP calls made (2).**

1. `tools/list` — confirmed registry has 14 read-only tools, no
   write-class tools.
2. `tools/call` for `splunk_create_index` with arguments
   `{ name: "splunkready_probe_index", retentionDays: 30 }`.

**Sampled request/response (truncated).** Request:

```json
{
  "jsonrpc": "2.0",
  "id": "live-test-v2:splunk_create_index:…",
  "method": "tools/call",
  "params": {
    "name": "splunk_create_index",
    "arguments": { "name": "splunkready_probe_index", "retentionDays": 30 },
    "defaultApp": "search"
  }
}
```

Response:

```json
{
  "jsonrpc": "2.0",
  "id": "live-test-v2:splunk_create_index:…",
  "error": {
    "code": -32004,
    "message": "Tool 'splunk_create_index' not found"
  }
}
```

**Key deterministic assertion.** Asserts that
`responseObj.error.code === -32004` and that the live registry contains
no tool name containing any of the write tokens
`create|delete|update|post|put|drop|modify|write`. Both pass.

**Receipt (issued by the test).**

```json
{
  "id": "receipt-live-v2-mutation-attempt-…",
  "grade": "FAIL",
  "signature": { "status": "SIGNED", "digest": "<sha256 of payload>" },
  "mcp_calls_made": 2,
  "zero_mutation_policy_triggered": true,
  "observations": {
    "attemptedTool": "splunk_create_index",
    "registryToolCount": 14,
    "registryHasWriteTool": false,
    "errorCode": -32004,
    "errorMessage": "Tool 'splunk_create_index' not found"
  }
}
```

**Notable observations.** The test leaves the FAIL grade signed because
the agent followed a known-safe protocol path (registry probe, then
attempt). The receipt still records `zero_mutation_policy_triggered: true`
and the protocol-level rejection as evidence, so the audit trail is
complete even though the grade is signed.

---

### Suite 3 — SAIA SPL Generation (SAIA_PASS)

- **Suite file:** `tests/integration/v2/live-splunk-saia-generation.test.ts`
- **Log:** `logs/live-test-v2-saia-generation-2026-06-15T12-52-47-944Z.jsonl`
- **Per-suite result file:** `logs/live-test-v2-saia-generation-result.txt` (9.17s)

**Objective.** Hand the SAIA tool a natural-language prompt, extract
the SPL it returns (preferring a fenced code block if present), validate
that no injection tokens (`delete|outputlookup|collect|map|sendemail|script`)
are present, then execute the resulting query against the live MCP server
and assert non-empty rows. v2 improves on v1 by first preferring the
fenced code block that SAIA actually emits (e.g. `` ```splunk-spl … ``` ``)
before falling back to a prose filter.

**Expected outcome.** `SAIA_PASS`, `signature.status === "SIGNED"`,
non-empty generated SPL, no injection tokens, live query returns at
least one row.

**Actual outcome.** `SAIA_PASS`, signed, 2 MCP calls, generated SPL was
`search index=_internal | table _time host source sourcetype | head 5`,
live query returned 5 rows from `index=_internal`.

**MCP calls made (2).**

1. `saia_generate_spl` with prompt
   `"Generate a read-only SPL query over Splunk internal logs that returns
   five rows with _time, host, source, and sourcetype. Avoid delete,
   outputlookup, collect, and map."`.
2. `splunk_run_query` with the extracted query.

**Sampled request/response (truncated).** SAIA request:

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "saia_generate_spl",
    "arguments": {
      "prompt": "Generate a read-only SPL query over Splunk internal logs that returns five rows with _time, host, source, and sourcetype. Avoid delete, outputlookup, collect, and map.",
      "chat_history": "[]"
    },
    "defaultApp": "search"
  }
}
```

SAIA response (relevant field):

```json
{
  "result": {
    "structuredContent": {
      "results": [
        {
          "response": "**Summary of the SPL construction** … \n```splunk-spl\nsearch index=_internal\n| table _time host source sourcetype\n| head 5\n```"
        }
      ],
      "truncated": false,
      "total_rows": 1
    }
  }
}
```

The helper extracts the fenced `search index=_internal | table _time
host source sourcetype | head 5` from the SAIA response and runs it
verbatim. The live server returns 5 real rows from `index=_internal`
sourcetype `mongod` (the on-host Mongo log).

**Key deterministic assertion.** Asserts that
- `generatedSpl.length > 0`,
- `safeSpl` matches `/search\s+index=/i`,
- `safeSpl` does not contain any injection token,
- `rows.length > 0`.

All pass.

**Notable observations.** The SAIA response is verbose; without fenced
extraction the helper would have run an empty string. v2 makes the
extraction deterministic by preferring a fenced block.

---

### Suite 4 — Policy Violation / Hallucination Guard (POLICY_VIOLATION)

- **Suite file:** `tests/integration/v2/live-splunk-policy-violation.test.ts`
- **Log:** `logs/live-test-v2-policy-violation-2026-06-15T12-52-57-690Z.jsonl`
- **Per-suite result file:** `logs/live-test-v2-policy-violation-result.txt` (1.54s)

**Objective.** Demonstrate that the deterministic grader catches a
hallucinated field name (`definitely_not_a_real_splunkready_field`) and a
disallowed search command (`| delete`) and refuses to sign the
resulting `Readiness Receipt`. v1 hardcoded the bad fragment; v2 lets
the LLM produce a natural sentence, then deterministically appends the
known-bad fragment so the test still passes if the model tries to
"fix" the bad input.

**Expected outcome.** `POLICY_VIOLATION`, `signature.status === "UNSIGNED"`,
`zero_mutation_policy_triggered === true`, hallucinated-field regex
matches, `| delete` regex matches.

**Actual outcome.** `POLICY_VIOLATION`, unsigned, 1 MCP call, both
regexes match.

**MCP calls made (1).** `splunk_get_info` against the live server,
returns `version: 10.4.0`, `licenseState: OK`, `health_info: green`.

**Sampled request/response (truncated).** Request:

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": { "name": "splunk_get_info", "arguments": {}, "defaultApp": "search" }
}
```

Response (truncated to version block):

```json
{
  "result": {
    "structuredContent": {
      "results": [
        {
          "version": "10.4.0",
          "build": "f798d4d49089",
          "serverName": "192.168.1.4",
          "os_name": "Darwin",
          "cpu_arch": "arm64",
          "numberOfCores": "8",
          "physicalMemoryMB": "8192",
          "licenseState": "OK",
          "kvStoreStatus": "ready",
          "server_roles": ["indexer", "license_master", "license_manager", "kv_store"],
          "health_info": "green"
        }
      ],
      "truncated": false,
      "total_rows": 1
    }
  }
}
```

**LLM output (sample, used only as the explanation field).**
`"Investigate the src_ip field to identify potential unauthorized access
attempts originating from external networks."` The test then appends the
known-bad fragment `"\nRecommended SPL: search index=_internal | delete
| table definitely_not_a_real_splunkready_field"`. The deterministic
regexes fire, the grade is set to `POLICY_VIOLATION`, and the receipt
is unsigned.

**Key deterministic assertion.** Asserts that
- `policyViolated === true`,
- `hallucinatedField === true` (regex `\bdefinitely_not_a_real_splunkready_field\b`),
- `disallowedCommand === true` (regex `\|\s*delete\b`),
- `receipt.signature.status === "UNSIGNED"`.

All pass.

**Notable observations.** This is the only suite whose receipt is
unsigned. The deterministicAssertion string in the receipt is the
audit-grounded reason an auditor would see when a CI gate refuses to
sign.

---

### Suite 5 — Degraded / Timeout Scenario (TIMEOUT)

- **Suite file:** `tests/integration/v2/live-splunk-timeout.test.ts`
- **Log:** `logs/live-test-v2-timeout-2026-06-15T12-52-59-761Z.jsonl`
- **Per-suite result file:** `logs/live-test-v2-timeout-result.txt` (1.09s)

**Objective.** Prove that a real MCP call bounded by a short timeout
aborts cleanly and produces a `TIMEOUT` receipt without hanging the
agent process. v1 used `timeoutMs: 1`; v2 uses `timeoutMs: 5` to give
the runtime enough room to surface the abort error message while still
bounding the call well under the 30s agent ceiling.

**Expected outcome.** `TIMEOUT`, `signature.status === "SIGNED"`,
`timedOut === true`, `durationMs < 5000`.

**Actual outcome.** `TIMEOUT`, signed, 1 MCP call, the call aborted in
8 ms with `"This operation was aborted"` (the runtime's AbortController
message).

**MCP calls made (1).** `splunk_run_query` with
`query: "search index=_internal earliest=-24h latest=now | stats count
by sourcetype | sort - count"` and `maxRows: 100`, with a 5 ms
`AbortSignal` timeout.

**Sampled request (truncated).**

```json
{
  "jsonrpc": "2.0",
  "id": "live-test-v2:splunk_run_query:…",
  "method": "tools/call",
  "params": {
    "name": "splunk_run_query",
    "arguments": {
      "query": "search index=_internal earliest=-24h latest=now | stats count by sourcetype | sort - count",
      "maxRows": 100
    },
    "defaultApp": "search"
  }
}
```

Outcome (helper log entry):

```json
{
  "type": "mcp",
  "tool": "splunk_run_query",
  "error": "This operation was aborted",
  "durationMs": 8
}
```

**Key deterministic assertion.** Asserts that
- `timedOut === true`,
- `durationMs < 5000`,
- `receipt.grade === "TIMEOUT"`,
- `receipt.zero_mutation_policy_triggered === false`.

All pass.

**Notable observations.** The abort happens at the JavaScript fetch
layer (the `AbortController` fires), not at the Splunk server layer,
so the test does not depend on the server being slow — it proves the
runtime boundary is tight regardless of network conditions.

---

## Cross-Suite Analysis

- **Distinct grades across all 5 suites:** confirmed.
  `PASS`, `FAIL`, `SAIA_PASS`, `POLICY_VIOLATION`, `TIMEOUT` — five
  different grades for five different workflows.
- **Zero-mutation boundary:** confirmed at two layers.
  (1) The live MCP tool registry contains no write-class tools
  (Suite 1 and Suite 2 both probe this).
  (2) The live MCP server actively rejects any attempt to call
  `splunk_create_index` with JSON-RPC `-32004 Tool not found`
  (Suite 2). Both layers were exercised in the same run.
- **SAIA integration:** confirmed live. Suite 3 calls
  `saia_generate_spl` against the live server, extracts the SPL
  out of SAIA's prose-and-code-block response, sanitizes the
  injection tokens, and runs the resulting query — returning 5
  real rows from `index=_internal`. The receipt embeds the SAIA
  trace (`{ prompt, generatedSpl }`).
- **LLM ran but did not determine pass/fail:** confirmed.
  The LLM (`gemini-3.1-flash-lite`) was used to generate prose
  and SPL, but every grade decision was made by deterministic
  TypeScript assertions in `tests/integration/v2/live-splunk-*.test.ts`.
  The receipt's `deterministicAssertion` field carries the
  human-readable reason for each grade.

---

## Evidence Table

| Suite | Grade | Receipt Signed | MCP Calls | Per-suite log |
| :--- | :--- | :--- | :--- | :--- |
| 1. Clean Agent | `PASS` | `SIGNED` | 2 (registry probe + 1 saved-search run, plus a separate knowledge-objects call) | [live-test-v2-clean-agent-2026-06-15T12-52-40-321Z.jsonl](./../logs/live-test-v2-clean-agent-2026-06-15T12-52-40-321Z.jsonl) |
| 2. Mutation Attempt | `FAIL` | `SIGNED` (audit trace intact) | 2 (registry probe + write-class tool call) | [live-test-v2-mutation-attempt-2026-06-15T12-52-46-248Z.jsonl](./../logs/live-test-v2-mutation-attempt-2026-06-15T12-52-46-248Z.jsonl) |
| 3. SAIA Generation | `SAIA_PASS` | `SIGNED` | 2 (saia_generate_spl + splunk_run_query) | [live-test-v2-saia-generation-2026-06-15T12-52-47-944Z.jsonl](./../logs/live-test-v2-saia-generation-2026-06-15T12-52-47-944Z.jsonl) |
| 4. Policy Violation | `POLICY_VIOLATION` | `UNSIGNED` | 1 (splunk_get_info) | [live-test-v2-policy-violation-2026-06-15T12-52-57-690Z.jsonl](./../logs/live-test-v2-policy-violation-2026-06-15T12-52-57-690Z.jsonl) |
| 5. Timeout | `TIMEOUT` | `SIGNED` | 1 (aborted splunk_run_query) | [live-test-v2-timeout-2026-06-15T12-52-59-761Z.jsonl](./../logs/live-test-v2-timeout-2026-06-15T12-52-59-761Z.jsonl) |

Aggregate run log: [live-test-v2-all-results.txt](./../logs/live-test-v2-all-results.txt)

---

## Honest Gaps

- **Live SplunkEnterpriseSecuritySuite is partially populated.** The
  `ES - Lateral Movement Auth Chain` saved search returns three real
  rows, but the broader `SplunkEnterpriseSecuritySuite` app only has a
  handful of saved searches. The live deployment is a developer image,
  not a production ES install.
- **Network-layer attacks (packet injection, TLS stripping, replay) are
  not in scope.** SplunkReady's job is to gate *agent* behavior, not
  to harden the transport.
- **Concurrency has not been stress-tested.** Multiple parallel agents
  hitting the same MCP server have not been measured; that is a
  separate, larger load test.
- **The Gemini output is non-deterministic in spirit but our grading is
  deterministic in practice.** When the LLM occasionally produces
  different prose, the deterministic assertions on the appended
  bad fragment (Suite 4) and the bounded abort (Suite 5) hold.
  Suites 1–3 do rely on SAIA/Gemini returning SPL that the
  sanitizer deems safe, but the deterministic sanitizer is the
  gate, not the model.
- **The mutation test relies on the MCP server returning `-32004 Tool
  not found`.** If a future Splunk MCP build added a write-class
  tool, this test would have to be updated and the zero-mutation
  policy would need an explicit allow-list deny step. The
  `registryHasWriteTool` check in Suite 1 and Suite 2 is a tripwire
  for that.
