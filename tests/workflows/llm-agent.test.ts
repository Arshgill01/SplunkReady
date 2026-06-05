import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { runLlmAgentWorkflow } from "../../src/workflows/llm-agent.js";

const workflowOptions = {
  mode: "fixture" as const,
  fixture: "fixtures/acme-soc-dev/adapter-fixture.json",
  mission: "fixtures/acme-soc-dev/missions/security-investigation-readiness.json",
  out: "artifacts/test-llm-agent",
  phase: "before" as const,
  firewall: false,
  agentModel: ""
};

describe("LLM agent workflow", () => {
  it("fails closed before model or Splunk calls when Gemini credentials are missing", async () => {
    await expect(runLlmAgentWorkflow(workflowOptions, {})).rejects.toThrow(
      "llm-agent requires GEMINI_API_KEY. No Gemini request was made and no Splunk calls were made."
    );
  });

  it("keeps LLM agent workflow source independent from the CLI module", async () => {
    const source = await readFile(new URL("../../src/workflows/llm-agent.ts", import.meta.url), "utf8");

    expect(source).not.toContain("../cli.js");
  });
});
