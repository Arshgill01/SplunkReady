export type PrGateSummary = {
  source: string;
  status: string;
  generatedAt: string;
  proofDir: string;
  mode: string;
  mutation: false;
  proofLoop: string;
  failToPass: boolean;
  before: {
    verdict: string;
    score: number;
    violations: number;
  };
  after: {
    verdict: string;
    score: number;
    violations: number;
  };
  audit: {
    status: string;
    readyAfterPatch?: boolean;
    failToPass?: boolean;
    checkCount: number;
  };
  policy: {
    patchId: string;
    ruleCount: number;
    violationRefs: number;
  };
  hostedModels: {
    status: string;
    advisoryOnly: true;
    assistanceItems: number;
  };
  artifacts: Record<string, string>;
};

export function buildPrGateSummary(input: { proofDir: string; repoRoot?: string; generatedAt?: string }): Promise<PrGateSummary>;
export function renderPrGateComment(summary: PrGateSummary): string;
export function writePrGateComment(input: {
  proofDir: string;
  outPath: string;
  jsonOutPath: string;
  repoRoot?: string;
}): Promise<{ summary: PrGateSummary; comment: string; markdownPath: string; jsonPath: string }>;
