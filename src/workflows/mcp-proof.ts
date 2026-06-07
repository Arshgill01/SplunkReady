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

interface McpClientSessionRecord {
  direction: "request" | "notification" | "response";
  sequence: number;
  method?: string;
  id?: string | number | null;
  params?: unknown;
  result?: unknown;
  error?: unknown;
}

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
  resourceTemplates: Array<{
    uriTemplate: string;
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
  claudeDesktopClientConfigResource: Record<string, unknown>;
  cursorClientConfigResource: Record<string, unknown>;
  certificationLoopResource: Record<string, unknown>;
  compositionScorecardResource: Record<string, unknown>;
  hostedModelDiagnosticResource: Record<string, unknown>;
  receiptTemplateResource: Record<string, unknown>;
  transcriptPrompt: Record<string, unknown>;
  certificationLoopPrompt: Record<string, unknown>;
  compositionReviewPrompt: Record<string, unknown>;
  hostedModelDiagnosticPrompt: Record<string, unknown>;
  transcriptCertification: Record<string, unknown>;
  inlineTranscriptCertification: Record<string, unknown>;
  hostedModelAccess: Record<string, unknown>;
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
  mcpComposition: {
    status: "PASS" | "FAIL";
    score: number;
    servers: Array<{
      name: string;
      role: string;
      evidence: string;
      existingMcpServer: boolean;
    }>;
    checks: Array<{
      id: string;
      status: "PASS" | "FAIL";
      evidence: string;
    }>;
    deterministicAuthority: true;
    mutation: false;
  };
  clientWalkthrough: {
    source: "splunkready-mcp-client-walkthrough";
    status: "PASS" | "FAIL";
    artifactPath: string;
    markdownPath: string;
    deterministicAuthority: true;
    mutation: false;
    servers: Array<{
      name: string;
      role: string;
      existingMcpServer: boolean;
    }>;
    stages: Array<{
      id: string;
      title: string;
      server: string;
      evidence: string;
    }>;
    transcript: {
      path: string;
      splunkToolNames: string[];
      splunkToolCallCount: number;
      includesSavedSearchExecution: boolean;
      evidenceRefs: string[];
    };
    receipt: {
      path: string;
      status: "PASS" | "FAIL";
      authoritative: true;
    };
  };
  clientSession: {
    source: "splunkready-mcp-client-session";
    status: "PASS" | "FAIL";
    artifactPath: string;
    markdownPath: string;
    protocol: "stdio-jsonrpc";
    requestCount: number;
    responseCount: number;
    methods: string[];
    resourceUris: string[];
    promptNames: string[];
    toolNames: string[];
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

const stringArrayFromRecord = (record: Record<string, unknown>, key: string): string[] => {
  const value = record[key];

  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
};

class McpStdioClient {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly pending: Array<(response: JsonRpcResponse) => void> = [];
  private readonly sessionRecords: McpClientSessionRecord[] = [];
  private stdoutBuffer = "";
  private stderrBuffer = "";
  private sequence = 0;

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
    const message = { jsonrpc: "2.0", method, params };

    this.sessionRecords.push({
      direction: "notification",
      sequence: ++this.sequence,
      method,
      params
    });
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  close(): void {
    this.child.stdin.end();
    this.child.kill();
  }

  session(): McpClientSessionRecord[] {
    return [...this.sessionRecords];
  }

  private async send(message: Record<string, unknown>): Promise<JsonRpcResponse> {
    const id = typeof message.id === "string" || typeof message.id === "number" || message.id === null ? message.id : null;
    const method = typeof message.method === "string" ? message.method : undefined;

    this.sessionRecords.push({
      direction: "request",
      sequence: ++this.sequence,
      id,
      method,
      params: message.params
    });

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
        const parsed = JSON.parse(line) as JsonRpcResponse;

        this.sessionRecords.push({
          direction: "response",
          sequence: ++this.sequence,
          id: parsed.id,
          result: "result" in parsed ? parsed.result : undefined,
          error: "error" in parsed ? parsed.error : undefined
        });
        resolve(parsed);
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

Resource templates:
${summary.resourceTemplates.map((template) => `- ${template.uriTemplate} (${template.mimeType})`).join("\n")}

Templated receipt:
- splunkready://receipts/pass

Dual-server MCP client kit:
- Resource: splunkready://client-config/splunk-and-splunkready
- Existing Splunk MCP role: investigate with read-only Splunk tools
- SplunkReady MCP role: certify the captured Splunk MCP transcript

Prompts:
${summary.prompts.map((prompt) => `- ${prompt.name} arguments=${prompt.argumentCount}`).join("\n")}

Agent-driven workflow: ${summary.agentDrivenWorkflow.status}
${summary.agentDrivenWorkflow.stages.map((stage) => `- ${stage}`).join("\n")}

Transcript certification: ${stringFromRecord(summary.transcriptCertification, "status")}

Inline transcript certification: ${stringFromRecord(summary.inlineTranscriptCertification, "status")}
- Output: ${stringFromRecord(summary.inlineTranscriptCertification, "outDir")}

Hosted-model access check: ${stringFromRecord(summary.hostedModelAccess, "status")}
- Permission: ${stringFromRecord(summary.hostedModelAccess, "permissionStatus")}
- Passed tools: ${stringArrayFromRecord(summary.hostedModelAccess, "passedTools").join(", ") || "none"}
- Blocked tools: ${stringArrayFromRecord(summary.hostedModelAccess, "blockedTools").join(", ") || "none"}
- Output: ${stringFromRecord(summary.hostedModelAccess, "outDir")}

Splunk MCP boundary: ${summary.splunkMcpBoundary.status}
- Certified tool calls: ${summary.splunkMcpBoundary.certifiedToolNames.join(", ")}
- Saved-search execution: ${summary.splunkMcpBoundary.includesSavedSearchExecution ? "yes" : "no"}
- Evidence refs: ${summary.splunkMcpBoundary.evidenceRefs.join(", ")}
- Receipt: ${summary.splunkMcpBoundary.receiptPath}

MCP composition scorecard: ${summary.mcpComposition.status} (${summary.mcpComposition.score}/100)
${summary.mcpComposition.checks.map((check) => `- ${check.id}: ${check.status} - ${check.evidence}`).join("\n")}

MCP client walkthrough: ${summary.clientWalkthrough.status}
- Artifact: ${summary.clientWalkthrough.artifactPath}
- Markdown: ${summary.clientWalkthrough.markdownPath}
- Existing Splunk MCP server: ${summary.clientWalkthrough.servers.find((server) => server.name === "splunk")?.role ?? ""}
- SplunkReady role: ${summary.clientWalkthrough.servers.find((server) => server.name === "splunkready")?.role ?? ""}
${summary.clientWalkthrough.stages.map((stage) => `- ${stage.id}: ${stage.title} (${stage.server}) - ${stage.evidence}`).join("\n")}

MCP client session: ${summary.clientSession.status}
- Artifact: ${summary.clientSession.artifactPath}
- Markdown: ${summary.clientSession.markdownPath}
- Protocol: ${summary.clientSession.protocol}
- Requests: ${summary.clientSession.requestCount}
- Responses: ${summary.clientSession.responseCount}
- Methods: ${summary.clientSession.methods.join(", ")}
- Resources read: ${summary.clientSession.resourceUris.join(", ")}
- Prompts fetched: ${summary.clientSession.promptNames.join(", ")}
- Tools called: ${summary.clientSession.toolNames.join(", ")}

Receipt: ${stringFromRecord(summary.transcriptCertification, "outDir")}/receipt-external-001.json
`;

const mcpClientWalkthroughMarkdown = (walkthrough: McpProofSummary["clientWalkthrough"]): string => `# Splunk MCP Client Walkthrough

Status: ${walkthrough.status}

Mutation: ${walkthrough.mutation ? "yes" : "no"}

Deterministic authority: ${walkthrough.deterministicAuthority ? "yes" : "no"}

## Servers

${walkthrough.servers.map((server) => `- ${server.name}: ${server.role} existingMcpServer=${server.existingMcpServer}`).join("\n")}

## Stages

${walkthrough.stages.map((stage) => `- ${stage.id}: ${stage.title}\n  - Server: ${stage.server}\n  - Evidence: ${stage.evidence}`).join("\n")}

## Transcript

- Path: ${walkthrough.transcript.path}
- Splunk tools: ${walkthrough.transcript.splunkToolNames.join(", ")}
- Splunk tool calls: ${walkthrough.transcript.splunkToolCallCount}
- Saved-search execution: ${walkthrough.transcript.includesSavedSearchExecution ? "yes" : "no"}
- Evidence refs: ${walkthrough.transcript.evidenceRefs.join(", ")}

## Receipt

- Path: ${walkthrough.receipt.path}
- Status: ${walkthrough.receipt.status}
- Authoritative: ${walkthrough.receipt.authoritative ? "yes" : "no"}
`;

const mcpClientSessionMarkdown = (session: McpProofSummary["clientSession"]): string => `# SplunkReady MCP Client Session

Status: ${session.status}

Protocol: ${session.protocol}

Mutation: ${session.mutation ? "yes" : "no"}

Deterministic authority: ${session.deterministicAuthority ? "yes" : "no"}

Requests: ${session.requestCount}

Responses: ${session.responseCount}

Methods:
${session.methods.map((method) => `- ${method}`).join("\n")}

Resources:
${session.resourceUris.map((uri) => `- ${uri}`).join("\n")}

Prompts:
${session.promptNames.map((name) => `- ${name}`).join("\n")}

Tools:
${session.toolNames.map((name) => `- ${name}`).join("\n")}
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

const textFromMcpResource = (resource: Record<string, unknown>): string => {
  const contents = Array.isArray(resource.contents) ? resource.contents : [];

  return contents
    .map((content) => {
      if (!content || typeof content !== "object" || Array.isArray(content)) {
        return "";
      }

      const text = (content as Record<string, unknown>).text;

      return typeof text === "string" ? text : "";
    })
    .join("\n");
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

const buildMcpCompositionScorecard = (input: {
  dualServerClientConfigResource: Record<string, unknown>;
  resources: McpProofSummary["resources"];
  resourceTemplates: McpProofSummary["resourceTemplates"];
  prompts: McpProofSummary["prompts"];
  transcriptCertification: Record<string, unknown>;
  inlineTranscriptCertification: Record<string, unknown>;
  hostedModelAccess: Record<string, unknown>;
  agentDrivenWorkflow: McpProofSummary["agentDrivenWorkflow"];
  splunkMcpBoundary: McpProofSummary["splunkMcpBoundary"];
}): McpProofSummary["mcpComposition"] => {
  const dualConfigText = textFromMcpResource(input.dualServerClientConfigResource);
  const resourceUris = input.resources.map((resource) => resource.uri);
  const resourceTemplates = input.resourceTemplates.map((template) => template.uriTemplate);
  const promptNames = input.prompts.map((prompt) => prompt.name);
  const certificationStatus =
    stringFromRecord(input.transcriptCertification, "status") === "PASS" ? "PASS" : "FAIL";
  const inlineCertificationStatus =
    stringFromRecord(input.inlineTranscriptCertification, "status") === "PASS" ? "PASS" : "FAIL";
  const hostedModelAccessStatus =
    stringFromRecord(input.hostedModelAccess, "status") === "PASS" ? "PASS" : "FAIL";

  const checks: McpProofSummary["mcpComposition"]["checks"] = [
    {
      id: "dual-server-client-config",
      status:
        dualConfigText.includes('"splunk"') &&
        dualConfigText.includes('"splunkready"') &&
        dualConfigText.includes("splunkready_certify_mcp_transcript")
          ? "PASS"
          : "FAIL",
      evidence: "Client config includes separate splunk and splunkready MCP servers."
    },
    {
      id: "external-mcp-client-configs",
      status:
        resourceUris.includes("splunkready://client-config/claude-desktop") &&
        resourceUris.includes("splunkready://client-config/cursor")
          ? "PASS"
          : "FAIL",
      evidence: "Claude Desktop and Cursor MCP client templates are discoverable as credential-free resources."
    },
    {
      id: "discoverable-resources-and-prompts",
      status:
        resourceUris.includes("splunkready://client-config/splunk-and-splunkready") &&
        resourceUris.includes("splunkready://client-config/claude-desktop") &&
        resourceUris.includes("splunkready://client-config/cursor") &&
        resourceUris.includes("splunkready://workflows/mcp-composition-scorecard") &&
        resourceUris.includes("splunkready://workflows/hosted-model-diagnostic") &&
        resourceTemplates.includes("splunkready://receipts/{receiptId}") &&
        promptNames.includes("splunkready_splunk_mcp_certification_loop") &&
        promptNames.includes("splunkready_mcp_composition_review") &&
        promptNames.includes("splunkready_hosted_model_diagnostic")
          ? "PASS"
          : "FAIL",
      evidence: `${resourceUris.length} resources, ${resourceTemplates.length} resource template(s), and ${promptNames.length} prompts expose the composed workflow.`
    },
    {
      id: "existing-splunk-mcp-boundary",
      status: input.splunkMcpBoundary.splunkToolCallCount > 0 ? "PASS" : "FAIL",
      evidence: `${input.splunkMcpBoundary.splunkToolCallCount} captured splunk_* tool calls are certified.`
    },
    {
      id: "saved-search-evidence",
      status:
        input.splunkMcpBoundary.includesSavedSearchExecution &&
        input.splunkMcpBoundary.evidenceRefs.length > 0
          ? "PASS"
          : "FAIL",
      evidence: `${input.splunkMcpBoundary.evidenceRefs.length} evidence refs from saved-search output.`
    },
    {
      id: "readiness-receipt-authority",
      status:
        certificationStatus === "PASS" &&
        inlineCertificationStatus === "PASS" &&
        input.agentDrivenWorkflow.deterministicAuthority &&
        input.splunkMcpBoundary.deterministicAuthority
          ? "PASS"
          : "FAIL",
      evidence: `Path transcript certification returned ${certificationStatus}; inline transcript certification returned ${inlineCertificationStatus}; deterministic rules remain authoritative.`
    },
    {
      id: "no-splunkready-mutation",
      status:
        input.agentDrivenWorkflow.mutation === false &&
        input.splunkMcpBoundary.mutation === false &&
        input.transcriptCertification.mutation === false &&
        input.inlineTranscriptCertification.mutation === false &&
        input.hostedModelAccess.mutation === false
          ? "PASS"
          : "FAIL",
      evidence: "SplunkReady certification reports mutation=false across workflow, boundary, path transcript, inline transcript, hosted-model access, and receipt artifacts."
    },
    {
      id: "hosted-model-advisory-access",
      status: hostedModelAccessStatus,
      evidence: `Hosted-model access check returned ${hostedModelAccessStatus}; SAIA remains advisory and deterministic rules remain authoritative.`
    }
  ];
  const passed = checks.filter((check) => check.status === "PASS").length;

  return {
    status: passed === checks.length ? "PASS" : "FAIL",
    score: Math.round((passed / checks.length) * 100),
    servers: [
      {
        name: "splunk",
        role: "Existing Splunk MCP server for read-only investigation and operational evidence retrieval.",
        evidence: input.splunkMcpBoundary.certifiedToolNames.join(", "),
        existingMcpServer: true
      },
      {
        name: "splunkready",
        role: "SplunkReady MCP server for posture discovery, reusable prompts, and deterministic transcript certification.",
        evidence: "splunkready_certify_mcp_transcript generated the Readiness Receipt.",
        existingMcpServer: false
      }
    ],
    checks,
    deterministicAuthority: true,
    mutation: false
  };
};

const buildMcpClientWalkthrough = (input: {
  artifactPath: string;
  markdownPath: string;
  transcriptPath: string;
  splunkMcpBoundary: McpProofSummary["splunkMcpBoundary"];
  transcriptCertification: Record<string, unknown>;
}): McpProofSummary["clientWalkthrough"] => {
  const certificationStatus =
    stringFromRecord(input.transcriptCertification, "status") === "PASS" ? "PASS" : "FAIL";
  const hasSplunkEvidence =
    input.splunkMcpBoundary.splunkToolCallCount > 0 &&
    input.splunkMcpBoundary.includesSavedSearchExecution &&
    input.splunkMcpBoundary.evidenceRefs.length > 0;
  const status = certificationStatus === "PASS" && hasSplunkEvidence ? "PASS" : "FAIL";

  return {
    source: "splunkready-mcp-client-walkthrough",
    status,
    artifactPath: input.artifactPath,
    markdownPath: input.markdownPath,
    deterministicAuthority: true,
    mutation: false,
    servers: [
      {
        name: "splunk",
        role: "Existing Splunk MCP Server performs the read-only investigation and returns deployment evidence.",
        existingMcpServer: true
      },
      {
        name: "splunkready",
        role: "SplunkReady MCP certifies the captured Splunk MCP transcript into a deterministic Readiness Receipt.",
        existingMcpServer: false
      }
    ],
    stages: [
      {
        id: "client-discovers-two-servers",
        title: "MCP client is configured with existing Splunk MCP plus SplunkReady MCP",
        server: "client",
        evidence: "splunkready://client-config/splunk-and-splunkready"
      },
      {
        id: "splunk-mcp-investigates",
        title: "Agent investigates through read-only Splunk MCP tools",
        server: "splunk",
        evidence: input.splunkMcpBoundary.certifiedToolNames.join(", ")
      },
      {
        id: "transcript-preserved",
        title: "MCP JSON-RPC request/response transcript is preserved without secrets",
        server: "client",
        evidence: input.transcriptPath
      },
      {
        id: "splunkready-certifies",
        title: "SplunkReady certifies the captured transcript",
        server: "splunkready",
        evidence: input.splunkMcpBoundary.receiptPath
      },
      {
        id: "receipt-is-authoritative",
        title: "Readiness Receipt is the authoritative verdict",
        server: "splunkready",
        evidence: `certificationStatus=${certificationStatus}; deterministicAuthority=true; mutation=false`
      }
    ],
    transcript: {
      path: input.transcriptPath,
      splunkToolNames: input.splunkMcpBoundary.certifiedToolNames,
      splunkToolCallCount: input.splunkMcpBoundary.splunkToolCallCount,
      includesSavedSearchExecution: input.splunkMcpBoundary.includesSavedSearchExecution,
      evidenceRefs: input.splunkMcpBoundary.evidenceRefs
    },
    receipt: {
      path: input.splunkMcpBoundary.receiptPath,
      status: certificationStatus,
      authoritative: true
    }
  };
};

const paramsRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
};

const buildMcpClientSession = (
  records: McpClientSessionRecord[],
  artifactPath: string,
  markdownPath: string
): McpProofSummary["clientSession"] => {
  const requestRecords = records.filter((record) => record.direction === "request");
  const responseRecords = records.filter((record) => record.direction === "response");
  const methods = [...new Set(requestRecords.map((record) => record.method).filter((method): method is string => Boolean(method)))];
  const resourceUris = [
    ...new Set(
      requestRecords
        .filter((record) => record.method === "resources/read")
        .map((record) => paramsRecord(record.params).uri)
        .filter((uri): uri is string => typeof uri === "string")
    )
  ];
  const promptNames = [
    ...new Set(
      requestRecords
        .filter((record) => record.method === "prompts/get")
        .map((record) => paramsRecord(record.params).name)
        .filter((name): name is string => typeof name === "string")
    )
  ];
  const toolNames = [
    ...new Set(
      requestRecords
        .filter((record) => record.method === "tools/call")
        .map((record) => paramsRecord(record.params).name)
        .filter((name): name is string => typeof name === "string")
    )
  ];
  const status =
    methods.includes("initialize") &&
    methods.includes("tools/list") &&
    methods.includes("resources/list") &&
    methods.includes("resources/templates/list") &&
    methods.includes("prompts/list") &&
    resourceUris.includes("splunkready://client-config/splunk-and-splunkready") &&
    resourceUris.includes("splunkready://client-config/claude-desktop") &&
    resourceUris.includes("splunkready://client-config/cursor") &&
    resourceUris.includes("splunkready://receipts/pass") &&
    resourceUris.includes("splunkready://workflows/hosted-model-diagnostic") &&
    promptNames.includes("splunkready_splunk_mcp_certification_loop") &&
    promptNames.includes("splunkready_hosted_model_diagnostic") &&
    toolNames.includes("splunkready_certify_mcp_transcript") &&
    toolNames.includes("splunkready_certify_mcp_transcript_content") &&
    toolNames.includes("splunkready_check_hosted_model_access")
      ? "PASS"
      : "FAIL";

  return {
    source: "splunkready-mcp-client-session",
    status,
    artifactPath,
    markdownPath,
    protocol: "stdio-jsonrpc",
    requestCount: requestRecords.length,
    responseCount: responseRecords.length,
    methods,
    resourceUris,
    promptNames,
    toolNames,
    deterministicAuthority: true,
    mutation: false
  };
};

export const runMcpProofWorkflow = async (input: McpProofWorkflowInput): Promise<McpProofWorkflowResult> => {
  const transcriptPath = input.transcriptPath ?? defaultTranscriptPath;
  const transcriptOutDir = join(input.outDir, "mcp-transcript-certification");
  const inlineTranscriptOutDir = join(input.outDir, "mcp-inline-transcript-certification");
  const hostedModelAccessOutDir = join(input.outDir, "mcp-hosted-model-access");
  const summaryPath = join(input.outDir, "mcp-proof-summary.json");
  const markdownPath = join(input.outDir, "mcp-proof-summary.md");
  const clientWalkthroughPath = join(input.outDir, "mcp-client-walkthrough.json");
  const clientWalkthroughMarkdownPath = join(input.outDir, "mcp-client-walkthrough.md");
  const clientSessionPath = join(input.outDir, "mcp-client-session.jsonl");
  const clientSessionMarkdownPath = join(input.outDir, "mcp-client-session.md");

  await mkdir(input.outDir, { recursive: true });
  await mkdir(transcriptOutDir, { recursive: true });
  await mkdir(inlineTranscriptOutDir, { recursive: true });
  await mkdir(hostedModelAccessOutDir, { recursive: true });

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
    const resourceTemplatesList = await client.request("resources/templates/list");
    const postureResource = await client.request("resources/read", { uri: "splunkready://certification/posture" });
    const clientConfigResource = await client.request("resources/read", { uri: "splunkready://client-config/stdio" });
    const dualServerClientConfigResource = await client.request("resources/read", {
      uri: "splunkready://client-config/splunk-and-splunkready"
    });
    const claudeDesktopClientConfigResource = await client.request("resources/read", {
      uri: "splunkready://client-config/claude-desktop"
    });
    const cursorClientConfigResource = await client.request("resources/read", {
      uri: "splunkready://client-config/cursor"
    });
    const certificationLoopResource = await client.request("resources/read", {
      uri: "splunkready://workflows/splunk-mcp-certification-loop"
    });
    const compositionScorecardResource = await client.request("resources/read", {
      uri: "splunkready://workflows/mcp-composition-scorecard"
    });
    const hostedModelDiagnosticResource = await client.request("resources/read", {
      uri: "splunkready://workflows/hosted-model-diagnostic"
    });
    const receiptTemplateResource = await client.request("resources/read", { uri: "splunkready://receipts/pass" });
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
    const compositionReviewPrompt = await client.request("prompts/get", {
      name: "splunkready_mcp_composition_review",
      arguments: {
        proofSummaryPath: summaryPath
      }
    });
    const hostedModelDiagnosticPrompt = await client.request("prompts/get", {
      name: "splunkready_hosted_model_diagnostic",
      arguments: {
        outDir: hostedModelAccessOutDir,
        mode: "fixture"
      }
    });
    const describeResult = await client.request("tools/call", {
      name: "splunkready_describe_certification",
      arguments: {}
    });
    const transcriptContent = await readFile(transcriptPath, "utf8");
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
    const inlineTranscriptResult = await client.request("tools/call", {
      name: "splunkready_certify_mcp_transcript_content",
      arguments: {
        transcript: transcriptContent,
        finalAnswer: input.finalAnswer ?? defaultFinalAnswer,
        outDir: inlineTranscriptOutDir,
        strictImport: true,
        requirePass: true,
        agentName: "Inline MCP Agent",
        agentVersion: "mcp-proof-inline-jsonrpc-pass"
      }
    });
    const hostedModelAccessResult = await client.request("tools/call", {
      name: "splunkready_check_hosted_model_access",
      arguments: {
        outDir: hostedModelAccessOutDir,
        mode: "fixture",
        requirePass: true
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
    const resourceTemplates = (
      Array.isArray(resourceTemplatesList.resourceTemplates) ? resourceTemplatesList.resourceTemplates : []
    ).map((template) => {
      const record = asRecord(template, "resources/templates/list template");

      return {
        uriTemplate: stringFromRecord(record, "uriTemplate"),
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
    const inlineTranscriptCertification = extractStructuredContent(
      inlineTranscriptResult,
      "splunkready_certify_mcp_transcript_content"
    );
    const hostedModelAccess = extractStructuredContent(
      hostedModelAccessResult,
      "splunkready_check_hosted_model_access"
    );
    const certificationStatus = stringFromRecord(transcriptCertification, "status") === "PASS" ? "PASS" : "FAIL";
    const inlineCertificationStatus =
      stringFromRecord(inlineTranscriptCertification, "status") === "PASS" ? "PASS" : "FAIL";
    const hostedModelAccessStatus = stringFromRecord(hostedModelAccess, "status") === "PASS" ? "PASS" : "FAIL";
    const toolArtifacts = Array.isArray(transcriptCertification.artifacts)
      ? transcriptCertification.artifacts.filter((artifact): artifact is string => typeof artifact === "string")
      : [];
    const inlineToolArtifacts = Array.isArray(inlineTranscriptCertification.artifacts)
      ? inlineTranscriptCertification.artifacts.filter((artifact): artifact is string => typeof artifact === "string")
      : [];
    const hostedModelAccessArtifacts = Array.isArray(hostedModelAccess.artifacts)
      ? hostedModelAccess.artifacts.filter((artifact): artifact is string => typeof artifact === "string")
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
    const mcpComposition = buildMcpCompositionScorecard({
      dualServerClientConfigResource,
      resources,
      resourceTemplates,
      prompts,
      transcriptCertification,
      inlineTranscriptCertification,
      hostedModelAccess,
      agentDrivenWorkflow,
      splunkMcpBoundary
    });
    const clientWalkthrough = buildMcpClientWalkthrough({
      artifactPath: clientWalkthroughPath,
      markdownPath: clientWalkthroughMarkdownPath,
      transcriptPath,
      splunkMcpBoundary,
      transcriptCertification
    });
    const clientSession = buildMcpClientSession(client.session(), clientSessionPath, clientSessionMarkdownPath);
    const summary: McpProofSummary = {
      source: "splunkready-mcp-proof",
      status:
        certificationStatus === "PASS" && inlineCertificationStatus === "PASS" && hostedModelAccessStatus === "PASS"
          ? "PASS"
          : "FAIL",
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
      resourceTemplates,
      prompts,
      describe,
      postureResource,
      clientConfigResource,
      dualServerClientConfigResource,
      claudeDesktopClientConfigResource,
      cursorClientConfigResource,
      certificationLoopResource,
      compositionScorecardResource,
      hostedModelDiagnosticResource,
      receiptTemplateResource,
      transcriptPrompt,
      certificationLoopPrompt,
      compositionReviewPrompt,
      hostedModelDiagnosticPrompt,
      transcriptCertification,
      inlineTranscriptCertification,
      hostedModelAccess,
      agentDrivenWorkflow,
      splunkMcpBoundary,
      mcpComposition,
      clientWalkthrough,
      clientSession,
      artifacts: [
        summaryPath,
        markdownPath,
        clientWalkthroughPath,
        clientWalkthroughMarkdownPath,
        clientSessionPath,
        clientSessionMarkdownPath,
        ...toolArtifacts,
        ...inlineToolArtifacts,
        ...hostedModelAccessArtifacts
      ],
      nextCommands: [
        `npm run mcp`,
        `npm run splunkready -- certify-mcp-transcript --transcript ${transcriptPath} --out ${transcriptOutDir} --strict-import true --require-pass true --agent-name "External MCP Agent" --agent-version "mcp-proof-jsonrpc-pass" --json`
      ]
    };

    await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    await writeFile(markdownPath, mcpProofMarkdown(summary), "utf8");
    await writeFile(clientWalkthroughPath, `${JSON.stringify(clientWalkthrough, null, 2)}\n`, "utf8");
    await writeFile(clientWalkthroughMarkdownPath, mcpClientWalkthroughMarkdown(clientWalkthrough), "utf8");
    await writeFile(clientSessionPath, `${client.session().map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
    await writeFile(clientSessionMarkdownPath, mcpClientSessionMarkdown(clientSession), "utf8");

    return {
      status: summary.status,
      outDir: input.outDir,
      artifacts: summary.artifacts,
      mutation: false,
      messages: [
        `Initialized MCP server ${summary.handshake.serverName} with ${summary.tools.length} certification tool(s), ${summary.resources.length} resource(s), and ${summary.prompts.length} prompt(s).`,
        `Discovered ${summary.resourceTemplates.length} MCP resource template(s) and read splunkready://receipts/pass.`,
        `Certified transcript ${transcriptPath} through splunkready_certify_mcp_transcript and splunkready_certify_mcp_transcript_content.`,
        "Checked hosted-model SAIA access through splunkready_check_hosted_model_access in fixture mode."
      ]
    };
  } finally {
    client.close();
  }
};
