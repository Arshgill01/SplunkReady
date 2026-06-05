export type HostedModelWorkflow = "hosted-model-diagnostic" | "hosted-model-proof";

export interface HostedModelWorkflowInput {
  outDir: string;
}

export interface HostedModelWorkflowResult {
  status: "PASS" | "BLOCKED";
  outDir: string;
  artifacts: string[];
  mutation: false;
  messages: string[];
}

type HostedModelCliRunner = (input: HostedModelWorkflowInput) => Promise<HostedModelWorkflowResult>;

const loadCliRunner = async (exportName: string): Promise<HostedModelCliRunner> => {
  const cli = (await import("../cli.js")) as Record<string, unknown>;
  const runner = cli[exportName];

  if (typeof runner !== "function") {
    throw new Error(`CLI hosted-model action ${exportName} is unavailable.`);
  }

  return runner as HostedModelCliRunner;
};

export const runHostedModelDiagnosticWorkflow = async (
  input: HostedModelWorkflowInput
): Promise<HostedModelWorkflowResult> => {
  const runner = await loadCliRunner("runHostedModelDiagnosticFromCli");

  return runner(input);
};

export const runHostedModelProofWorkflow = async (
  input: HostedModelWorkflowInput
): Promise<HostedModelWorkflowResult> => {
  const runner = await loadCliRunner("runHostedModelProofFromCli");

  return runner(input);
};
