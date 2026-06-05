export interface ManifestVerificationWorkflowInput {
  outDir: string;
}

export interface ManifestVerificationWorkflowResult {
  status: "PASS" | "FAIL";
  outDir: string;
  artifacts: string[];
  mutation: false;
  report: unknown;
}

type ManifestVerificationRunner = (
  input: ManifestVerificationWorkflowInput
) => Promise<ManifestVerificationWorkflowResult>;

const loadManifestVerificationRunner = async (): Promise<ManifestVerificationRunner> => {
  const cli = (await import("../cli.js")) as Record<string, unknown>;
  const runner = cli.runVerifyManifestFromCli;

  if (typeof runner !== "function") {
    throw new Error("CLI manifest verification action is unavailable.");
  }

  return runner as ManifestVerificationRunner;
};

export const runManifestVerificationWorkflow = async (
  input: ManifestVerificationWorkflowInput
): Promise<ManifestVerificationWorkflowResult> => {
  const runner = await loadManifestVerificationRunner();

  return runner(input);
};
