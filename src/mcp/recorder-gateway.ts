import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { createInterface } from "node:readline";

import {
  redactMcpRecorderValue,
  writeMcpCompositionRecorderFrames,
  type McpCompositionRecorderSummary,
  type McpRecorderFrame
} from "./composition-recorder.js";
import { runMcpTranscriptCertificationFromPathWorkflow } from "../workflows/external-certification.js";

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

interface JsonRpcSuccess {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: Record<string, unknown>;
}

interface JsonRpcError {
  jsonrpc: "2.0";
  id: JsonRpcId;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;

export interface RecorderServerConfig {
  id: "splunk" | "splunkready";
  command: string;
  args: string[];
  cwd?: string;
}

interface DownstreamTool {
  serverId: "splunk" | "splunkready";
  name: string;
  tool: Record<string, unknown>;
}

class RecorderStdioClient {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly pending: Array<(response: JsonRpcResponse) => void> = [];
  private stdoutBuffer = "";
  private stderrBuffer = "";

  constructor(private readonly config: RecorderServerConfig) {
    this.child = spawn(config.command, config.args, {
      cwd: config.cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"]
    });
    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => this.acceptStdout(chunk));
    this.child.stderr.on("data", (chunk: string) => {
      this.stderrBuffer += chunk;
    });
  }

  async request(message: JsonRpcRequest): Promise<JsonRpcResponse> {
    const response = new Promise<JsonRpcResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timed out waiting for ${this.config.id} MCP response. ${this.stderrBuffer.trim()}`.trim()));
      }, 60_000);

      this.pending.push((value) => {
        clearTimeout(timer);
        resolve(value);
      });
    });

    this.child.stdin.write(`${JSON.stringify(message)}\n`);
    return response;
  }

  notify(method: string, params?: unknown): void {
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
  }

  close(): void {
    this.child.stdin.end();
    this.child.kill();
  }

  private acceptStdout(chunk: string): void {
    this.stdoutBuffer += chunk;

    while (this.stdoutBuffer.includes("\n")) {
      const newlineIndex = this.stdoutBuffer.indexOf("\n");
      const line = this.stdoutBuffer.slice(0, newlineIndex).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);

      if (!line) {
        continue;
      }

      const resolve = this.pending.shift();

      if (resolve) {
        resolve(JSON.parse(line) as JsonRpcResponse);
      }
    }
  }
}

const success = (id: JsonRpcId, result: Record<string, unknown>): JsonRpcSuccess => ({ jsonrpc: "2.0", id, result });

const error = (id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcError => ({
  jsonrpc: "2.0",
  id,
  error: { code, message, ...(data === undefined ? {} : { data }) }
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const requestId = (message: JsonRpcRequest): JsonRpcId =>
  typeof message.id === "string" || typeof message.id === "number" || message.id === null ? message.id : null;

const structuredContentFrom = (response: JsonRpcResponse, label: string): Record<string, unknown> => {
  if ("error" in response) {
    throw new Error(`${label} failed: ${response.error.message}`);
  }

  const structuredContent = response.result.structuredContent;

  if (!isRecord(structuredContent)) {
    throw new Error(`${label} did not return structuredContent.`);
  }

  return structuredContent;
};

const localServerConfig = (input: {
  id: "splunk" | "splunkready";
  value: string;
  cliPath: string;
  fixturePath: string;
  mockState: string;
}): RecorderServerConfig => {
  const packageRoot = packageRootFromFixturePath(input.fixturePath, input.cliPath);

  if (input.value === "mock-splunk-mcp") {
    return {
      id: input.id,
      command: process.execPath,
      args: [input.cliPath, "mock-splunk-mcp", "--fixture", input.fixturePath, "--mock-state", input.mockState],
      cwd: packageRoot
    };
  }

  if (input.value === "mcp") {
    return {
      id: input.id,
      command: process.execPath,
      args: [input.cliPath, "mcp"],
      cwd: packageRoot
    };
  }

  const [command, ...args] = input.value.split(/\s+/).filter((part) => part.length > 0);

  if (!command) {
    throw new Error(`Invalid MCP recorder server for ${input.id}.`);
  }

  return { id: input.id, command, args };
};

const packageRootFromFixturePath = (fixturePath: string, cliPath: string): string => {
  const absoluteFixturePath = resolve(fixturePath);
  const marker = `${sep}fixtures${sep}`;
  const markerIndex = absoluteFixturePath.indexOf(marker);

  if (markerIndex >= 0) {
    return absoluteFixturePath.slice(0, markerIndex);
  }

  return resolve(dirname(resolve(cliPath)), "../..");
};

const defaultMissionPathFromPackageRoot = (packageRoot: string): string =>
  join(packageRoot, "fixtures/acme-soc-dev/missions/security-investigation-readiness.json");

export const parseRecorderServerConfigs = (input: {
  serverSpecs: string[];
  cliPath: string;
  fixturePath: string;
  mockState: string;
}): RecorderServerConfig[] => {
  const configs = input.serverSpecs.map((spec) => {
    const separator = spec.indexOf("=");

    if (separator <= 0) {
      throw new Error(`Invalid --server value "${spec}". Use --server splunk=mock-splunk-mcp.`);
    }

    const id = spec.slice(0, separator);
    const value = spec.slice(separator + 1);

    if (id !== "splunk" && id !== "splunkready") {
      throw new Error("--server id must be splunk or splunkready.");
    }

    return localServerConfig({
      id,
      value,
      cliPath: input.cliPath,
      fixturePath: input.fixturePath,
      mockState: input.mockState
    });
  });
  const ids = new Set(configs.map((config) => config.id));

  if (!ids.has("splunk") || !ids.has("splunkready")) {
    throw new Error("mcp-recorder requires --server splunk=... and --server splunkready=...");
  }

  return configs;
};

const recorderTool = {
  name: "splunkready_recorder_flush",
  title: "Flush MCP Recorder Session",
  description: "Write the redacted dual-server MCP recorder session and certify the Splunk-side transcript.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      finalAnswer: { type: "string" },
      requirePass: { type: "boolean", default: true }
    },
    required: ["finalAnswer"]
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false }
};

const evidenceRefsFrom = (value: unknown): string[] => {
  if (!isRecord(value)) {
    return [];
  }

  const directRefs = Array.isArray(value.evidenceRefs) ? value.evidenceRefs : [];
  const results = Array.isArray(value.results) ? value.results : [];
  const rows = Array.isArray(value.rows) ? value.rows : [];

  return [
    ...directRefs.filter((ref): ref is string => typeof ref === "string" && ref.length > 0),
    ...results
      .filter(isRecord)
      .map((result) => result.eventRef)
      .filter((ref): ref is string => typeof ref === "string" && ref.length > 0),
    ...rows
      .filter(isRecord)
      .map((row) => row.eventRef)
      .filter((ref): ref is string => typeof ref === "string" && ref.length > 0)
  ];
};

const frameEvidenceRefs = (frame: McpRecorderFrame): string[] => {
  const message = isRecord(frame.message) ? frame.message : {};
  const result = isRecord(message.result) ? message.result : {};
  const structuredContent = isRecord(result.structuredContent) ? result.structuredContent : {};

  return [...evidenceRefsFrom(message), ...evidenceRefsFrom(structuredContent)];
};

const queryRefFromFrame = (frame: McpRecorderFrame): string | undefined => {
  const message = isRecord(frame.message) ? frame.message : {};
  const result = isRecord(message.result) ? message.result : {};
  const structuredContent = isRecord(result.structuredContent) ? result.structuredContent : {};
  const queryRef = structuredContent.queryRef ?? structuredContent.savedSearchRef;

  return typeof queryRef === "string" && queryRef.length > 0 ? queryRef : undefined;
};

const isFinalAnswerFrame = (frame: McpRecorderFrame): boolean => {
  const message = isRecord(frame.message) ? frame.message : {};

  return message.type === "final_answer" || message.event === "final_answer" || message.kind === "final_answer";
};

export class McpRecorderGateway {
  private readonly clients = new Map<"splunk" | "splunkready", RecorderStdioClient>();
  private readonly tools = new Map<string, DownstreamTool>();
  private readonly frames: McpRecorderFrame[] = [];
  private sequence = 0;

  constructor(
    private readonly configs: RecorderServerConfig[],
    private readonly paths: {
      artifactPath: string;
      markdownPath: string;
      certificationOutDir: string;
      fixturePath: string;
      missionPath: string;
    }
  ) {}

  async start(): Promise<void> {
    for (const config of this.configs) {
      const client = new RecorderStdioClient(config);
      this.clients.set(config.id, client);
      await client.request({
        jsonrpc: "2.0",
        id: `${config.id}-initialize`,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "splunkready-mcp-recorder", version: "1.0.0" }
        }
      });
      client.notify("notifications/initialized");
      const toolsResponse = await client.request({ jsonrpc: "2.0", id: `${config.id}-tools`, method: "tools/list" });
      const tools = "result" in toolsResponse && Array.isArray(toolsResponse.result.tools) ? toolsResponse.result.tools : [];

      for (const tool of tools.filter(isRecord)) {
        const name = typeof tool.name === "string" ? tool.name : "";

        if (name) {
          this.tools.set(`${config.id}__${name}`, { serverId: config.id, name, tool });
        }
      }
    }
  }

  close(): void {
    for (const client of this.clients.values()) {
      client.close();
    }
  }

  async handle(request: JsonRpcRequest): Promise<JsonRpcResponse | undefined> {
    if (request.method === "notifications/initialized") {
      return undefined;
    }

    if (request.method === "initialize") {
      return success(requestId(request), {
        protocolVersion: "2025-06-18",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "splunkready-mcp-recorder", version: "1.0.0" },
        instructions:
          "SplunkReady MCP Recorder proxies named downstream MCP servers, records redacted frames, and certifies Splunk-side transcripts."
      });
    }

    if (request.method === "tools/list") {
      const proxiedTools = [...this.tools.entries()].map(([proxiedName, entry]) => ({
        ...entry.tool,
        name: proxiedName,
        title: typeof entry.tool.title === "string" ? `${entry.serverId}: ${entry.tool.title}` : proxiedName,
        description: `Recorded ${entry.serverId} downstream tool: ${String(entry.tool.description ?? entry.name)}`
      }));

      return success(requestId(request), { tools: [...proxiedTools, recorderTool] });
    }

    if (request.method === "tools/call") {
      return this.handleToolCall(request);
    }

    return error(requestId(request), -32601, `Unsupported MCP recorder method ${request.method}.`);
  }

  private async handleToolCall(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const params = isRecord(request.params) ? request.params : {};
    const name = typeof params.name === "string" ? params.name : "";

    if (name === "splunkready_recorder_flush") {
      const args = isRecord(params.arguments) ? params.arguments : {};
      const finalAnswer = typeof args.finalAnswer === "string" ? args.finalAnswer : "";
      const requirePass = args.requirePass !== false;

      if (!finalAnswer.trim()) {
        return error(requestId(request), -32602, "splunkready_recorder_flush requires finalAnswer.");
      }

      try {
        this.recordFrame("splunkready", "request", {
          jsonrpc: "2.0",
          id: requestId(request),
          method: "tools/call",
          params: { name: "splunkready_recorder_flush", arguments: { finalAnswer, requirePass } }
        });

        const summary = await this.flush({ finalAnswer, requirePass });
        const responseSummary: McpCompositionRecorderSummary = {
          ...summary,
          frameCount: summary.frameCount + 1,
          responseCount: summary.responseCount + 1
        };
        const response = success(requestId(request), {
          content: [{ type: "text", text: JSON.stringify(responseSummary, null, 2) }],
          structuredContent: responseSummary
        });
        this.recordFrame("splunkready", "response", response);
        await writeMcpCompositionRecorderFrames({
          frames: this.frames,
          artifactPath: this.paths.artifactPath,
          markdownPath: this.paths.markdownPath,
          certification: summary.certification
        });
        const finalCertification = await runMcpTranscriptCertificationFromPathWorkflow({
          transcriptPath: this.paths.artifactPath,
          outDir: this.paths.certificationOutDir,
          fixturePath: this.paths.fixturePath,
          missionPath: this.paths.missionPath,
          strictImport: true,
          requirePass,
          agentName: "MCP Recorder Gateway",
          agentVersion: "pass-through"
        });
        await writeMcpCompositionRecorderFrames({
          frames: this.frames,
          artifactPath: this.paths.artifactPath,
          markdownPath: this.paths.markdownPath,
          certification: {
            status: finalCertification.status,
            outDir: this.paths.certificationOutDir,
            artifactCount: finalCertification.artifacts.length
          }
        });

        return response;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "MCP recorder flush failed.";

        return error(requestId(request), -32603, message);
      }
    }

    const entry = this.tools.get(name);

    if (!entry) {
      return error(requestId(request), -32602, `Unknown recorded downstream tool ${name}.`);
    }

    const client = this.clients.get(entry.serverId);

    if (!client) {
      return error(requestId(request), -32603, `Downstream server ${entry.serverId} is not running.`);
    }

    const downstreamRequest: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: requestId(request),
      method: "tools/call",
      params: { ...params, name: entry.name }
    };
    this.recordFrame(entry.serverId, "request", downstreamRequest);
    const response = await client.request(downstreamRequest);
    this.recordFrame(entry.serverId, "response", response);

    return response;
  }

  private recordFrame(serverId: "splunk" | "splunkready", direction: "request" | "response", message: unknown): void {
    this.frames.push({
      source: "splunkready-mcp-composition-recorder",
      serverId,
      serverRole: serverId === "splunk" ? "existing-splunk-mcp" : "splunkready-certifier-mcp",
      direction,
      sequence: ++this.sequence,
      message: redactMcpRecorderValue(message)
    });
  }

  private async flush(input: { finalAnswer: string; requirePass: boolean }): Promise<McpCompositionRecorderSummary> {
    this.appendFinalAnswerFrame(input.finalAnswer);
    await mkdir(this.paths.certificationOutDir, { recursive: true });
    await writeMcpCompositionRecorderFrames({
      frames: this.frames,
      artifactPath: this.paths.artifactPath,
      markdownPath: this.paths.markdownPath
    });
    const certification = await runMcpTranscriptCertificationFromPathWorkflow({
      transcriptPath: this.paths.artifactPath,
      outDir: this.paths.certificationOutDir,
      fixturePath: this.paths.fixturePath,
      missionPath: this.paths.missionPath,
      strictImport: true,
      requirePass: input.requirePass,
      agentName: "MCP Recorder Gateway",
      agentVersion: "pass-through"
    });

    return writeMcpCompositionRecorderFrames({
      frames: this.frames,
      artifactPath: this.paths.artifactPath,
      markdownPath: this.paths.markdownPath,
      certification: {
        status: certification.status,
        outDir: this.paths.certificationOutDir,
        artifactCount: certification.artifacts.length
      }
    });
  }

  private appendFinalAnswerFrame(finalAnswer: string): void {
    if (this.frames.some(isFinalAnswerFrame)) {
      return;
    }

    const evidenceRefs = [...new Set(this.frames.flatMap(frameEvidenceRefs))];
    const queryRef = this.frames.map(queryRefFromFrame).find((value): value is string => Boolean(value));
    const provenance = queryRef ? ` Provenance ${queryRef}.` : "";
    const evidence = evidenceRefs.length ? ` Evidence refs: ${evidenceRefs.join(", ")}.` : "";

    this.frames.push({
      source: "splunkready-mcp-composition-recorder",
      serverId: "splunkready",
      serverRole: "splunkready-certifier-mcp",
      direction: "final_answer",
      sequence: ++this.sequence,
      message: redactMcpRecorderValue({
        type: "final_answer",
        finalAnswer: `${finalAnswer.trim()}${provenance}${evidence}`,
        resultCount: evidenceRefs.length,
        evidenceRefs,
        timeWindow: { earliest: "-24h", latest: "now" },
        timestamp: "2026-06-01T06:05:25.000Z"
      })
    });
  }
}

export const startStdioMcpRecorderGateway = async (input: {
  serverSpecs: string[];
  cliPath: string;
  fixturePath: string;
  mockState: string;
  outDir: string;
}): Promise<void> => {
  const configs = parseRecorderServerConfigs(input);
  const packageRoot = packageRootFromFixturePath(input.fixturePath, input.cliPath);
  const gateway = new McpRecorderGateway(configs, {
    artifactPath: join(input.outDir, "mcp-recorder-session.jsonl"),
    markdownPath: join(input.outDir, "mcp-recorder-session.md"),
    certificationOutDir: join(input.outDir, "mcp-recorder-certification"),
    fixturePath: input.fixturePath,
    missionPath: defaultMissionPathFromPackageRoot(packageRoot)
  });
  await mkdir(input.outDir, { recursive: true });
  await gateway.start();

  const readline = createInterface({ input: process.stdin, crlfDelay: Infinity });

  try {
    for await (const line of readline) {
      const trimmed = line.trim();

      if (!trimmed) {
        continue;
      }

      try {
        const request = JSON.parse(trimmed) as JsonRpcRequest;
        const response = await gateway.handle(request);

        if (response) {
          process.stdout.write(`${JSON.stringify(response)}\n`);
        }
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Unknown MCP recorder gateway error.";
        process.stdout.write(`${JSON.stringify(error(null, -32700, message))}\n`);
      }
    }
  } finally {
    gateway.close();
  }
};

export const runMcpRecorderGatewayProofSession = async (input: {
  cliPath: string;
  fixturePath: string;
  mockState: string;
  transcriptPath: string;
  finalAnswer: string;
  artifactPath: string;
  markdownPath: string;
  certificationOutDir: string;
  downstreamCertificationOutDir: string;
  downstreamPathCertificationOutDir: string;
}): Promise<McpCompositionRecorderSummary> => {
  const configs = parseRecorderServerConfigs({
    serverSpecs: ["splunk=mock-splunk-mcp", "splunkready=mcp"],
    cliPath: input.cliPath,
    fixturePath: input.fixturePath,
    mockState: input.mockState
  });
  const packageRoot = packageRootFromFixturePath(input.fixturePath, input.cliPath);
  const gateway = new McpRecorderGateway(configs, {
    artifactPath: input.artifactPath,
    markdownPath: input.markdownPath,
    certificationOutDir: input.certificationOutDir,
    fixturePath: input.fixturePath,
    missionPath: defaultMissionPathFromPackageRoot(packageRoot)
  });

  await mkdir(input.downstreamCertificationOutDir, { recursive: true });
  await mkdir(input.downstreamPathCertificationOutDir, { recursive: true });
  await gateway.start();

  try {
    const callTool = async (label: string, request: JsonRpcRequest): Promise<Record<string, unknown>> =>
      structuredContentFrom(
        (await gateway.handle(request)) ?? error(null, -32603, `${label} returned no response.`),
        label
      );

    await callTool("mock Splunk knowledge objects", {
      jsonrpc: "2.0",
      id: "gateway-knowledge",
      method: "tools/call",
      params: {
        name: "splunk__splunk_get_knowledge_objects",
        arguments: { types: ["saved_searches"], app: "SplunkEnterpriseSecuritySuite" }
      }
    });
    await callTool("mock Splunk saved search", {
      jsonrpc: "2.0",
      id: "gateway-saved-search",
      method: "tools/call",
      params: {
        name: "splunk__splunk_run_saved_search",
        arguments: {
          name: "ES - Lateral Movement Auth Chain",
          app: "SplunkEnterpriseSecuritySuite",
          tokens: {
            host: "win-finance-07",
            earliest: "-24h",
            latest: "now"
          },
          maxRows: 10
        }
      }
    });

    const transcript = await readFile(input.transcriptPath, "utf8");
    await callTool("SplunkReady inline transcript certification", {
      jsonrpc: "2.0",
      id: "gateway-certify-content",
      method: "tools/call",
      params: {
        name: "splunkready__splunkready_certify_mcp_transcript_content",
        arguments: {
          transcript,
          finalAnswer: input.finalAnswer,
          outDir: input.downstreamCertificationOutDir,
          strictImport: true,
          requirePass: true,
          agentName: "MCP Recorder Gateway",
          agentVersion: "proof-inline"
        }
      }
    });
    await callTool("SplunkReady path transcript certification", {
      jsonrpc: "2.0",
      id: "gateway-certify-path",
      method: "tools/call",
      params: {
        name: "splunkready__splunkready_certify_mcp_transcript",
        arguments: {
          transcriptPath: input.transcriptPath,
          finalAnswer: input.finalAnswer,
          outDir: input.downstreamPathCertificationOutDir,
          strictImport: true,
          requirePass: true,
          agentName: "MCP Recorder Gateway",
          agentVersion: "proof-path"
        }
      }
    });

    const flushResponse = await callTool("MCP recorder flush", {
      jsonrpc: "2.0",
      id: "gateway-flush",
      method: "tools/call",
      params: {
        name: "splunkready_recorder_flush",
        arguments: { finalAnswer: input.finalAnswer, requirePass: true }
      }
    });

    return flushResponse as unknown as McpCompositionRecorderSummary;
  } finally {
    gateway.close();
  }
};
