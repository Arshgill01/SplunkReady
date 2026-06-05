import type { CliOptions } from "./options.js";
import { fixtureCertificationSteps } from "../workflows/certification-actions.js";
import {
  runGradeExternalTraceWorkflow,
  runImportMcpTranscriptWorkflow,
  runMcpTranscriptCertificationFromPathWorkflow
} from "../workflows/external-certification.js";
import { runFixtureCertification } from "../workflows/fixture-certification.js";
import { runLlmAgentWorkflow } from "../workflows/llm-agent.js";

export const gradeTraceCommand = async (options: CliOptions): Promise<string[]> => {
  const { artifacts } = await runGradeExternalTraceWorkflow({
    outDir: options.out,
    tracePath: options.trace,
    missionPath: options.mission,
    agentName: options.agentName,
    agentVersion: options.agentVersion
  });

  return artifacts;
};

export const importMcpTranscriptCommand = async (options: CliOptions): Promise<string[]> => {
  const { artifacts } = await runImportMcpTranscriptWorkflow({
    outDir: options.out,
    transcriptPath: options.transcript,
    missionPath: options.mission,
    strictImport: options.strictImport,
    agentName: options.agentName,
    agentVersion: options.agentVersion
  });

  return artifacts;
};

export const certifyMcpTranscriptCommand = async (options: CliOptions): Promise<string[]> => {
  const { artifacts } = await runMcpTranscriptCertificationFromPathWorkflow({
    outDir: options.out,
    transcriptPath: options.transcript,
    fixturePath: options.fixture,
    missionPath: options.mission,
    strictImport: options.strictImport,
    requirePass: options.requirePass,
    agentName: options.agentName,
    agentVersion: options.agentVersion
  });

  return artifacts;
};

export const llmAgentCommand = async (
  options: CliOptions,
  env: NodeJS.ProcessEnv = process.env
): Promise<string[]> => {
  const { artifacts } = await runLlmAgentWorkflow(options, env);

  return artifacts;
};

export const demoCommand = async (
  options: CliOptions,
  env: NodeJS.ProcessEnv = process.env
): Promise<string[]> => {
  const workflow = await runFixtureCertification(
    { outDir: options.out, includeProofAudit: false },
    fixtureCertificationSteps(options, env)
  );

  return workflow.artifacts;
};
