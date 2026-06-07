export interface SplunkAppPackageManifest {
  source: "splunkready-splunk-app-package";
  status: "PASS";
  generatedAt: string;
  appId: string;
  version: string;
  mutation: false;
  packagePath: string;
  packageSha256: string;
  staticSource: string;
  launcherView: string;
  staticEntry: string;
  publicDemoManifest: string;
  fileCount: number;
  files: string[];
  officialSplunkPackagingReferences: string[];
  noCredentialFiles: true;
  noPythonHandlers: true;
  noScriptedInputs: true;
}

export function buildSplunkAppPackage(options?: {
  root?: string;
  outDir?: string;
  sourceDir?: string;
  generatedAt?: string;
}): Promise<SplunkAppPackageManifest>;
