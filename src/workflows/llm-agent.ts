import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { createGeminiConfigFromEnv } from "../agents/gemini-model.js";
import { scoreMissionReadiness } from "../grader/scoring.js";
import { generateReadinessReceipt } from "../receipts/generator.js";
import {
  compileCommand,
  createLlmSpecimenAgent,
  createSplunkAccessAdapter,
  gradeTrace,
  loadContract,
  loadMission,
  type CertificationActionOptions
} from "./certification-actions.js";

export interface LlmAgentWorkflowResult {
  artifacts: string[];
}

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const writeText = async (filePath: string, value: string): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, value.endsWith("\n") ? value : `${value}\n`, "utf8");
};

export const runLlmAgentWorkflow = async (
  options: CertificationActionOptions,
  env: NodeJS.ProcessEnv = process.env
): Promise<LlmAgentWorkflowResult> => {
  const geminiConfig = createGeminiConfigFromEnv(env);

  if (!geminiConfig) {
    throw new Error("llm-agent requires GEMINI_API_KEY. No Gemini request was made and no Splunk calls were made.");
  }

  const compileArtifacts = await compileCommand(options, env);
  const adapter = await createSplunkAccessAdapter(options, env);
  const contract = await loadContract(options.out);
  const mission = await loadMission(options.mission);
  const agent = createLlmSpecimenAgent(contract, options, env);
  const run = await agent.run({ mission, adapter });
  const violations = gradeTrace(contract, mission, run.traceEvents);
  const score = scoreMissionReadiness(mission, violations);
  const generated = generateReadinessReceipt({
    id: "receipt-llm-agent-001",
    agent: { name: "Gemini Splunk MCP Agent", version: options.agentModel || geminiConfig.model },
    environment: contract,
    missionSuiteVersion: "security-readiness-llm-1",
    missions: [mission],
    traceEvents: run.traceEvents,
    violations,
    notes:
      "This receipt grades a trace produced by a Gemini-backed specimen agent. The model chooses read-only Splunk tool calls; the deterministic rule engine decides pass/fail."
  });

  await writeJson(join(options.out, "trace-llm-agent.json"), run.traceEvents);
  await writeJson(join(options.out, "llm-agent-observations.json"), run.observations);
  await writeJson(join(options.out, "violations-llm-agent.json"), violations);
  await writeJson(join(options.out, "score-llm-agent.json"), score);
  await writeText(join(options.out, "receipt-llm-agent-001.json"), generated.json);
  await writeText(join(options.out, "receipt-llm-agent-001.md"), generated.markdown);

  return {
    artifacts: [
      ...compileArtifacts,
      join(options.out, "trace-llm-agent.json"),
      join(options.out, "llm-agent-observations.json"),
      join(options.out, "violations-llm-agent.json"),
      join(options.out, "score-llm-agent.json"),
      join(options.out, "receipt-llm-agent-001.json"),
      join(options.out, "receipt-llm-agent-001.md")
    ]
  };
};
