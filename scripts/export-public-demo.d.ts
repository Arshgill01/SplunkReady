export interface PublicDemoExportResult {
  outDir: string;
  manifest: {
    source: "splunkready-public-demo-export";
    generatedAt: string;
    mutation: false;
    defaultUrl: string;
    artifactBases: string[];
    screenshots: string;
    notes: string;
  };
  copiedArtifactBases: string[];
}

export type PublicDemoJudgeProofGenerator = (input: {
  repoRoot: string;
  targetArtifactDir: string;
}) => Promise<void>;

export function exportPublicDemo(input?: {
  root?: string;
  outDir?: string;
  generatedAt?: string;
  generateJudgeProof?: PublicDemoJudgeProofGenerator;
}): Promise<PublicDemoExportResult>;
