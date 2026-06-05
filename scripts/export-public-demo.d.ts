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

export function exportPublicDemo(input?: {
  root?: string;
  outDir?: string;
  generatedAt?: string;
}): Promise<PublicDemoExportResult>;
