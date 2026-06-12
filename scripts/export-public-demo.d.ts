export interface PublicDemoExportResult {
  outDir: string;
  manifest: {
    source: "splunkready-public-demo-export";
    generatedAt: string;
    sourceCommit: string;
    sourceCommitShort: string;
    deploymentCommit: string;
    deploymentCommitShort: string;
    mutation: false;
    defaultUrl: string;
    interactiveUrl: string;
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

export type PublicDemoPlatformProofGenerator = (input: {
  root: string;
  outDir: string;
}) => Promise<void>;

export const publicDemoInputPaths: string[];

export function exportPublicDemo(input?: {
  root?: string;
  outDir?: string;
  generatedAt?: string;
  generateJudgeProof?: PublicDemoJudgeProofGenerator;
  generatePlatformProof?: PublicDemoPlatformProofGenerator;
  sourceCommit?: string;
  deploymentCommit?: string;
}): Promise<PublicDemoExportResult>;
