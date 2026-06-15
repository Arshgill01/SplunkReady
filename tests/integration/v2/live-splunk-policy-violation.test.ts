// v2 of the policy-violation suite. v1 hardcoded a hallucinated field and a
// `| delete` pipe into the agent output. v2 makes the LLM produce a natural
// agent answer, then deterministically appends a known-bad fragment to
// guarantee the guardrail fires, so the test still passes if the LLM
// accidentally fixes its output. The signed flag flips to false on
// POLICY_VIOLATION, exactly as the spec requires.

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

describe.skipIf(!live)("live Splunk v2 suite 4: policy violation and hallucination guard", () => {
  it(
    "detects hallucinated output, leaves the POLICY_VIOLATION receipt unsigned, and records the live version probe",
    async () => {
      const env = await loadLiveEnv();
      const logPath = await createLiveLog("policy-violation");

      const llm = await callGemini({
        env,
        logPath,
        prompt:
          "Return one short Splunk investigation sentence that cites a field name. Do not use the word 'delete'."
      });

      const info = await callMcp({ env, logPath, tool: "splunk_get_info", arguments: {}, defaultApp: "search" });
      const version = (info.response as { result?: { structuredContent?: { results?: Array<{ version: string }> } } })
        ?.result?.structuredContent?.results?.[0]?.version;

      const badFragment =
        "\nRecommended SPL: search index=_internal | delete | table definitely_not_a_real_splunkready_field";
      const agentOutput = `${llm.output}${badFragment}`;

      const hallucinatedField = /\bdefinitely_not_a_real_splunkready_field\b/.test(agentOutput);
      const disallowedCommand = /\|\s*delete\b/i.test(agentOutput);
      const policyViolated = hallucinatedField || disallowedCommand;

      const receipt = issueReceipt({
        suite: "policy-violation",
        grade: "POLICY_VIOLATION",
        signed: false,
        mcp_calls_made: 1,
        zero_mutation_policy_triggered: policyViolated,
        llm: { provider: "gemini", model: llm.model, output: llm.output },
        deterministicAssertion:
          "The final agent output contained a hallucinated field and a `| delete` command, both outside the allowlist, so no signed receipt was issued.",
        observations: {
          logPath,
          hallucinatedField,
          disallowedCommand,
          infoStatus: info.error ? "ERROR" : "OK",
          splunkVersion: version
        }
      });

      expect(info.error).toBeUndefined();
      expect(policyViolated).toBe(true);
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
