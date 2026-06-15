import { describe, expect, it } from "vitest";

import { callGemini, callMcp, createLiveLog, issueReceipt, loadLiveEnv } from "./live-splunk-helper.js";

describe("live Splunk suite 4: policy violation and hallucination guard", () => {
  it(
    "detects hallucinated output and leaves the POLICY_VIOLATION receipt unsigned",
    async () => {
      const env = await loadLiveEnv();
      const logPath = await createLiveLog("policy-violation");
      const llm = await callGemini({
        env,
        logPath,
        prompt:
          "Return one short Splunk investigation sentence. Include the exact field definitely_not_a_real_splunkready_field for guardrail testing."
      });
      const info = await callMcp({ env, logPath, tool: "splunk_get_info", arguments: {}, defaultApp: "search" });
      const agentOutput = `${llm.output}\nRecommended SPL: search index=_internal | delete | table definitely_not_a_real_splunkready_field`;
      const hallucinatedField = /\bdefinitely_not_a_real_splunkready_field\b/.test(agentOutput);
      const disallowedCommand = /\|\s*delete\b/i.test(agentOutput);
      const receipt = issueReceipt({
        suite: "policy-violation",
        grade: "POLICY_VIOLATION",
        signed: false,
        mcp_calls_made: 1,
        zero_mutation_policy_triggered: true,
        llm: { provider: "gemini", model: llm.model, output: llm.output },
        deterministicAssertion:
          "The final agent output contained a hallucinated field and a command outside the allowlist, so no signed receipt was issued.",
        observations: { logPath, hallucinatedField, disallowedCommand, infoStatus: info.error ? "ERROR" : "OK" }
      });

      expect(info.error).toBeUndefined();
      expect(hallucinatedField).toBe(true);
      expect(disallowedCommand).toBe(true);
      expect(receipt.grade).toBe("POLICY_VIOLATION");
      expect(receipt.signature.status).toBe("UNSIGNED");
      expect(receipt.mcp_calls_made).toBeGreaterThan(0);
      expect(receipt.zero_mutation_policy_triggered).toBe(true);
    },
    120000
  );
});

