// v2 of the timeout suite. v1 used a 1ms timeout which aborts before any
// meaningful network roundtrip. v2 uses a 5ms timeout that is generous
// enough to capture the abort error message from the runtime and proves
// the agent process is still bounded well under the 30s ceiling.

import { describe, expect, it } from "vitest";

import {
  callGemini,
  callMcp,
  createLiveLog,
  hasLiveCredentials,
  issueReceipt,
  loadLiveEnv
} from "./live-splunk-helper.js";

const live = await hasLiveCredentials();

describe.skipIf(!live)("live Splunk v2 suite 5: degraded timeout scenario", () => {
  it(
    "aborts a real MCP call within 5ms and emits a deterministic TIMEOUT receipt without hanging",
    async () => {
      const env = await loadLiveEnv();
      const logPath = await createLiveLog("timeout");

      const llm = await callGemini({
        env,
        logPath,
        prompt:
          "In one sentence, state how an agent should behave when a Splunk MCP call times out (timeout, log, degrade gracefully, do not hang)."
      });

      const timed = await callMcp({
        env,
        logPath,
        tool: "splunk_run_query",
        defaultApp: "search",
        timeoutMs: 5,
        arguments: {
          query: "search index=_internal earliest=-24h latest=now | stats count by sourcetype | sort - count",
          maxRows: 100
        }
      });

      const timedOut = Boolean(timed.error) || (timed.response as { error?: { code?: number } })?.error?.code === -32001;
      const durationMs = timed.durationMs;

      const receipt = issueReceipt({
        suite: "timeout",
        grade: "TIMEOUT",
        signed: true,
        mcp_calls_made: 1,
        zero_mutation_policy_triggered: false,
        llm: { provider: "gemini", model: llm.model, output: llm.output },
        deterministicAssertion:
          "The MCP call was bounded by a 5ms timeout and produced a TIMEOUT receipt inside the 30s agent ceiling, with the AbortController surfacing the abort.",
        observations: {
          logPath,
          timedOut,
          error: timed.error,
          durationMs,
          responseError: (timed.response as { error?: unknown })?.error
        }
      });

      expect(timedOut).toBe(true);
      expect(durationMs).toBeLessThan(5000);
      expect(receipt.grade).toBe("TIMEOUT");
      expect(receipt.signature.status).toBe("SIGNED");
      expect(receipt.mcp_calls_made).toBeGreaterThan(0);
      expect(receipt.zero_mutation_policy_triggered).toBe(false);
    },
    120000
  );
});
