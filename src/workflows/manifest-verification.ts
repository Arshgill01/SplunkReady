import { verifyProofManifest, type ProofManifestVerification } from "./proof-manifest.js";

export interface ManifestVerificationWorkflowInput {
  outDir: string;
  generatedAt?: string;
}

export interface ManifestVerificationWorkflowResult {
  status: "PASS" | "FAIL";
  outDir: string;
  artifacts: string[];
  mutation: false;
  report: ProofManifestVerification;
}

const defaultGeneratedAt = "2026-06-01T06:45:00.000Z";

export const runManifestVerificationWorkflow = async (
  input: ManifestVerificationWorkflowInput
): Promise<ManifestVerificationWorkflowResult> => {
  const { report, reportPath } = await verifyProofManifest({
    outDir: input.outDir,
    generatedAt: input.generatedAt ?? defaultGeneratedAt
  });

  return { status: report.status, outDir: input.outDir, artifacts: [reportPath], mutation: false, report };
};
