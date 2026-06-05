import type { CliOptions } from "./options.js";
import type {
  LiveActionWorkflowInput,
  LiveActionWorkflowResult
} from "../workflows/live-actions.js";
import {
  runLiveCandidatesWorkflow,
  runLiveProofWorkflow,
  runLiveSecurityKitWorkflow,
  runLiveSecurityProofArtifacts,
  runLiveSecurityProofWorkflow,
  runLiveSecurityReadinessWorkflow,
  runLiveSecurityUiBundleWorkflow,
  runLiveSmokeWorkflow
} from "../workflows/live-actions.js";

export const liveSmokeCommand = async (options: CliOptions): Promise<LiveActionWorkflowResult> => {
  return runLiveSmokeWorkflow({
    outDir: options.out,
    fixturePath: options.fixture,
    missionPath: options.mission,
    requireLive: options.requireLive
  });
};

export const liveCandidatesCommand = async (options: CliOptions): Promise<string[]> => {
  return (
    await runLiveCandidatesWorkflow({
      outDir: options.out,
      fixturePath: options.fixture,
      missionPath: options.mission,
      candidateLimit: options.candidateLimit,
      compileFirst: false,
      firewall: options.firewall,
      agentModel: options.agentModel
    })
  ).artifacts;
};

export const liveSecurityCheckCommand = async (options: CliOptions): Promise<string[]> => {
  return (
    await runLiveSecurityReadinessWorkflow({
      outDir: options.out,
      fixturePath: options.fixture,
      missionPath: options.mission,
      firewall: options.firewall,
      agentModel: options.agentModel
    })
  ).artifacts;
};

export const liveSecurityKitCommand = async (options: CliOptions): Promise<string[]> => {
  return (await runLiveSecurityKitWorkflow({ outDir: options.out })).artifacts;
};

export const liveSecurityProofCommand = async (options: CliOptions): Promise<string[]> => {
  return runLiveSecurityProofArtifacts({
    outDir: options.out,
    fixturePath: options.fixture,
    missionPath: options.mission,
    firewall: options.firewall,
    agentModel: options.agentModel,
    requirePass: options.requirePass
  });
};

export const liveSecurityUiBundleCommand = async (options: CliOptions): Promise<string[]> => {
  return (
    await runLiveSecurityUiBundleWorkflow({
      outDir: options.out,
      proofDir: options.proofDir,
      securityCheckDir: options.securityCheckDir,
      securityKitDir: options.securityKitDir,
      hostedModelProofDir: options.hostedModelProofDir
    })
  ).artifacts;
};

export const liveProofCommand = async (options: CliOptions): Promise<string[]> => {
  return (
    await runLiveProofWorkflow({
      outDir: options.out,
      fixturePath: options.fixture,
      missionPath: options.mission,
      candidateLimit: options.candidateLimit,
      firewall: options.firewall,
      agentModel: options.agentModel,
      requirePass: options.requirePass
    })
  ).artifacts;
};

export const runLiveSmokeFromCli = async (
  input: LiveActionWorkflowInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<LiveActionWorkflowResult> => {
  return runLiveSmokeWorkflow({ ...input, requireLive: input.requireLive ?? true }, env);
};

export const runLiveCandidatesFromCli = async (
  input: LiveActionWorkflowInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<LiveActionWorkflowResult> => {
  return runLiveCandidatesWorkflow({ ...input, compileFirst: input.compileFirst ?? true }, env);
};

export const runLiveSecurityReadinessFromCli = async (
  input: LiveActionWorkflowInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<LiveActionWorkflowResult> => {
  return runLiveSecurityReadinessWorkflow(input, env);
};

export const runLiveSecurityKitFromCli = async (
  input: LiveActionWorkflowInput
): Promise<LiveActionWorkflowResult> => {
  return runLiveSecurityKitWorkflow(input);
};

export const runLiveSecurityProofFromCli = async (
  input: LiveActionWorkflowInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<LiveActionWorkflowResult> => {
  return runLiveSecurityProofWorkflow({ ...input, requirePass: input.requirePass ?? true }, env);
};
