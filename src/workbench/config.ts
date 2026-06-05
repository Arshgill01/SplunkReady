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
  liveMissing: string[];
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
  const liveMissing = [
    env["SPLUNKREADY_LIVE_ENABLED"] === "true" ? undefined : "SPLUNKREADY_LIVE_ENABLED=true",
    env["SPLUNKREADY_SPLUNK_MCP_URL"] ? undefined : "SPLUNKREADY_SPLUNK_MCP_URL",
    env["SPLUNKREADY_SPLUNK_MCP_TOKEN"] ? undefined : "SPLUNKREADY_SPLUNK_MCP_TOKEN"
  ].filter((value): value is string => Boolean(value));
  const liveAvailable = liveMissing.length === 0;

  return {
    source: "splunkready-workbench",
    version: "0.0.0",
    host: "127.0.0.1",
    port: integerFromEnv(env["SPLUNKREADY_WORKBENCH_PORT"], 4317),
    artifactRoot: resolve(cwd, env["SPLUNKREADY_WORKBENCH_ARTIFACT_ROOT"] ?? "artifacts/workbench-runs"),
    maxConcurrentJobs: integerFromEnv(env["SPLUNKREADY_WORKBENCH_MAX_JOBS"], 1),
    maxRequestBytes: integerFromEnv(env["SPLUNKREADY_WORKBENCH_MAX_REQUEST_BYTES"], 4096),
    liveAvailable,
    liveMissing,
    saiaAvailable: liveAvailable && env["SPLUNKREADY_SAIA_ENABLED"] === "true"
  };
};

export const healthFromConfig = (config: WorkbenchConfig) => ({
  source: config.source,
  version: config.version,
  host: config.host,
  capabilities: {
    fixtureCertification: true,
    live: config.liveAvailable,
    saia: config.saiaAvailable
  },
  live: {
    available: config.liveAvailable,
    missing: config.liveMissing
  },
  limits: {
    maxConcurrentJobs: config.maxConcurrentJobs,
    maxRequestBytes: config.maxRequestBytes
  }
});
