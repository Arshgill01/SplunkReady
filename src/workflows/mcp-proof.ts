import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

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
  describe: Record<string, unknown>;
  transcriptCertification: Record<string, unknown>;
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

Transcript certification: ${stringFromRecord(summary.transcriptCertification, "status")}

Receipt: ${stringFromRecord(summary.transcriptCertification, "outDir")}/receipt-external-001.json
`;

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
    const describe = extractStructuredContent(describeResult, "splunkready_describe_certification");
    const transcriptCertification = extractStructuredContent(
      transcriptResult,
      "splunkready_certify_mcp_transcript"
    );
    const toolArtifacts = Array.isArray(transcriptCertification.artifacts)
      ? transcriptCertification.artifacts.filter((artifact): artifact is string => typeof artifact === "string")
      : [];
    const summary: McpProofSummary = {
      source: "splunkready-mcp-proof",
      status: stringFromRecord(transcriptCertification, "status") === "PASS" ? "PASS" : "FAIL",
      mutation: false,
      generatedAt,
      serverPath: input.serverPath,
      transcriptPath,
      handshake: {
        protocolVersion: stringFromRecord(initialize, "protocolVersion"),
        serverName: stringFromRecord(serverInfo, "name"),
        instructions: stringFromRecord(initialize, "instructions")
      },
      tools,
      describe,
      transcriptCertification,
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
        `Initialized MCP server ${summary.handshake.serverName} with ${summary.tools.length} certification tool(s).`,
        `Certified transcript ${transcriptPath} through splunkready_certify_mcp_transcript.`
      ]
    };
  } finally {
    client.close();
  }
};
