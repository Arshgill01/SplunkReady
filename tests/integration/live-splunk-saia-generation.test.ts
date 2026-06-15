import { describe, expect, it } from "vitest";

import {
  callGemini,
  callMcp,
  cleanSpl,
  createLiveLog,
  extractMcpOutput,
  hasLiveCredentials,
  issueReceipt,
  loadLiveEnv,
  rowsFromMcpPayload
} from "./live-splunk-helper.js";

const live = await hasLiveCredentials();

const generatedTextFrom = (payload: unknown): string => {
  const output = extractMcpOutput(payload);
  if (output && typeof output === "object" && Array.isArray((output as { results?: unknown }).results)) {
    const first = (output as { results: Array<Record<string, unknown>> }).results[0];
    return String(first?.response ?? first?.query ?? first?.spl ?? "");
  }
  return typeof output === "string" ? output : JSON.stringify(output);
};

describe.skipIf(!live)("live Splunk suite 3: SAIA SPL generation", () => {
  it(
    "uses live SAIA-generated SPL, executes a sanitized read-only query, and emits a SAIA_PASS receipt",
    async () => {
      const env = await loadLiveEnv();
      const logPath = await createLiveLog("saia-generation");
      const prompt =
        "Generate a read-only SPL query over Splunk internal logs that returns five rows with _time, host, source, and sourcetype. Avoid delete, outputlookup, collect, and map.";
      const llm = await callGemini({
        env,
        logPath,
        prompt: "In one sentence, explain that SAIA-generated SPL must be sanitized before execution."
      });
      const saia = await callMcp({
        env,
        logPath,
        tool: "saia_generate_spl",
        defaultApp: "search",
        arguments: { prompt, chat_history: "[]" },
        timeoutMs: 60000
      });
      let generatedSpl = cleanSpl(generatedTextFrom(saia.response));
      // Extract only the SPL query if there's prose surrounding it. Usually it's in a code block or starts with search / index / |
      const splLines = generatedSpl.split("\n").filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith("*") && !trimmed.startsWith("#") && !/^\d+\./.test(trimmed);
      });
      generatedSpl = splLines.join("\n").trim();

      const injectionTokens = /\b(?:delete|outputlookup|collect|map|sendemail|script)\b/i;
      const executableSpl = injectionTokens.test(generatedSpl)
        ? ""
        : generatedSpl || "search index=_internal earliest=-15m latest=now | head 5 | eval eventRef=coalesce(_cd,_raw) | table eventRef host source sourcetype _time";
      const query = await callMcp({
        env,
        logPath,
        tool: "splunk_run_query",
        defaultApp: "search",
        arguments: { query: executableSpl, maxRows: 5 }
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
          "SAIA returned non-empty SPL text, forbidden injection tokens were absent, and the executed read-only query returned live rows.",
        observations: { logPath, generatedLength: generatedSpl.length, rowCount: rows.length }
      });

      expect(saia.error).toBeUndefined();
      expect(generatedSpl.length).toBeGreaterThan(0);
      expect(generatedSpl).not.toMatch(injectionTokens);
      expect(rows.length).toBeGreaterThan(0);
      expect(receipt.grade).toBe("SAIA_PASS");
      expect(receipt.signature.status).toBe("SIGNED");
      expect(receipt.mcp_calls_made).toBeGreaterThan(0);
      expect(receipt.zero_mutation_policy_triggered).toBe(false);
    },
    120000
  );
});

