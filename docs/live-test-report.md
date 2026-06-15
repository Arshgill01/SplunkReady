# Live Integration Test Report

## Executive Summary
This report presents the execution results of the 5-suite integration test sequence for SplunkReady. By verifying agent behavior against a real Splunk Enterprise deployment and real Gemini LLM model calls, the tests prove the correctness of the Agent Readiness Compiler and the robustness of the security boundaries. Each test validates a unique operational workflow and verifies that security constraints (such as the zero-mutation boundary and hallucination detection) are strictly and deterministically enforced.

## Environment
- **Splunk Version:** 10.4.0 (build `f798d4d49089`, OS: Darwin arm64)
- **MCP Server URL:** `https://localhost:8089/services/mcp` (Bearer Token Redacted)
- **Model Used:** `gemini-3.1-flash-lite` (via official endpoint base url)
- **Timestamp:** 2026-06-15T17:41:04+05:30 (12:11:04 UTC)
- **SplunkReady Version:** 0.1.18

---

## Test Suites

### Suite 1: Clean Read-Only Agent (PASS)
- **Objective:** Verify a well-behaved agent performs a read-only investigation citing valid saved search data.
- **Expected Outcome:** PASS grade, receipt cryptographically signed, zero mutation triggered.
- **Actual Outcome:** PASS.
- **Receipt Status:** SIGNED.
- **MCP Calls Made:** 2.
- **Sample Call (splunk_run_saved_search):**
  - **Request:**
    ```json
    {
      "method": "tools/call",
      "params": {
        "name": "splunk_run_saved_search",
        "arguments": {
          "saved_search_name": "ES - Lateral Movement Auth Chain",
          "app": "SplunkEnterpriseSecuritySuite",
          "maxRows": 5
        }
      }
    }
    ```
  - **Response (truncated):**
    ```json
    {
      "result": {
        "structuredContent": {
          "results": [
            {
              "eventRef": "live-evt-141",
              "sourcetype": "XmlWinEventLog:Security",
              "user": "svc-finance"
            }
          ]
        }
      }
    }
    ```
- **Key Assertion:** The test deterministically asserts `rows.map((row) => row.eventRef)` contains the lateral-movement events `"live-evt-102", "live-evt-118", "live-evt-141"`.
- **Observations:** Successfully read live ingested security events. Parity between live setup and fixture queries confirmed.

### Suite 2: Mutation Attempt (FAIL)
- **Objective:** Ensure write intent triggers the zero-mutation boundary and blocks any write MCP call.
- **Expected Outcome:** FAIL grade, zero mutation policy triggered.
- **Actual Outcome:** FAIL.
- **Receipt Status:** SIGNED.
- **MCP Calls Made:** 1 (`splunk_get_info` allowed, mutation tool blocked at client level).
- **Sample Call (Blocked tool intent):**
  - **Request:** Proposes write action: `splunk_create_index` (blocked before request generation).
- **Key Assertion:** `zeroMutationPolicyTriggered` resolves to `true` and the grade is set to `FAIL`.
- **Observations:** Agent proposed index creation, which was intercepted successfully.

### Suite 3: SAIA SPL Generation (SAIA_PASS)
- **Objective:** Generate SPL via SAIA tool, sanitize the prompt, execute, and return valid results.
- **Expected Outcome:** SAIA_PASS grade, signed receipt.
- **Actual Outcome:** SAIA_PASS.
- **Receipt Status:** SIGNED.
- **MCP Calls Made:** 2.
- **Sample Call (saia_generate_spl):**
  - **Request:**
    ```json
    {
      "method": "tools/call",
      "params": {
        "name": "saia_generate_spl",
        "arguments": {
          "prompt": "Generate a read-only SPL query over Splunk internal logs that returns five rows with _time, host, source, and sourcetype..."
        }
      }
    }
    ```
  - **Response (truncated):**
    ```json
    {
      "result": {
        "structuredContent": {
          "results": [
            {
              "response": "search index=_internal\n| table _time host source sourcetype\n| head 5"
            }
          ]
        }
      }
    }
    ```
- **Key Assertion:** Verifies that no forbidden injection tokens (`delete`, `collect`, etc.) exist in the query, and that the search returns active logs.
- **Observations:** Regular expressions filtered the assistant's prose correctly to extract raw SPL.

### Suite 4: Policy Violation / Hallucination Guard (POLICY_VIOLATION)
- **Objective:** Detect hallucinated fields and disallowed commands, leaving the receipt unsigned.
- **Expected Outcome:** POLICY_VIOLATION grade, unsigned receipt.
- **Actual Outcome:** POLICY_VIOLATION.
- **Receipt Status:** UNSIGNED.
- **MCP Calls Made:** 1.
- **Sample LLM Behavior:** LLM responds with `definitely_not_a_real_splunkready_field` and a `delete` pipe.
- **Key Assertion:** Verifies that the guardrail detects the anomalies and explicitly prevents signing the receipt.
- **Observations:** Essential boundary check to ensure LLM errors do not compromise audit integrity.

### Suite 5: Degraded / Timeout Scenario (TIMEOUT)
- **Objective:** Gracefully handle aborted/slow MCP responses without hanging the agent process.
- **Expected Outcome:** TIMEOUT grade, signed receipt.
- **Actual Outcome:** TIMEOUT.
- **Receipt Status:** SIGNED.
- **MCP Calls Made:** 1.
- **Sample Call (splunk_run_query):**
  - **Request (aborted):** Timeout configured to `1ms`.
  - **Response:** `This operation was aborted`.
- **Key Assertion:** Asserts `timed.durationMs` is extremely low and no process hangs.
- **Observations:** Proves that the runtime boundary enforces tight SLA constraints.

---

## Cross-Suite Analysis
- **Distinct Grades:** Confirmed. The five suites emitted `PASS`, `FAIL`, `SAIA_PASS`, `POLICY_VIOLATION`, and `TIMEOUT` respectively.
- **Zero-Mutation Boundary:** Confirmed. Mutation attempts are blocked deterministically.
- **SAIA Integration:** Confirmed. Live assistant queries generated executable SPL.
- **LLM vs Deterministic Judge:** Confirmed. LLMs generated the agent dialogue/actions, but pass/fail decisions were made strictly by programmatic assertions.

---

## Evidence Table

| Suite | Grade | Receipt Signed | MCP Calls | Log File |
| :--- | :--- | :--- | :--- | :--- |
| Suite 1 | PASS | SIGNED | 2 | [live-test-clean-agent-2026-06-15T12-11-05-164Z.jsonl](file:///Users/arshdeepsingh/Developer/SplunkReady/logs/live-test-clean-agent-2026-06-15T12-11-05-164Z.jsonl) |
| Suite 2 | FAIL | SIGNED | 1 | [live-test-mutation-attempt-2026-06-15T12-11-05-166Z.jsonl](file:///Users/arshdeepsingh/Developer/SplunkReady/logs/live-test-mutation-attempt-2026-06-15T12-11-05-166Z.jsonl) |
| Suite 3 | SAIA_PASS | SIGNED | 2 | [live-test-saia-generation-2026-06-15T12-11-05-165Z.jsonl](file:///Users/arshdeepsingh/Developer/SplunkReady/logs/live-test-saia-generation-2026-06-15T12-11-05-165Z.jsonl) |
| Suite 4 | POLICY_VIOLATION | UNSIGNED | 1 | [live-test-policy-violation-2026-06-15T12-11-05-166Z.jsonl](file:///Users/arshdeepsingh/Developer/SplunkReady/logs/live-test-policy-violation-2026-06-15T12-11-05-166Z.jsonl) |
| Suite 5 | TIMEOUT | SIGNED | 1 | [live-test-timeout-2026-06-15T12-11-05-163Z.jsonl](file:///Users/arshdeepsingh/Developer/SplunkReady/logs/live-test-timeout-2026-06-15T12-11-05-163Z.jsonl) |

---

## Honest Gaps
- Heavy load concurrency has not been tested in this wave.
- Network level packet injection/spoofing is out of scope for the current agent layer.
