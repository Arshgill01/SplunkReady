# LLM Specimen Agent

SplunkReady can run the bundled specimen as a real LLM-backed Splunk MCP agent. The model is the trace producer. The deterministic rule engine remains the pass/fail authority.

## Enable It

Build first:

```bash
npm run build
```

Export a Gemini key in the local shell:

```bash
export SPLUNKREADY_LLM_ENABLED=true
export GEMINI_API_KEY='<your-gemini-api-key>'
export GEMINI_MODEL='gemini-3.1-flash-lite'
```

`GEMINI_MODEL` is optional. If omitted, SplunkReady defaults to `gemini-3.1-flash-lite`. Tests can override the endpoint with `SPLUNKREADY_GEMINI_ENDPOINT_BASE_URL`; normal operators should leave that unset.

The local Phase Live proof key exposes this model through the Gemini API as `models/gemini-3.1-flash-lite` with `generateContent`, `countTokens`, `createCachedContent`, and `batchGenerateContent` support.

## Fixture Proof Flow

This flow uses the normal fixture adapter and does not require live Splunk credentials:

```bash
rm -rf artifacts/llm-fixture-proof
npm run splunkready -- compile --out artifacts/llm-fixture-proof
SPLUNKREADY_LLM_ENABLED=true npm run splunkready -- evaluate --out artifacts/llm-fixture-proof
npm run splunkready -- receipt --out artifacts/llm-fixture-proof
SPLUNKREADY_LLM_ENABLED=true npm run splunkready -- rerun --out artifacts/llm-fixture-proof
```

Expected artifacts:

- `trace-before.json`: model-produced trace without compiled contract injection.
- `violations-before.json`: deterministic rule violations from the first trace.
- `policy-patch.json` and `policy-patch.md`: patch emitted from the failed receipt.
- `trace-after.json`: model-produced trace with compiled policy/contract context injected.
- `receipt-after-001.json` and `receipt-after-001.md`: deterministic rerun receipt.

## Behavior Contract

- `evaluate` uses `NaiveSpecimenAgent` by default.
- `evaluate` uses `LlmSpecimenAgent` only when `SPLUNKREADY_LLM_ENABLED=true`.
- `rerun` uses `NaiveSpecimenAgent` by default.
- `rerun` uses `LlmSpecimenAgent` only when `SPLUNKREADY_LLM_ENABLED=true`.
- Without policy, the LLM prompt receives only mission and runtime boundary details, not the compiled Splunk contract.
- With policy, the LLM prompt receives the compiled Splunk contract and compiled agent policy.
- The LLM can choose read-only Splunk tool calls, but SplunkReady executes them through the adapter and rejects unsupported, out-of-policy, or over-budget plans.
- The LLM does not grade readiness.
