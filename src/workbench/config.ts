import { resolve } from "node:path";

export interface WorkbenchConfig {
  source: "splunkready-workbench";
  version: string;
  host: "127.0.0.1";
  port: number;
  artifactRoot: string;
  maxConcurrentJobs: number;
  maxRequestBytes: number;
  liveAvailable: boolean;
  saiaAvailable: boolean;
}

const integerFromEnv = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const createWorkbenchConfig = (
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd()
): WorkbenchConfig => {
  const liveAvailable =
    env["SPLUNKREADY_LIVE_ENABLED"] === "true" &&
    Boolean(env["SPLUNKREADY_SPLUNK_MCP_URL"]) &&
    Boolean(env["SPLUNKREADY_SPLUNK_MCP_TOKEN"]);

  return {
    source: "splunkready-workbench",
    version: "0.0.0",
    host: "127.0.0.1",
    port: integerFromEnv(env["SPLUNKREADY_WORKBENCH_PORT"], 4317),
    artifactRoot: resolve(cwd, env["SPLUNKREADY_WORKBENCH_ARTIFACT_ROOT"] ?? "artifacts/workbench-runs"),
    maxConcurrentJobs: integerFromEnv(env["SPLUNKREADY_WORKBENCH_MAX_JOBS"], 1),
    maxRequestBytes: integerFromEnv(env["SPLUNKREADY_WORKBENCH_MAX_REQUEST_BYTES"], 4096),
    liveAvailable,
    saiaAvailable: liveAvailable && env["SPLUNKREADY_SAIA_ENABLED"] === "true"
  };
};

export const healthFromConfig = (config: WorkbenchConfig) => ({
  source: config.source,
  version: config.version,
  host: config.host,
  artifactRoot: config.artifactRoot,
  capabilities: {
    fixtureCertification: true,
    live: config.liveAvailable,
    saia: config.saiaAvailable
  },
  limits: {
    maxConcurrentJobs: config.maxConcurrentJobs,
    maxRequestBytes: config.maxRequestBytes
  }
});
