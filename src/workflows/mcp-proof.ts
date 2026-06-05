import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

export interface McpProofWorkflowInput {
  outDir: string;
  serverPath: string;
  transcriptPath?: string;
  finalAnswer?: string;
}

export interface McpProofWorkflowResult {
  status: "PASS" | "FAIL";
  outDir: string;
  artifacts: string[];
  mutation: false;
  messages: string[];
}

interface JsonRpcSuccess {
  jsonrpc: "2.0";
  id: string | number | null;
  result: Record<string, unknown>;
}

interface JsonRpcError {
  jsonrpc: "2.0";
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;

interface McpProofSummary {
  source: "splunkready-mcp-proof";
  status: "PASS" | "FAIL";
  mutation: false;
  generatedAt: string;
  serverPath: string;
  transcriptPath: string;
  handshake: {
    protocolVersion: string;
    serverName: string;
    instructions: string;
  };
  tools: Array<{
    name: string;
    destructiveHint: unknown;
    readOnlyHint: unknown;
  }>;
  resources: Array<{
    uri: string;
    name: string;
    mimeType: string;
  }>;
  prompts: Array<{
    name: string;
    argumentCount: number;
  }>;
  describe: Record<string, unknown>;
  postureResource: Record<string, unknown>;
  clientConfigResource: Record<string, unknown>;
  dualServerClientConfigResource: Record<string, unknown>;
  certificationLoopResource: Record<string, unknown>;
  transcriptPrompt: Record<string, unknown>;
  certificationLoopPrompt: Record<string, unknown>;
  transcriptCertification: Record<string, unknown>;
  agentDrivenWorkflow: {
    status: "PASS" | "FAIL";
    splunkMcpServerRole: string;
    splunkReadyMcpServerRole: string;
    stages: string[];
    deterministicAuthority: true;
    mutation: false;
  };
  splunkMcpBoundary: {
    status: "PASS" | "FAIL";
    transcriptKind: "captured-splunk-mcp-jsonrpc";
    transcriptPath: string;
    localMcpServerRole: string;
    splunkMcpServerRole: string;
    certifiedToolNames: string[];
    splunkToolCallCount: number;
    includesSavedSearchExecution: boolean;
    evidenceRefs: string[];
    receiptPath: string;
    deterministicAuthority: true;
    mutation: false;
  };
  artifacts: string[];
  nextCommands: string[];
}

const defaultTranscriptPath = "examples/sample-mcp-transcript-pass.jsonl";
const defaultFinalAnswer =
  "Evidence supports suspicious lateral movement from win-finance-07 through admin-login-02 to dc-01 and finance-sql-03. Provenance saved-search-lateral-movement returned 3 rows for the -24h to now window, with evidence rows evt-102, evt-118, and evt-141.";
const generatedAt = "2026-06-01T06:45:00.000Z";

const isJsonRpcError = (response: JsonRpcResponse): response is JsonRpcError => "error" in response;

const asRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid MCP proof response for ${label}.`);
  }

  return value as Record<string, unknown>;
};

const stringFromRecord = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];

  return typeof value === "string" ? value : "";
};

class McpStdioClient {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly pending: Array<(response: JsonRpcResponse) => void> = [];
  private stdoutBuffer = "";
  private stderrBuffer = "";

  constructor(serverPath: string) {
    this.child = spawn(process.execPath, [serverPath], {
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

  async request(method: string, params?: unknown): Promise<Record<string, unknown>> {
    const id = this.pending.length + 1;
    const response = await this.send({ jsonrpc: "2.0", id, method, params });

    if (isJsonRpcError(response)) {
      throw new Error(`MCP ${method} failed: ${response.error.message}`);
    }

    return response.result;
  }

  notify(method: string, params?: unknown): void {
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
  }

  close(): void {
    this.child.stdin.end();
    this.child.kill();
  }

  private async send(message: Record<string, unknown>): Promise<JsonRpcResponse> {
    const response = new Promise<JsonRpcResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timed out waiting for MCP response. ${this.stderrBuffer.trim()}`.trim()));
      }, 60_000);

      this.pending.push((value) => {
        clearTimeout(timer);
        resolve(value);
      });
    });

    this.child.stdin.write(`${JSON.stringify(message)}\n`);

    return response;
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

const extractStructuredContent = (toolCallResult: Record<string, unknown>, label: string): Record<string, unknown> => {
  const structured = asRecord(toolCallResult.structuredContent, label);

  if (toolCallResult.isError === true) {
    throw new Error(`MCP ${label} returned a tool error: ${stringFromRecord(structured, "message")}`);
  }

  return structured;
};

const mcpProofMarkdown = (summary: McpProofSummary): string => `# SplunkReady MCP Proof

Status: ${summary.status}

Server: ${summary.handshake.serverName}

Protocol: ${summary.handshake.protocolVersion}

Mutation: ${summary.mutation ? "yes" : "no"}

Tools:
${summary.tools.map((tool) => `- ${tool.name} destructive=${String(tool.destructiveHint)} readOnly=${String(tool.readOnlyHint)}`).join("\n")}

Resources:
${summary.resources.map((resource) => `- ${resource.uri} (${resource.mimeType})`).join("\n")}

Dual-server MCP client kit:
- Resource: splunkready://client-config/splunk-and-splunkready
- Existing Splunk MCP role: investigate with read-only Splunk tools
- SplunkReady MCP role: certify the captured Splunk MCP transcript

Prompts:
${summary.prompts.map((prompt) => `- ${prompt.name} arguments=${prompt.argumentCount}`).join("\n")}

Agent-driven workflow: ${summary.agentDrivenWorkflow.status}
${summary.agentDrivenWorkflow.stages.map((stage) => `- ${stage}`).join("\n")}

Transcript certification: ${stringFromRecord(summary.transcriptCertification, "status")}

Splunk MCP boundary: ${summary.splunkMcpBoundary.status}
- Certified tool calls: ${summary.splunkMcpBoundary.certifiedToolNames.join(", ")}
- Saved-search execution: ${summary.splunkMcpBoundary.includesSavedSearchExecution ? "yes" : "no"}
- Evidence refs: ${summary.splunkMcpBoundary.evidenceRefs.join(", ")}
- Receipt: ${summary.splunkMcpBoundary.receiptPath}

Receipt: ${stringFromRecord(summary.transcriptCertification, "outDir")}/receipt-external-001.json
`;

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const collectEvidenceRefs = (value: unknown): string[] => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const record = value as Record<string, unknown>;
  const directRefs = stringArray(record.evidenceRefs);
  const results = Array.isArray(record.results) ? record.results : [];
  const resultRefs = results.flatMap((result) => {
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      return [];
    }

    const eventRef = (result as Record<string, unknown>).eventRef;
    return typeof eventRef === "string" ? [eventRef] : [];
  });

  return [...directRefs, ...resultRefs];
};

const displayPath = (path: string): string => {
  const relativePath = relative(process.cwd(), path);

  if (!relativePath || relativePath.startsWith("..")) {
    return path;
  }

  return relativePath;
};

const readSplunkMcpBoundaryEvidence = async (
  transcriptPath: string,
  certificationStatus: "PASS" | "FAIL",
  receiptPath: string
): Promise<McpProofSummary["splunkMcpBoundary"]> => {
  const lines = (await readFile(transcriptPath, "utf8"))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const certifiedToolNames: string[] = [];
  const evidenceRefs: string[] = [];

  for (const line of lines) {
    const parsed = JSON.parse(line) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      continue;
    }

    const record = parsed as Record<string, unknown>;

    if (record.method === "tools/call") {
      const params = record.params;
      const toolName =
        params && typeof params === "object" && !Array.isArray(params)
          ? (params as Record<string, unknown>).name
          : undefined;

      if (typeof toolName === "string") {
        certifiedToolNames.push(toolName);
      }
    }

    if ("result" in record) {
      const result = record.result;
      const structuredContent =
        result && typeof result === "object" && !Array.isArray(result)
          ? (result as Record<string, unknown>).structuredContent
          : undefined;
      evidenceRefs.push(...collectEvidenceRefs(structuredContent));
    }

    evidenceRefs.push(...collectEvidenceRefs(record));
  }

  const uniqueToolNames = [...new Set(certifiedToolNames)];
  const uniqueEvidenceRefs = [...new Set(evidenceRefs)];

  return {
    status: certificationStatus,
    transcriptKind: "captured-splunk-mcp-jsonrpc",
    transcriptPath,
    localMcpServerRole:
      "SplunkReady MCP exposes the Agent Readiness Compiler as a certification interface for MCP clients.",
    splunkMcpServerRole:
      "The captured transcript is the Splunk MCP Server boundary: an agent invoked Splunk MCP tools, then SplunkReady certified the behavior.",
    certifiedToolNames: uniqueToolNames,
    splunkToolCallCount: certifiedToolNames.filter((toolName) => toolName.startsWith("splunk_")).length,
    includesSavedSearchExecution: uniqueToolNames.includes("splunk_run_saved_search"),
    evidenceRefs: uniqueEvidenceRefs,
    receiptPath,
    deterministicAuthority: true,
    mutation: false
  };
};

export const runMcpProofWorkflow = async (input: McpProofWorkflowInput): Promise<McpProofWorkflowResult> => {
  const transcriptPath = input.transcriptPath ?? defaultTranscriptPath;
  const transcriptOutDir = join(input.outDir, "mcp-transcript-certification");
  const summaryPath = join(input.outDir, "mcp-proof-summary.json");
  const markdownPath = join(input.outDir, "mcp-proof-summary.md");

  await mkdir(input.outDir, { recursive: true });
  await mkdir(transcriptOutDir, { recursive: true });

  const client = new McpStdioClient(input.serverPath);

  try {
    const initialize = await client.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "splunkready-mcp-proof", version: "0.0.0" }
    });
    client.notify("notifications/initialized");
    const toolsList = await client.request("tools/list");
    const resourcesList = await client.request("resources/list");
    const postureResource = await client.request("resources/read", { uri: "splunkready://certification/posture" });
    const clientConfigResource = await client.request("resources/read", { uri: "splunkready://client-config/stdio" });
    const dualServerClientConfigResource = await client.request("resources/read", {
      uri: "splunkready://client-config/splunk-and-splunkready"
    });
    const certificationLoopResource = await client.request("resources/read", {
      uri: "splunkready://workflows/splunk-mcp-certification-loop"
    });
    const promptsList = await client.request("prompts/list");
    const transcriptPrompt = await client.request("prompts/get", {
      name: "splunkready_certify_mcp_transcript",
      arguments: {
        transcriptPath,
        outDir: transcriptOutDir,
        finalAnswer: input.finalAnswer ?? defaultFinalAnswer
      }
    });
    const certificationLoopPrompt = await client.request("prompts/get", {
      name: "splunkready_splunk_mcp_certification_loop",
      arguments: {
        splunkMcpServerName: "splunk",
        transcriptPath,
        outDir: transcriptOutDir
      }
    });
    const describeResult = await client.request("tools/call", {
      name: "splunkready_describe_certification",
      arguments: {}
    });
    const transcriptResult = await client.request("tools/call", {
      name: "splunkready_certify_mcp_transcript",
      arguments: {
        transcriptPath,
        finalAnswer: input.finalAnswer ?? defaultFinalAnswer,
        outDir: transcriptOutDir,
        strictImport: true,
        requirePass: true,
        agentName: "External MCP Agent",
        agentVersion: "mcp-proof-jsonrpc-pass"
      }
    });
    const serverInfo = asRecord(initialize.serverInfo, "initialize.serverInfo");
    const tools = (Array.isArray(toolsList.tools) ? toolsList.tools : []).map((tool) => {
      const record = asRecord(tool, "tools/list tool");
      const annotations = asRecord(record.annotations, "tools/list annotations");

      return {
        name: stringFromRecord(record, "name"),
        destructiveHint: annotations.destructiveHint,
        readOnlyHint: annotations.readOnlyHint
      };
    });
    const resources = (Array.isArray(resourcesList.resources) ? resourcesList.resources : []).map((resource) => {
      const record = asRecord(resource, "resources/list resource");

      return {
        uri: stringFromRecord(record, "uri"),
        name: stringFromRecord(record, "name"),
        mimeType: stringFromRecord(record, "mimeType")
      };
    });
    const prompts = (Array.isArray(promptsList.prompts) ? promptsList.prompts : []).map((prompt) => {
      const record = asRecord(prompt, "prompts/list prompt");
      const args = Array.isArray(record.arguments) ? record.arguments : [];

      return {
        name: stringFromRecord(record, "name"),
        argumentCount: args.length
      };
    });
    const describe = extractStructuredContent(describeResult, "splunkready_describe_certification");
    const transcriptCertification = extractStructuredContent(
      transcriptResult,
      "splunkready_certify_mcp_transcript"
    );
    const certificationStatus = stringFromRecord(transcriptCertification, "status") === "PASS" ? "PASS" : "FAIL";
    const toolArtifacts = Array.isArray(transcriptCertification.artifacts)
      ? transcriptCertification.artifacts.filter((artifact): artifact is string => typeof artifact === "string")
      : [];
    const receiptPath = join(transcriptOutDir, "receipt-external-001.json");
    const splunkMcpBoundary = await readSplunkMcpBoundaryEvidence(transcriptPath, certificationStatus, receiptPath);
    const agentDrivenWorkflow: McpProofSummary["agentDrivenWorkflow"] = {
      status:
        certificationStatus === "PASS" &&
        splunkMcpBoundary.includesSavedSearchExecution &&
        splunkMcpBoundary.splunkToolCallCount > 0
          ? "PASS"
          : "FAIL",
      splunkMcpServerRole:
        "Splunk MCP performs the read-only investigation actions and returns operational data to the agent.",
      splunkReadyMcpServerRole:
        "SplunkReady MCP gives the agent posture resources, reusable prompts, and deterministic certification tools for the captured transcript.",
      stages: [
        "MCP client discovers SplunkReady certification posture and stdio configuration.",
        "Agent investigates through Splunk MCP read-only tools and preserves the JSON-RPC transcript.",
        "Agent calls SplunkReady MCP to certify the captured Splunk MCP transcript.",
        "Agent explains the generated Readiness Receipt without overriding the deterministic verdict."
      ],
      deterministicAuthority: true,
      mutation: false
    };
    const summary: McpProofSummary = {
      source: "splunkready-mcp-proof",
      status: certificationStatus,
      mutation: false,
      generatedAt,
      serverPath: displayPath(input.serverPath),
      transcriptPath,
      handshake: {
        protocolVersion: stringFromRecord(initialize, "protocolVersion"),
        serverName: stringFromRecord(serverInfo, "name"),
        instructions: stringFromRecord(initialize, "instructions")
      },
      tools,
      resources,
      prompts,
      describe,
      postureResource,
      clientConfigResource,
      dualServerClientConfigResource,
      certificationLoopResource,
      transcriptPrompt,
      certificationLoopPrompt,
      transcriptCertification,
      agentDrivenWorkflow,
      splunkMcpBoundary,
      artifacts: [summaryPath, markdownPath, ...toolArtifacts],
      nextCommands: [
        `npm run mcp`,
        `npm run splunkready -- certify-mcp-transcript --transcript ${transcriptPath} --out ${transcriptOutDir} --strict-import true --require-pass true --agent-name "External MCP Agent" --agent-version "mcp-proof-jsonrpc-pass" --json`
      ]
    };

    await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    await writeFile(markdownPath, mcpProofMarkdown(summary), "utf8");

    return {
      status: summary.status,
      outDir: input.outDir,
      artifacts: summary.artifacts,
      mutation: false,
      messages: [
        `Initialized MCP server ${summary.handshake.serverName} with ${summary.tools.length} certification tool(s), ${summary.resources.length} resource(s), and ${summary.prompts.length} prompt(s).`,
        `Certified transcript ${transcriptPath} through splunkready_certify_mcp_transcript.`
      ]
    };
  } finally {
    client.close();
  }
};
