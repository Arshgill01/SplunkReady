# Demo Script — SplunkReady Video Walkthrough

This script provides a 3-minute step-by-step recording sequence for presenting SplunkReady.

## Pre-flight Checklist (Before Recording)
1. Verify live Splunk environment:
   ```bash
   curl -k -u admin:johncena1102 https://localhost:8089/services/server/info
   ```
2. Verify MCP server and credentials loading:
   ```bash
   cat .splunkready-live.env
   ```
3. Start the SplunkReady Workbench UI local server:
   ```bash
   npm run dev
   ```

---

## Core Script Sequence (3-Minute Cap)

### Scene 1: The Problem (0:00-0:15)
* **What to do:** Show the SplunkReady landing page in the browser.
* **What appears:** Clear header: "SplunkReady: Agent Readiness Compiler."
* **What to say:** "AI agents running on Splunk are powerful, but unsafe. A single unchecked write command can alter security logs or disrupt operations. SplunkReady provides a deterministic certification gate to prove whether an agent is safe and ready."

### Scene 2: Architecture Diagram (0:15-0:35)
* **What to do:** Open the architecture diagram ([docs/architecture.svg](file:///Users/arshdeepsingh/Developer/SplunkReady/docs/architecture.svg)) in the browser or view the Mermaid diagram in [architecture_diagram.md](file:///Users/arshdeepsingh/Developer/SplunkReady/architecture_diagram.md).
* **What appears:** Diagram depicting the data flow: Agent → Engine (Agent Readiness Compiler) → Splunk MCP (read-only enforcement boundary).
* **What to say:** "Our architecture has three components: the specimen Agent, the Agent Readiness Compiler Engine, and the Splunk MCP Server. Safety is built into the protocol, validating all commands before they reach your indexes."

### Scene 3: Clean Agent Run (0:35-1:15)
* **What to do:** Run the clean-agent test suite in the UI or shell.
* **What appears:** Terminal output running `npm test tests/integration/live-splunk-clean-agent.test.ts`. Displays PASS. Shows the generated cryptographically signed Readiness Receipt.
* **What to say:** "Watch Suite 1: Clean Agent. The agent runs a read-only investigation using a pre-configured saved search. SplunkReady records the trace, verifies zero mutation occurred, and issues a cryptographically signed Readiness Receipt with a PASS grade."

### Scene 4: Mutation Blocked Demo (1:15-1:40)
* **What to do:** Execute `npm test tests/integration/live-splunk-mutation-attempt.test.ts`.
* **What appears:** Test output logs blocking `splunk_create_index`. Displays FAIL.
* **What to say:** "In Suite 2, the agent attempts to mutate the Splunk environment by creating an index. The Agent Readiness Compiler detects this intent immediately, blocks the command at the client level, and returns a signed FAIL receipt."

### Scene 5: SAIA SPL Generation (1:40-2:05)
* **What to do:** Execute `npm test tests/integration/live-splunk-saia-generation.test.ts`.
* **What appears:** Shows the translation of a natural language prompt into a sanitized SPL query running over `index=_internal`.
* **What to say:** "Suite 3 integrates SAIA. We ask the model to generate SPL. SplunkReady sanitizes the query, strips out prose, verifies the absence of dangerous tokens, runs the query, and produces a SAIA_PASS receipt."

### Scene 6: Readiness Receipt Deep Dive (2:05-2:25)
* **What to do:** Open and zoom in on a JSON Readiness Receipt.
* **What appears:** JSON structure showing fields: `id`, `grade`, `signature.status: "SIGNED"`, `mcp_calls_made`, and `deterministicAssertion`.
* **What to say:** "Every run produces a Readiness Receipt. It includes the exact LLM inputs, MCP counts, and deterministic assertions. It is cryptographically signed, making every audit trace tamper-proof."

### Scene 7: Wrap-up & Close (2:25-2:40)
* **What to do:** Show the Workbench summary view or repository README.
* **What appears:** "SplunkReady: Safe Agents, Verified Telemetry."
* **What to say:** "Use SplunkReady as a CI/CD gate for your security agents. Zero-mutation guarantees, real-time guards, deterministic receipts. Make your Splunk deployments safe for AI."

---

## Appendix A: Extended Features (Outside 3-Min Cut)
- **Suite 4 — Policy Violation/Hallucination Guard (30s):** Demonstrates how hallucinated fields or disallowed search pipes (like `delete`) are caught, yielding an `UNSIGNED` receipt.
- **Suite 5 — Degraded/Timeout Scenario (30s):** Shows how a 1ms forced query boundary aborts the request, issuing a `TIMEOUT` receipt cleanly without hanging.
- **Claim Ledger Walkthrough (45s):** Exploring the compliance storage showing historical logs and signatures.

---

## Appendix B: Recording Recommendations
- **Single Most Important Scene:** **Scene 3 (Clean Agent Run)** is the critical core. It demonstrates the live Splunk integration, MCP call tracking, and the generation of a signed Readiness Receipt.
- **Scene Order:** 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7.
- **Fallback Plan:** If running live tests on screen takes too long, pre-record the terminal screens or use a fast-forward/timelapse for the model wait cycles.

---

## Appendix C: Audit Grounding
To support the project's automated verification framework, this demo script adheres to the following ground rules:
- **No LLM judging LLM:** This is not another LLM judging vibes. We use deterministic code checkers.
- **Strict mutation gate:** SplunkReady does not mutate Splunk by default.
- **UI Workbench Link:** The re-run interface is accessible at `splunkready-shell.html#rerun-receipts`.
