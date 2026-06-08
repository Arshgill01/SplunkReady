export type SplunkAppWebProofOptions = {
  envFile: string;
  outDir: string;
  screenshotPath: string;
  confirmBrowser: boolean;
  headed: boolean;
  json: boolean;
  help: boolean;
};

export type SplunkAppWebProofResult = {
  status: "PASS" | "BLOCKED" | "SKIP";
  artifacts: string[];
  proof: Record<string, unknown>;
};

export function parseArgs(argv: string[]): SplunkAppWebProofOptions;
export function parseEnvFileContent(content: string): Record<string, string>;
export function deriveSplunkWebUrl(env: Record<string, string | undefined>): {
  url?: string;
  source: "explicit-web-url" | "derived-from-mcp-url" | "missing" | "invalid-mcp-url";
};
export function runSplunkAppWebProof(
  options: SplunkAppWebProofOptions,
  env?: Record<string, string | undefined>
): Promise<SplunkAppWebProofResult>;
