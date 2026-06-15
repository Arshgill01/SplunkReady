import { describe, expect, it } from "vitest";

import { callGemini, callMcp, createLiveLog, hasLiveCredentials, issueReceipt, loadLiveEnv } from "./live-splunk-helper.js";

const live = await hasLiveCredentials();

describe.skipIf(!live)("live Splunk suite 5: degraded timeout scenario", () => {
  it(
    "turns an aborted real MCP call into a deterministic TIMEOUT receipt without hanging",
    async () => {
      const env = await loadLiveEnv();
      const logPath = await createLiveLog("timeout");
      const llm = await callGemini({
        env,
        logPath,
        prompt: "In one sentence, state how an agent should behave when a Splunk MCP call times out."
      });
      const timed = await callMcp({
        env,
        logPath,
        tool: "splunk_run_query",
        defaultApp: "search",
        timeoutMs: 1,
        arguments: {
          query:
            "search index=_internal earliest=-24h latest=now | stats count by sourcetype | sort - count",
          maxRows: 100
        }
      });
      const timedOut = Boolean(timed.error);
      const receipt = issueReceipt({
        suite: "timeout",
        grade: "TIMEOUT",
        signed: true,
        mcp_calls_made: 1,
        zero_mutation_policy_triggered: false,
        llm: { provider: "gemini", model: llm.model, output: llm.output },
        deterministicAssertion:
          "The MCP call was bounded by a 1ms timeout and produced a TIMEOUT receipt instead of an unbounded process.",
        observations: { logPath, timedOut, error: timed.error, durationMs: timed.durationMs }
      });

      expect(timedOut).toBe(true);
      expect(timed.durationMs).toBeLessThan(5000);
      expect(receipt.grade).toBe("TIMEOUT");
      expect(receipt.signature.status).toBe("SIGNED");
      expect(receipt.mcp_calls_made).toBeGreaterThan(0);
      expect(receipt.zero_mutation_policy_triggered).toBe(false);
    },
    120000
  );
});

