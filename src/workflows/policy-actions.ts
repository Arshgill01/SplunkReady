export interface PolicyWorkbenchWorkflowInput {
  outDir: string;
}

export interface PolicyWorkbenchWorkflowResult {
  status: "PASS";
  outDir: string;
  artifacts: string[];
  mutation: false;
  messages: string[];
}

type PolicyActionRunner = (
  input: PolicyWorkbenchWorkflowInput,
  env?: NodeJS.ProcessEnv
) => Promise<PolicyWorkbenchWorkflowResult>;

const loadPolicyAction = async (
  exportName: "runPolicyBackedRerunFromCli" | "runFirewallCheckFromCli"
): Promise<PolicyActionRunner> => {
  const cli = (await import("../cli.js")) as Record<string, unknown>;
  const runner = cli[exportName];

  if (typeof runner !== "function") {
    throw new Error(`CLI policy action ${exportName} is unavailable.`);
  }

  return runner as PolicyActionRunner;
};

export const runPolicyBackedRerunWorkflow = async (
  input: PolicyWorkbenchWorkflowInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<PolicyWorkbenchWorkflowResult> => {
  const runner = await loadPolicyAction("runPolicyBackedRerunFromCli");

  return runner(input, env);
};

export const runFirewallCheckWorkflow = async (
  input: PolicyWorkbenchWorkflowInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<PolicyWorkbenchWorkflowResult> => {
  const runner = await loadPolicyAction("runFirewallCheckFromCli");

  return runner(input, env);
};
