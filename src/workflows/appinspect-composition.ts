import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";

type AppInspectCompositionStatus = "NOT_REQUESTED" | "PASS" | "BLOCKED" | "ERROR";
type AppInspectValidationStatus = "NOT_RUN" | "SUCCESS" | "EXCEPTION" | "ERROR";

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: string | number | null;
  result?: Record<string, unknown>;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface PendingRequest {
  resolve: (response: JsonRpcResponse) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

export interface AppInspectCompositionSummary {
  source: "splunkready-appinspect-mcp-composition";
  status: AppInspectCompositionStatus;
  generatedAt: string;
  artifactPath: string;
  markdownPath: string;
  appPackagePath: string;
  appPackagePresent: boolean;
  command: "uvx splunk-appinspect[mcp] mcp-server";
  server: {
    status: "NOT_REQUESTED" | "AVAILABLE" | "UNAVAILABLE";
    name: string;
    version: string;
    tools: string[];
    blockedReason: string;
  };
  validation: {
    status: AppInspectValidationStatus;
    toolStatus: string;
    summary: Record<string, number>;
    failureCount: number;
    errorCount: number;
    warningCount: number;
    validationGroupCount: number;
    nextSteps: string[];
    logsPreview: string;
    publicSafe: true;
  };
  composition: {
    servers: Array<{
      name: "splunk" | "appinspect" | "splunkready";
      role: string;
      authority: string;
    }>;
    deterministicReceiptAuthority: "splunkready";
    appInspectAuthority: "advisory-static-validation";
  };
  deterministicAuthority: true;
  mutation: false;
}

const generatedAt = "2026-06-01T06:45:00.000Z";
const commandLabel = "uvx splunk-appinspect[mcp] mcp-server" as const;
const requestTimeoutMs = 120_000;
const localPathPattern = /(?:\/Users\/|\/private\/|\/tmp\/|~\/)[^\s"',}]*/g;
const endpointPattern = /\bhttps?:\/\/[^\s"',}]+/g;
const bearerPattern = /Bearer\s+[A-Za-z0-9._~+/=-]+/g;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const displayPath = (path: string): string => {
  const relativePath = relative(process.cwd(), path);
  return relativePath.startsWith("..") ? basename(path) : relativePath;
};

const redactText = (text: string): string =>
  text
    .replace(bearerPattern, "Bearer <redacted-token>")
    .replace(endpointPattern, "<redacted-endpoint>")
    .replace(localPathPattern, "<redacted-local-path>");

const numberSummaryFrom = (value: unknown): Record<string, number> => {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]))
      .sort(([left], [right]) => left.localeCompare(right))
  );
};

export const summarizeAppInspectToolResult = (value: unknown): AppInspectCompositionSummary["validation"] => {
  const result = isRecord(value) ? value : {};
  const summary = numberSummaryFrom(result.summary);
  const validationResults = isRecord(result.validation_results) ? result.validation_results : {};
  const nextSteps = Array.isArray(result.next_steps)
    ? result.next_steps.filter((step): step is string => typeof step === "string").map(redactText).slice(0, 6)
    : [];
  const logsPreview = typeof result.logs === "string" ? redactText(result.logs).slice(0, 500) : "";
  const toolStatus = typeof result.status === "string" ? result.status : "missing";
  const status =
    toolStatus === "success" ? "SUCCESS" : toolStatus === "exception" ? "EXCEPTION" : ("ERROR" as const);

  return {
    status,
    toolStatus,
    summary,
    failureCount: summary.failure ?? 0,
    errorCount: summary.error ?? 0,
    warningCount: summary.warning ?? 0,
    validationGroupCount: Object.keys(validationResults).length,
    nextSteps,
    logsPreview,
    publicSafe: true
  };
};

const composition = (): AppInspectCompositionSummary["composition"] => ({
  servers: [
    {
      name: "splunk",
      role: "Read-only investigation MCP server for deployment data, saved searches, and evidence rows.",
      authority: "operational-evidence-source"
    },
    {
      name: "appinspect",
      role: "Splunk AppInspect MCP server for advisory static validation of the packaged Splunk app.",
      authority: "advisory-static-validation"
    },
    {
      name: "splunkready",
      role: "SplunkReady MCP server for deterministic transcript certification and Readiness Receipt output.",
      authority: "deterministic-receipt-authority"
    }
  ],
  deterministicReceiptAuthority: "splunkready",
  appInspectAuthority: "advisory-static-validation"
});

const baseSummary = (input: {
  status: AppInspectCompositionStatus;
  artifactPath: string;
  markdownPath: string;
  appPackagePath: string;
  appPackagePresent: boolean;
  serverStatus: AppInspectCompositionSummary["server"]["status"];
  blockedReason?: string;
}): AppInspectCompositionSummary => ({
  source: "splunkready-appinspect-mcp-composition",
  status: input.status,
  generatedAt,
  artifactPath: input.artifactPath,
  markdownPath: input.markdownPath,
  appPackagePath: input.appPackagePath,
  appPackagePresent: input.appPackagePresent,
  command: commandLabel,
  server: {
    status: input.serverStatus,
    name: "",
    version: "",
    tools: [],
    blockedReason: input.blockedReason ?? ""
  },
  validation: {
    status: "NOT_RUN",
    toolStatus: "not_run",
    summary: {},
    failureCount: 0,
    errorCount: 0,
    warningCount: 0,
    validationGroupCount: 0,
    nextSteps: [],
    logsPreview: "",
    publicSafe: true
  },
  composition: composition(),
  deterministicAuthority: true,
  mutation: false
});

class AppInspectMcpClient {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<string, PendingRequest>();
  private buffer = "";
  private sequence = 0;
  private closed = false;

  constructor() {
    this.child = spawn("uvx", ["splunk-appinspect[mcp]", "mcp-server"], { stdio: ["pipe", "pipe", "pipe"] });
    this.child.stdout.on("data", (chunk) => this.handleStdout(chunk.toString()));
    this.child.stderr.on("data", () => undefined);
    this.child.on("error", (error) => this.rejectAll(error));
    this.child.on("exit", () => this.rejectAll(new Error("AppInspect MCP server exited before completing the proof.")));
  }

  async request(method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    if (this.closed) {
      throw new Error("AppInspect MCP client is closed.");
    }

    const id = `appinspect-${(this.sequence += 1)}`;
    const payload = { jsonrpc: "2.0", id, method, params };

    const response = await new Promise<JsonRpcResponse>((resolveRequest, rejectRequest) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        rejectRequest(new Error(`Timed out waiting for AppInspect MCP ${method}.`));
      }, requestTimeoutMs);
      this.pending.set(id, { resolve: resolveRequest, reject: rejectRequest, timer });
      this.child.stdin.write(`${JSON.stringify(payload)}\n`);
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    return response.result ?? {};
  }

  notify(method: string, params: Record<string, unknown> = {}): void {
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
  }

  close(): void {
    this.closed = true;
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
    }
    this.pending.clear();
    this.child.kill("SIGTERM");
  }

  private handleStdout(chunk: string): void {
    this.buffer += chunk;

    for (;;) {
      const newline = this.buffer.indexOf("\n");
      if (newline < 0) {
        return;
      }

      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line.startsWith("{")) {
        continue;
      }

      let response: JsonRpcResponse;
      try {
        response = JSON.parse(line) as JsonRpcResponse;
      } catch {
        continue;
      }

      const id = response.id;
      if ((typeof id !== "string" && typeof id !== "number") || !this.pending.has(String(id))) {
        continue;
      }

      const pending = this.pending.get(String(id));
      if (!pending) {
        continue;
      }
      clearTimeout(pending.timer);
      this.pending.delete(String(id));
      pending.resolve(response);
    }
  }

  private rejectAll(error: Error): void {
    for (const [id, request] of this.pending.entries()) {
      clearTimeout(request.timer);
      request.reject(error);
      this.pending.delete(id);
    }
  }
}

const extractToolResult = (response: Record<string, unknown>): unknown => {
  if (isRecord(response.structuredContent)) {
    return response.structuredContent;
  }

  const content = Array.isArray(response.content) ? response.content : [];
  const firstText = content
    .filter(isRecord)
    .map((item) => item.text)
    .find((text): text is string => typeof text === "string" && text.length > 0);
  if (!firstText) {
    return response;
  }

  try {
    return JSON.parse(firstText) as unknown;
  } catch {
    return { status: "exception", logs: firstText };
  }
};

export const findDefaultSplunkAppPackage = async (): Promise<string> => {
  const appPackageDir = resolve("submission-evidence/splunk-app-package");
  if (!existsSync(appPackageDir)) {
    return join(appPackageDir, "SplunkReady.spl");
  }

  const candidates = (await readdir(appPackageDir))
    .filter((entry) => entry.endsWith(".spl"))
    .sort((left, right) => right.localeCompare(left));
  return candidates.length > 0 ? join(appPackageDir, candidates[0]) : join(appPackageDir, "SplunkReady.spl");
};

export const appInspectCompositionMarkdown = (summary: AppInspectCompositionSummary): string => `# AppInspect MCP Composition

Status: ${summary.status}

Command: ${summary.command}

App package: ${summary.appPackagePath}

AppInspect server: ${summary.server.status}${summary.server.name ? ` (${summary.server.name} ${summary.server.version})` : ""}

Tools: ${summary.server.tools.join(", ") || "none"}

Validation status: ${summary.validation.status}

Validation summary:
${Object.entries(summary.validation.summary).map(([key, value]) => `- ${key}: ${value}`).join("\n") || "- none"}

Static validation counts:
- failures: ${summary.validation.failureCount}
- errors: ${summary.validation.errorCount}
- warnings: ${summary.validation.warningCount}

Next steps:
${summary.validation.nextSteps.map((step) => `- ${step}`).join("\n") || "- none"}

Composition:
${summary.composition.servers.map((server) => `- ${server.name}: ${server.role} (${server.authority})`).join("\n")}

Authority:
- Deterministic Readiness Receipt authority: ${summary.composition.deterministicReceiptAuthority}
- AppInspect authority: ${summary.composition.appInspectAuthority}
- Mutation: ${summary.mutation ? "yes" : "no"}
`;

export const runAppInspectCompositionWorkflow = async (input: {
  enabled: boolean;
  appPackagePath: string;
  artifactPath: string;
  markdownPath: string;
}): Promise<AppInspectCompositionSummary> => {
  const resolvedPackagePath = resolve(input.appPackagePath);
  const packagePresent = existsSync(resolvedPackagePath);

  await mkdir(dirname(resolve(input.artifactPath)), { recursive: true });

  if (!input.enabled) {
    const summary = baseSummary({
      status: "NOT_REQUESTED",
      artifactPath: input.artifactPath,
      markdownPath: input.markdownPath,
      appPackagePath: displayPath(resolvedPackagePath),
      appPackagePresent: packagePresent,
      serverStatus: "NOT_REQUESTED",
      blockedReason: "AppInspect MCP composition runs only for live-mock MCP proof."
    });
    await writeFile(input.artifactPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    await writeFile(input.markdownPath, appInspectCompositionMarkdown(summary), "utf8");
    return summary;
  }

  if (!packagePresent) {
    const summary = baseSummary({
      status: "BLOCKED",
      artifactPath: input.artifactPath,
      markdownPath: input.markdownPath,
      appPackagePath: displayPath(resolvedPackagePath),
      appPackagePresent: false,
      serverStatus: "UNAVAILABLE",
      blockedReason: "Splunk app package was not found; run build:splunk-app before collecting AppInspect MCP evidence."
    });
    await writeFile(input.artifactPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    await writeFile(input.markdownPath, appInspectCompositionMarkdown(summary), "utf8");
    return summary;
  }

  let client: AppInspectMcpClient | undefined;

  try {
    client = new AppInspectMcpClient();
    const initialize = await client.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "splunkready-appinspect-composition", version: "0.0.0" }
    });
    client.notify("notifications/initialized");
    const toolsList = await client.request("tools/list");
    const tools = Array.isArray(toolsList.tools)
      ? toolsList.tools
          .filter(isRecord)
          .map((tool) => tool.name)
          .filter((name): name is string => typeof name === "string")
      : [];

    if (!tools.includes("inspect_app")) {
      const summary = baseSummary({
        status: "BLOCKED",
        artifactPath: input.artifactPath,
        markdownPath: input.markdownPath,
        appPackagePath: displayPath(resolvedPackagePath),
        appPackagePresent: true,
        serverStatus: "AVAILABLE",
        blockedReason: "AppInspect MCP server did not advertise inspect_app."
      });
      const serverInfo = isRecord(initialize.serverInfo) ? initialize.serverInfo : {};
      summary.server.name = typeof serverInfo.name === "string" ? serverInfo.name : "";
      summary.server.version = typeof serverInfo.version === "string" ? serverInfo.version : "";
      summary.server.tools = tools;
      await writeFile(input.artifactPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
      await writeFile(input.markdownPath, appInspectCompositionMarkdown(summary), "utf8");
      return summary;
    }

    const inspectResult = await client.request("tools/call", {
      name: "inspect_app",
      arguments: { path: resolvedPackagePath }
    });
    const serverInfo = isRecord(initialize.serverInfo) ? initialize.serverInfo : {};
    const summary = baseSummary({
      status: "PASS",
      artifactPath: input.artifactPath,
      markdownPath: input.markdownPath,
      appPackagePath: displayPath(resolvedPackagePath),
      appPackagePresent: true,
      serverStatus: "AVAILABLE"
    });
    summary.server.name = typeof serverInfo.name === "string" ? serverInfo.name : "";
    summary.server.version = typeof serverInfo.version === "string" ? serverInfo.version : "";
    summary.server.tools = tools;
    summary.validation = summarizeAppInspectToolResult(extractToolResult(inspectResult));
    summary.status = summary.validation.status === "SUCCESS" ? "PASS" : "ERROR";

    await writeFile(input.artifactPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    await writeFile(input.markdownPath, appInspectCompositionMarkdown(summary), "utf8");
    return summary;
  } catch (error) {
    const summary = baseSummary({
      status: "ERROR",
      artifactPath: input.artifactPath,
      markdownPath: input.markdownPath,
      appPackagePath: displayPath(resolvedPackagePath),
      appPackagePresent: packagePresent,
      serverStatus: "UNAVAILABLE",
      blockedReason: error instanceof Error ? redactText(error.message) : "Unknown AppInspect MCP error."
    });
    summary.validation.status = "ERROR";
    summary.validation.toolStatus = "error";
    await writeFile(input.artifactPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    await writeFile(input.markdownPath, appInspectCompositionMarkdown(summary), "utf8");
    return summary;
  } finally {
    client?.close();
  }
};
