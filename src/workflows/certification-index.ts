export interface CertificationIndexWorkflowInput {
  outDir: string;
  proofDirs: string[];
  proofArtifactBases?: string[];
  indexArtifactBase?: string;
}

export interface CertificationIndexWorkflowResult {
  status: "PASS" | "WARN" | "FAIL";
  outDir: string;
  artifacts: string[];
  mutation: boolean;
  messages: string[];
}

type CertificationIndexRunner = (
  input: CertificationIndexWorkflowInput
) => Promise<CertificationIndexWorkflowResult>;

const loadCertificationIndexRunner = async (): Promise<CertificationIndexRunner> => {
  const cli = (await import("../cli.js")) as Record<string, unknown>;
  const runner = cli.runCertificationIndexFromCli;

  if (typeof runner !== "function") {
    throw new Error("CLI certification index action is unavailable.");
  }

  return runner as CertificationIndexRunner;
};

export const runCertificationIndexWorkflow = async (
  input: CertificationIndexWorkflowInput
): Promise<CertificationIndexWorkflowResult> => {
  const runner = await loadCertificationIndexRunner();

  return runner(input);
};
