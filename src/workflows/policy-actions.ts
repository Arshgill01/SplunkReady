import {
  defaultFixtureCertificationOptions,
  firewallCheckCommand,
  fixtureCertificationSteps,
  rerunCommand
} from "./certification-actions.js";
import { runFixtureCertification } from "./fixture-certification.js";

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

export const runPolicyBackedRerunWorkflow = async (
  input: PolicyWorkbenchWorkflowInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<PolicyWorkbenchWorkflowResult> => {
  const options = defaultFixtureCertificationOptions(input.outDir);
  const beforeOptions = { ...options, phase: "before" as const, firewall: false };
  const afterOptions = { ...options, phase: "after" as const, firewall: true };
  const steps = fixtureCertificationSteps(beforeOptions, env);
  const workflow = await runFixtureCertification(
    { outDir: input.outDir, includeProofAudit: true },
    {
      ...steps,
      rerun: () => rerunCommand(afterOptions, env)
    }
  );

  return {
    status: "PASS",
    outDir: input.outDir,
    artifacts: workflow.artifacts,
    mutation: false,
    messages: ["Before trace was graded without the firewall; policy-backed rerun used the compiled firewall."]
  };
};

export const runFirewallCheckWorkflow = async (
  input: PolicyWorkbenchWorkflowInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<PolicyWorkbenchWorkflowResult> => {
  const options = defaultFixtureCertificationOptions(input.outDir);
  const artifacts = await firewallCheckCommand(options, env);

  return {
    status: "PASS",
    outDir: input.outDir,
    artifacts,
    mutation: false,
    messages: ["Compiled policy firewall rejected unsafe SPL before Splunk execution."]
  };
};
