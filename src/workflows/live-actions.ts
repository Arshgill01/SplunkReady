export type LiveActionWorkflow = "live-smoke" | "live-candidates" | "live-security-readiness" | "live-security-proof";

export interface LiveActionWorkflowInput {
  outDir: string;
}

export interface LiveActionWorkflowResult {
  status: "PASS" | "SKIP";
  outDir: string;
  artifacts: string[];
  mutation: false;
  messages: string[];
}

type CliLiveAction = (
  input: LiveActionWorkflowInput,
  env?: NodeJS.ProcessEnv
) => Promise<LiveActionWorkflowResult>;

const runCliLiveAction = async (
  exportName: "runLiveSmokeFromCli" | "runLiveCandidatesFromCli" | "runLiveSecurityReadinessFromCli" | "runLiveSecurityProofFromCli",
  input: LiveActionWorkflowInput,
  env: NodeJS.ProcessEnv
): Promise<LiveActionWorkflowResult> => {
  const cli = (await import("../cli.js")) as Record<string, unknown>;
  const action = cli[exportName] as CliLiveAction | undefined;

  if (!action) {
    throw new Error(`CLI live action ${exportName} is unavailable.`);
  }

  return action(input, env);
};

export const runLiveSmokeWorkflow = (
  input: LiveActionWorkflowInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<LiveActionWorkflowResult> => runCliLiveAction("runLiveSmokeFromCli", input, env);

export const runLiveCandidatesWorkflow = (
  input: LiveActionWorkflowInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<LiveActionWorkflowResult> => runCliLiveAction("runLiveCandidatesFromCli", input, env);

export const runLiveSecurityReadinessWorkflow = (
  input: LiveActionWorkflowInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<LiveActionWorkflowResult> => runCliLiveAction("runLiveSecurityReadinessFromCli", input, env);

export const runLiveSecurityProofWorkflow = (
  input: LiveActionWorkflowInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<LiveActionWorkflowResult> => runCliLiveAction("runLiveSecurityProofFromCli", input, env);
