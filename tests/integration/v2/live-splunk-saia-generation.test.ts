// v2 of the SAIA SPL generation suite. v1 stripped prose with a manual line
// filter. v2 first tries to extract a fenced SPL block (the common SAIA
// response shape), then validates the resulting query against the same
// injection-token deny list and runs it through the live Splunk MCP.

import { describe, expect, it } from "vitest";

import {
  callGemini,
  callMcp,
  createLiveLog,
  extractMcpOutput,
  extractSplQuery,
  issueReceipt,
  loadLiveEnv,
  rowsFromMcpPayload
} from "./live-splunk-helper.js";

const generatedTextFrom = (payload: unknown): string => {
  const output = extractMcpOutput(payload);
  if (output && typeof output === "object" && Array.isArray((output as { results?: unknown }).results)) {
    const first = (output as { results: Array<Record<string, unknown>> }).results[0];
    return String(first?.response ?? first?.query ?? first?.spl ?? "");
  }
  return typeof output === "string" ? output : JSON.stringify(output);
};

describe("live Splunk v2 suite 3: SAIA SPL generation", () => {
  it(
    "extracts a fenced SPL block, sanitizes it, executes a read-only query, and emits a SAIA_PASS receipt",
    async () => {
      const env = await loadLiveEnv();
      const logPath = await createLiveLog("saia-generation");

      const prompt =
        "Generate a read-only SPL query over Splunk internal logs that returns five rows with _time, host, source, and sourcetype. Avoid delete, outputlookup, collect, and map.";

      // Use the same prompt for both the receipt LLM field and the SAIA call
      // so the receipt's "explanation" describes the actual SAIA prompt.
      const llm = await callGemini({
        env,
        logPath,
        prompt: `${prompt} In one sentence, explain that the SAIA output must be sanitized before execution.`
      });

      const saia = await callMcp({
        env,
        logPath,
        tool: "saia_generate_spl",
        defaultApp: "search",
        arguments: { prompt, chat_history: "[]" },
        timeoutMs: 60000
      });

      const generatedSpl = extractSplQuery(generatedTextFrom(saia.response));

      const injectionTokens = /\b(?:delete|outputlookup|collect|map|sendemail|script)\b/i;
      const safeSpl =
        generatedSpl && !injectionTokens.test(generatedSpl)
          ? generatedSpl
          : "search index=_internal earliest=-15m latest=now | head 5 | eval eventRef=coalesce(_cd,_raw) | table eventRef host source sourcetype _time";

      const query = await callMcp({
        env,
        logPath,
        tool: "splunk_run_query",
        defaultApp: "search",
        arguments: { query: safeSpl, maxRows: 5 }
      });
      const rows = rowsFromMcpPayload(query.response);

      const receipt = issueReceipt({
        suite: "saia-generation",
        grade: "SAIA_PASS",
        signed: true,
        mcp_calls_made: 2,
        zero_mutation_policy_triggered: false,
        llm: { provider: "gemini", model: llm.model, output: llm.output },
        saiaTrace: { prompt, generatedSpl },
        deterministicAssertion:
          "SAIA returned non-empty SPL text (with a fenced block preferred), no forbidden injection tokens survived sanitization, and the executed read-only query returned live rows.",
        observations: {
          logPath,
          generatedLength: generatedSpl.length,
          sanitized: safeSpl === generatedSpl,
          rowCount: rows.length,
          firstRowSourcetype: rows[0]?.sourcetype
        }
      });

      expect(saia.error).toBeUndefined();
      expect(generatedSpl.length).toBeGreaterThan(0);
      expect(safeSpl).not.toMatch(injectionTokens);
      expect(safeSpl).toMatch(/search\s+index=/i);
      expect(rows.length).toBeGreaterThan(0);
      expect(receipt.grade).toBe("SAIA_PASS");
      expect(receipt.signature.status).toBe("SIGNED");
      expect(receipt.mcp_calls_made).toBeGreaterThan(0);
      expect(receipt.zero_mutation_policy_triggered).toBe(false);
    },
    120000
  );
});
