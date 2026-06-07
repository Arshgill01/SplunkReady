import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";

export interface SplunkAppInstallProofInput {
  outDir: string;
  appPackagePath: string;
  confirmInstall: boolean;
  envFileUsed?: boolean;
  fetch?: typeof fetch;
  generatedAt?: string;
}

export interface SplunkAppInstallProofResult {
  status: "PASS" | "SKIP" | "BLOCKED";
  artifacts: string[];
  messages: string[];
}

interface SplunkAppInstallProof {
  source: "splunkready-operator-live-splunk-app-install-proof";
  status: "PASS" | "SKIP" | "BLOCKED";
  generatedAt: string;
  appId: "SplunkReady";
  mutation: false;
  splunkMutation: "none" | "operator-approved-app-install";
  defaultProofMutation: false;
  operatorApproved: boolean;
  appPackage: {
    path: string;
    fileName: string;
    sha256: string | null;
  };
  config: {
    envFileUsed: boolean;
    managementUrlConfigured: boolean;
    managementUrlDerivedFromMcpUrl: boolean;
    usernameConfigured: boolean;
    passwordConfigured: boolean;
    tokenConfigured: boolean;
    missing: string[];
  };
  install: {
    attempted: boolean;
    status: "SKIP" | "PASS" | "BLOCKED";
    statusCode: number | null;
    restartRequired: boolean;
    detail: string;
  };
  probes: Array<{
    id: string;
    method: "GET";
    path: string;
    status: "PASS" | "BLOCKED";
    statusCode: number | null;
  }>;
  redaction: {
    secretValuesWritten: false;
    endpointValueWritten: false;
    usernameValueWritten: false;
  };
}

const source = "splunkready-operator-live-splunk-app-install-proof" as const;
const appId = "SplunkReady" as const;
const defaultGeneratedAt = "2026-06-01T06:45:00.000Z";

const managementUrlEnvNames = [
  "SPLUNKREADY_SPLUNK_MANAGEMENT_URL",
  "SPLUNKREADY_SPLUNKD_URL",
  "SPLUNK_MANAGEMENT_URL",
  "SPLUNKD_URL"
];
const mcpUrlEnvNames = ["SPLUNKREADY_SPLUNK_MCP_URL", "SPLUNK_MCP_URL"];
const usernameEnvNames = ["SPLUNKREADY_SPLUNK_USERNAME", "SPLUNK_USERNAME"];
const passwordEnvNames = ["SPLUNKREADY_SPLUNK_PASSWORD", "SPLUNK_PASSWORD"];
const tokenEnvNames = ["SPLUNKREADY_SPLUNK_SESSION_TOKEN", "SPLUNK_SESSION_TOKEN"];

const firstEnvValue = (env: NodeJS.ProcessEnv, names: string[]): string | undefined =>
  names.map((name) => env[name]?.trim()).find((value): value is string => Boolean(value));

const deriveManagementUrlFromMcpUrl = (env: NodeJS.ProcessEnv): string | undefined => {
  const rawUrl = firstEnvValue(env, mcpUrlEnvNames);

  if (!rawUrl) {
    return undefined;
  }

  try {
    const parsed = new URL(rawUrl);
    return parsed.origin;
  } catch {
    return undefined;
  }
};

const normalizeBaseUrl = (rawUrl: string): string => rawUrl.replace(/\/+$/, "");

const authHeaderFromEnv = (env: NodeJS.ProcessEnv): { header?: string; usernameConfigured: boolean; passwordConfigured: boolean; tokenConfigured: boolean } => {
  const token = firstEnvValue(env, tokenEnvNames);
  const username = firstEnvValue(env, usernameEnvNames);
  const password = firstEnvValue(env, passwordEnvNames);

  if (token) {
    return {
      header: `Splunk ${token}`,
      usernameConfigured: Boolean(username),
      passwordConfigured: Boolean(password),
      tokenConfigured: true
    };
  }

  if (username && password) {
    return {
      header: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
      usernameConfigured: true,
      passwordConfigured: true,
      tokenConfigured: false
    };
  }

  return {
    usernameConfigured: Boolean(username),
    passwordConfigured: Boolean(password),
    tokenConfigured: false
  };
};

const sha256File = async (path: string): Promise<string | null> => {
  try {
    const buffer = await readFile(path);
    return createHash("sha256").update(buffer).digest("hex");
  } catch {
    return null;
  }
};

const publicSafePath = (path: string): string => {
  const resolved = resolve(path);
  const relativePath = relative(process.cwd(), resolved);

  if (!relativePath.startsWith("..") && !relativePath.startsWith("/")) {
    return relativePath;
  }

  return basename(path);
};

const writeProof = async (outDir: string, proof: SplunkAppInstallProof): Promise<string[]> => {
  await mkdir(outDir, { recursive: true });
  const jsonPath = join(outDir, "splunk-app-install-proof.json");
  const markdownPath = join(outDir, "splunk-app-install-proof.md");
  await writeFile(jsonPath, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
  await writeFile(
    markdownPath,
    [
      "# Splunk App Install Proof",
      "",
      `Status: ${proof.status}`,
      `Operator approved: ${proof.operatorApproved}`,
      `Install attempted: ${proof.install.attempted}`,
      `Install result: ${proof.install.status}`,
      `Probe pass count: ${proof.probes.filter((probe) => probe.status === "PASS").length}/${proof.probes.length}`,
      "",
      "No endpoint, username, password, token, or deployment inventory values are written by this artifact."
    ].join("\n"),
    "utf8"
  );
  return [jsonPath, markdownPath];
};

const proofBase = async (
  input: SplunkAppInstallProofInput,
  env: NodeJS.ProcessEnv
): Promise<Omit<SplunkAppInstallProof, "status" | "install" | "probes">> => {
  const managementUrl = firstEnvValue(env, managementUrlEnvNames);
  const derivedManagementUrl = managementUrl ? undefined : deriveManagementUrlFromMcpUrl(env);
  const auth = authHeaderFromEnv(env);
  const missing: string[] = [];

  if (!input.confirmInstall) {
    missing.push("--confirm-install true");
  }

  if (!managementUrl && !derivedManagementUrl) {
    missing.push(`${managementUrlEnvNames[0]} or ${mcpUrlEnvNames[0]}`);
  }

  if (!auth.header) {
    missing.push(`${tokenEnvNames[0]} or ${usernameEnvNames[0]} + ${passwordEnvNames[0]}`);
  }

  return {
    source,
    generatedAt: input.generatedAt ?? defaultGeneratedAt,
    appId,
    mutation: false,
    splunkMutation: input.confirmInstall ? "operator-approved-app-install" : "none",
    defaultProofMutation: false,
    operatorApproved: input.confirmInstall,
    appPackage: {
      path: publicSafePath(input.appPackagePath),
      fileName: basename(input.appPackagePath),
      sha256: await sha256File(resolve(input.appPackagePath))
    },
    config: {
      envFileUsed: Boolean(input.envFileUsed),
      managementUrlConfigured: Boolean(managementUrl || derivedManagementUrl),
      managementUrlDerivedFromMcpUrl: Boolean(!managementUrl && derivedManagementUrl),
      usernameConfigured: auth.usernameConfigured,
      passwordConfigured: auth.passwordConfigured,
      tokenConfigured: auth.tokenConfigured,
      missing
    },
    redaction: {
      secretValuesWritten: false,
      endpointValueWritten: false,
      usernameValueWritten: false
    }
  };
};

const requestSplunk = async (
  input: {
    baseUrl: string;
    path: string;
    method: "GET" | "POST";
    authHeader: string;
    body?: URLSearchParams;
    fetchImpl: typeof fetch;
  }
): Promise<Response> => {
  return input.fetchImpl(`${input.baseUrl}${input.path}`, {
    method: input.method,
    headers: {
      Authorization: input.authHeader,
      ...(input.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {})
    },
    body: input.body
  });
};

const probePaths = [
  { id: "app-metadata", path: `/services/apps/local/${appId}?output_mode=json` },
  { id: "launcher-view", path: `/servicesNS/nobody/${appId}/data/ui/views/splunkready?output_mode=json` },
  { id: "overview-view", path: `/servicesNS/nobody/${appId}/data/ui/views/splunkready_overview?output_mode=json` },
  { id: "default-nav", path: `/servicesNS/nobody/${appId}/data/ui/nav/default?output_mode=json` },
  { id: "receipt-collection", path: `/servicesNS/nobody/${appId}/storage/collections/config/splunkready_receipts?output_mode=json` },
  { id: "receipt-lookup", path: `/servicesNS/nobody/${appId}/data/transforms/lookups/splunkready_receipts_lookup?output_mode=json` }
];

export const runSplunkAppInstallProofWorkflow = async (
  input: SplunkAppInstallProofInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<SplunkAppInstallProofResult> => {
  const outDir = input.outDir || "submission-evidence/splunk-app-install";
  const appPackagePath = resolve(input.appPackagePath);
  const base = await proofBase(input, env);
  const managementUrl = firstEnvValue(env, managementUrlEnvNames) ?? deriveManagementUrlFromMcpUrl(env);
  const auth = authHeaderFromEnv(env);

  if (base.config.missing.length > 0 || !managementUrl || !auth.header) {
    const proof: SplunkAppInstallProof = {
      ...base,
      status: "SKIP",
      install: {
        attempted: false,
        status: "SKIP",
        statusCode: null,
        restartRequired: false,
        detail: "Operator confirmation or live Splunk management credentials were not configured. No live Splunk call was made."
      },
      probes: []
    };
    const artifacts = await writeProof(outDir, proof);
    return {
      status: "SKIP",
      artifacts,
      messages: ["SKIP splunk-app-install-proof: missing operator confirmation or live management configuration."]
    };
  }

  const fetchImpl = input.fetch ?? fetch;
  const baseUrl = normalizeBaseUrl(managementUrl);
  const body = new URLSearchParams({
    name: appPackagePath,
    filename: "true",
    update: "true",
    output_mode: "json"
  });
  const installResponse = await requestSplunk({
    baseUrl,
    path: "/services/apps/local",
    method: "POST",
    authHeader: auth.header,
    body,
    fetchImpl
  });
  const installBody = await installResponse.text();
  const restartRequired = /restart/i.test(installBody);
  const installPassed = installResponse.ok;
  const probes = [];

  if (installPassed) {
    for (const probe of probePaths) {
      const response = await requestSplunk({
        baseUrl,
        path: probe.path,
        method: "GET",
        authHeader: auth.header,
        fetchImpl
      });
      probes.push({
        id: probe.id,
        method: "GET" as const,
        path: probe.path.replace(/\?.*$/, ""),
        status: response.ok ? ("PASS" as const) : ("BLOCKED" as const),
        statusCode: response.status
      });
    }
  }

  const status = installPassed && probes.length === probePaths.length && probes.every((probe) => probe.status === "PASS") ? "PASS" : "BLOCKED";
  const proof: SplunkAppInstallProof = {
    ...base,
    status,
    install: {
      attempted: true,
      status: installPassed ? "PASS" : "BLOCKED",
      statusCode: installResponse.status,
      restartRequired,
      detail: installPassed
        ? "Splunk app install or upgrade request returned success."
        : "Splunk app install or upgrade request did not return success. Inspect the local operator terminal output; this public artifact redacts response bodies."
    },
    probes
  };
  const artifacts = await writeProof(outDir, proof);

  return {
    status,
    artifacts,
    messages: [
      status === "PASS"
        ? "PASS splunk-app-install-proof: app install/probe succeeded."
        : "BLOCKED splunk-app-install-proof: install or post-install probe did not pass."
    ]
  };
};
