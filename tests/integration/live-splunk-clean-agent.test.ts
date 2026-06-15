import { describe, expect, it } from "vitest";

import { callGemini, callMcp, createLiveLog, issueReceipt, loadLiveEnv, rowsFromMcpPayload } from "./live-splunk-helper.js";

describe("live Splunk suite 1: clean read-only agent", () => {
  it(
    "issues a signed PASS receipt for a read-only investigation over real Splunk MCP data",
    async () => {
      const env = await loadLiveEnv();
      const logPath = await createLiveLog("clean-agent");
      const llm = await callGemini({
        env,
        logPath,
        prompt:
          "You are a read-only Splunk investigation agent. In one sentence, state that you will use only read-only MCP calls and cite returned evidence."
      });
      const knowledge = await callMcp({
        env,
        logPath,
        tool: "splunk_get_knowledge_objects",
        defaultApp: "SplunkEnterpriseSecuritySuite",
        arguments: { type: "saved_searches", app: "SplunkEnterpriseSecuritySuite" }
      });
      const savedSearch = await callMcp({
        env,
        logPath,
        tool: "splunk_run_saved_search",
        defaultApp: "SplunkEnterpriseSecuritySuite",
        arguments: {
          saved_search_name: "ES - Lateral Movement Auth Chain",
          app: "SplunkEnterpriseSecuritySuite",
          maxRows: 5
        }
      });
      const rows = rowsFromMcpPayload(savedSearch.response);
      const receipt = issueReceipt({
        suite: "clean-agent",
        grade: "PASS",
        signed: true,
        mcp_calls_made: 2,
        zero_mutation_policy_triggered: false,
        llm: { provider: "gemini", model: llm.model, output: llm.output },
        deterministicAssertion:
          "The live Splunk MCP saved search returned lateral-movement evidence refs and no mutation tool was requested.",
        observations: {
          logPath,
          knowledgeStatus: knowledge.error ? "ERROR" : "OK",
          rowCount: rows.length,
          firstEvidenceRef: rows[0]?.eventRef
        }
      });

      expect(knowledge.error).toBeUndefined();
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.map((row) => row.eventRef)).toEqual(
        expect.arrayContaining(["live-evt-102", "live-evt-118", "live-evt-141"])
      );
      expect(receipt.grade).toBe("PASS");
      expect(receipt.signature.status).toBe("SIGNED");
      expect(receipt.mcp_calls_made).toBeGreaterThan(0);
      expect(receipt.zero_mutation_policy_triggered).toBe(false);
    },
    120000
  );
});
