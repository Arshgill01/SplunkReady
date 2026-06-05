import { createInterface } from "node:readline";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { z } from "zod";

import { readinessReceiptSchema } from "../schemas/core.js";
import { redactUnknownError } from "../workbench/redaction.js";
import {
  runExternalTraceCertificationFromPathWorkflow,
  runMcpTranscriptCertificationWorkflow
} from "../workflows/external-certification.js";

const protocolVersion = "2025-06-18";

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
  result: unknown;
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

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;

interface McpTool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  annotations: Record<string, unknown>;
}

interface McpResource {
  uri: string;
  name: string;
  title: string;
  description: string;
  mimeType: string;
}

interface McpPrompt {
  name: string;
  title: string;
  description: string;
  arguments: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}

const optionalName = z.string().trim().min(1).max(120).optional();

const certifyExternalTraceSchema = z
  .object({
    tracePath: z.string().trim().min(1),
    outDir: z.string().trim().min(1),
    requirePass: z.boolean().optional().default(false),
    agentName: optionalName,
    agentVersion: optionalName
  })
  .strict();

const certifyMcpTranscriptSchema = z
  .object({
    transcriptPath: z.string().trim().min(1),
    finalAnswer: z.string().trim().min(1),
    outDir: z.string().trim().min(1),
    strictImport: z.boolean().optional().default(true),
    requirePass: z.boolean().optional().default(false),
    agentName: optionalName,
    agentVersion: optionalName
  })
  .strict();

const emptyObjectSchema = z.object({}).strict();

const secretPathPattern = /(^|[/\\])(?:\.env(?:\.|$)|\.splunkready(?:\.|$))/i;

const assertNonSecretPath = (path: string): void => {
  if (secretPathPattern.test(path)) {
    throw new Error("Refusing to read or write secret environment files through the MCP server.");
  }
};

const objectSchema = (properties: Record<string, unknown>, required: string[] = []): Record<string, unknown> => ({
  type: "object",
  additionalProperties: false,
  properties,
  required
});

const stringProperty = (description: string): Record<string, unknown> => ({ type: "string", description });
const booleanProperty = (description: string, defaultValue: boolean): Record<string, unknown> => ({
  type: "boolean",
  description,
  default: defaultValue
});

export const splunkReadyMcpTools: McpTool[] = [
  {
    name: "splunkready_describe_certification",
    title: "Describe SplunkReady Certification",
    description:
      "Describe SplunkReady's deterministic certification posture, available MCP tools, and no-mutation boundary.",
    inputSchema: objectSchema({}),
    outputSchema: objectSchema({
      product: stringProperty("Product name."),
      engine: stringProperty("Certification engine name."),
      mutation: { type: "boolean", description: "Whether this tool mutates Splunk." },
      deterministicAuthority: { type: "boolean", description: "Whether deterministic rules decide pass/fail." },
      tools: { type: "array", items: { type: "string" }, description: "Available SplunkReady MCP tool names." }
    }),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true
    }
  },
  {
    name: "splunkready_certify_external_trace",
    title: "Certify External Trace",
    description:
      "Compile the fixture contract, grade a local SplunkReady trace JSON file, and write a deterministic Readiness Receipt.",
    inputSchema: objectSchema(
      {
        tracePath: stringProperty("Local path to a SplunkReady trace JSON file."),
        outDir: stringProperty("Local output directory for certification artifacts."),
        requirePass: booleanProperty("Return a tool error if the receipt is not READY.", false),
        agentName: stringProperty("Optional external agent name for the receipt."),
        agentVersion: stringProperty("Optional external agent version for the receipt.")
      },
      ["tracePath", "outDir"]
    ),
    outputSchema: objectSchema({
      status: stringProperty("PASS when the external receipt is READY, otherwise FAIL."),
      outDir: stringProperty("Output directory that received certification artifacts."),
      mutation: { type: "boolean", description: "Whether SplunkReady mutated Splunk." },
      artifacts: { type: "array", items: { type: "string" }, description: "Written artifact paths." }
    }),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false
    }
  },
  {
    name: "splunkready_certify_mcp_transcript",
    title: "Certify MCP Transcript",
    description:
      "Import a local Splunk MCP JSON-RPC transcript, append the producer final answer, and grade it into a deterministic Readiness Receipt.",
    inputSchema: objectSchema(
      {
        transcriptPath: stringProperty("Local path to a Splunk MCP JSONL transcript."),
        finalAnswer: stringProperty("Producer-provided final answer to append before grading."),
        outDir: stringProperty("Local output directory for certification artifacts."),
        strictImport: booleanProperty("Reject transcripts with skipped records or unmatched tool calls.", true),
        requirePass: booleanProperty("Return a tool error if the receipt is not READY.", false),
        agentName: stringProperty("Optional transcript-producing agent name for the receipt."),
        agentVersion: stringProperty("Optional transcript-producing agent version for the receipt.")
      },
      ["transcriptPath", "finalAnswer", "outDir"]
    ),
    outputSchema: objectSchema({
      status: stringProperty("PASS when the imported transcript receipt is READY, otherwise FAIL."),
      outDir: stringProperty("Output directory that received certification artifacts."),
      mutation: { type: "boolean", description: "Whether SplunkReady mutated Splunk." },
      artifacts: { type: "array", items: { type: "string" }, description: "Written artifact paths." }
    }),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false
    }
  }
];

export const splunkReadyMcpResources: McpResource[] = [
  {
    uri: "splunkready://certification/posture",
    name: "certification-posture",
    title: "SplunkReady Certification Posture",
    description:
      "Machine-readable product boundary: deterministic authority, advisory LLM role, no Splunk mutation, and available certification tools.",
    mimeType: "application/json"
  },
  {
    uri: "splunkready://examples/external-trace-pass",
    name: "external-trace-pass",
    title: "Passing External Trace Example",
    description: "Canonical passing SplunkReady trace JSON that MCP clients can certify with splunkready_certify_external_trace.",
    mimeType: "application/json"
  },
  {
    uri: "splunkready://examples/mcp-transcript-pass",
    name: "mcp-transcript-pass",
    title: "Passing MCP Transcript Example",
    description:
      "Passing Splunk MCP JSON-RPC transcript that MCP clients can certify with splunkready_certify_mcp_transcript.",
    mimeType: "application/jsonl"
  },
  {
    uri: "splunkready://examples/pass-receipt",
    name: "pass-receipt",
    title: "Passing Readiness Receipt Example",
    description: "Markdown Readiness Receipt example showing the deterministic proof artifact MCP clients should expect.",
    mimeType: "text/markdown"
  },
  {
    uri: "splunkready://client-config/stdio",
    name: "stdio-client-config",
    title: "Stdio MCP Client Configuration",
    description:
      "Reusable command configuration for MCP clients that want to call the local SplunkReady certification server.",
    mimeType: "application/json"
  },
  {
    uri: "splunkready://workflows/splunk-mcp-certification-loop",
    name: "splunk-mcp-certification-loop",
    title: "Splunk MCP Certification Loop",
    description:
      "Agent workflow showing how Splunk MCP investigation calls become a captured transcript and deterministic Readiness Receipt.",
    mimeType: "text/markdown"
  }
];

export const splunkReadyMcpPrompts: McpPrompt[] = [
  {
    name: "splunkready_certify_mcp_transcript",
    title: "Certify A Captured Splunk MCP Transcript",
    description:
      "Guide an MCP-capable agent to pass a captured Splunk JSON-RPC transcript through SplunkReady certification.",
    arguments: [
      {
        name: "transcriptPath",
        description: "Local path to the captured Splunk MCP JSONL transcript.",
        required: true
      },
      {
        name: "outDir",
        description: "Local output directory for the Readiness Receipt bundle.",
        required: true
      },
      {
        name: "finalAnswer",
        description: "The agent's final answer to append before grading.",
        required: true
      }
    ]
  },
  {
    name: "splunkready_capture_trace",
    title: "Capture A SplunkReady Trace",
    description:
      "Guide a developer or agent framework to emit canonical SplunkReady trace events before deterministic grading.",
    arguments: [
      {
        name: "agentName",
        description: "Name of the agent or framework producing the trace.",
        required: false
      },
      {
        name: "missionId",
        description: "Mission identifier to record in canonical SplunkReady trace events.",
        required: false
      }
    ]
  },
  {
    name: "splunkready_explain_receipt",
    title: "Explain A Readiness Receipt",
    description:
      "Guide an assistant to explain a Readiness Receipt while preserving deterministic pass/fail authority.",
    arguments: [
      {
        name: "receiptPath",
        description: "Local path to a Readiness Receipt JSON or Markdown artifact.",
        required: true
      }
    ]
  },
  {
    name: "splunkready_splunk_mcp_certification_loop",
    title: "Run A Splunk MCP Certification Loop",
    description:
      "Guide an MCP-capable agent to investigate through Splunk MCP, preserve the JSON-RPC transcript, and certify it with SplunkReady.",
    arguments: [
      {
        name: "splunkMcpServerName",
        description: "Name of the configured Splunk MCP server the agent should use for read-only investigation calls.",
        required: false
      },
      {
        name: "transcriptPath",
        description: "Local path where the MCP client should preserve the Splunk MCP JSONL transcript.",
        required: true
      },
      {
        name: "outDir",
        description: "Local output directory for the deterministic Readiness Receipt bundle.",
        required: true
      }
    ]
  }
];

const success = (id: JsonRpcId, result: unknown): JsonRpcSuccess => ({ jsonrpc: "2.0", id, result });
const error = (id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcError => ({
  jsonrpc: "2.0",
  id,
  error: data === undefined ? { code, message } : { code, message, data }
});

const toolResult = (structuredContent: Record<string, unknown>, isError = false): Record<string, unknown> => ({
  content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
  structuredContent,
  isError
});

const zodMessage = (result: z.SafeParseReturnType<unknown, unknown>): string => {
  if (result.success) {
    return "valid";
  }

  const issue = result.error.issues[0];
  const path = issue?.path.length ? issue.path.join(".") : "arguments";

  return `${path}: ${issue?.message ?? "Invalid arguments."}`;
};

const describeCertification = (): Record<string, unknown> => ({
  product: "SplunkReady",
  engine: "Agent Readiness Compiler",
  primaryArtifact: "Readiness Receipt",
  deterministicAuthority: true,
  advisoryLlmOnly: true,
  mutation: false,
  tools: splunkReadyMcpTools.map((tool) => tool.name),
  resources: splunkReadyMcpResources.map((resource) => resource.uri),
  prompts: splunkReadyMcpPrompts.map((prompt) => prompt.name)
});

const readResource = async (uri: string): Promise<Record<string, unknown>> => {
  if (uri === "splunkready://certification/posture") {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(describeCertification(), null, 2)
        }
      ]
    };
  }

  if (uri === "splunkready://examples/external-trace-pass") {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: await readFile("examples/sample-external-trace-pass.json", "utf8")
        }
      ]
    };
  }

  if (uri === "splunkready://examples/mcp-transcript-pass") {
    return {
      contents: [
        {
          uri,
          mimeType: "application/jsonl",
          text: await readFile("examples/sample-mcp-transcript-pass.jsonl", "utf8")
        }
      ]
    };
  }

  if (uri === "splunkready://examples/pass-receipt") {
    return {
      contents: [
        {
          uri,
          mimeType: "text/markdown",
          text: await readFile("examples/sample-pass-receipt.md", "utf8")
        }
      ]
    };
  }

  if (uri === "splunkready://client-config/stdio") {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              mcpServers: {
                splunkready: {
                  command: "npm",
                  args: ["run", "mcp"],
                  cwd: "/path/to/SplunkReady"
                }
              }
            },
            null,
            2
          )
        }
      ]
    };
  }

  if (uri === "splunkready://workflows/splunk-mcp-certification-loop") {
    return {
      contents: [
        {
          uri,
          mimeType: "text/markdown",
          text: [
            "# Splunk MCP Certification Loop",
            "",
            "1. Use the configured Splunk MCP Server for read-only investigation calls such as knowledge-object lookup and saved-search execution.",
            "2. Preserve the MCP JSON-RPC request/response transcript as JSONL. Do not include tokens or environment files.",
            "3. Call `splunkready_certify_mcp_transcript` with `strictImport=true` and `requirePass=true`.",
            "4. Treat the generated Readiness Receipt as the source of truth. Deterministic rules decide READY or NOT READY; LLM output may only explain the receipt.",
            "",
            "SplunkReady does not replace Splunk MCP and does not mutate Splunk. It certifies captured Splunk MCP behavior for this deployment."
          ].join("\n")
        }
      ]
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
};

const promptText = (name: string, args: Record<string, unknown>): string => {
  if (name === "splunkready_certify_mcp_transcript") {
    return [
      "Certify this captured Splunk MCP transcript with SplunkReady.",
      "",
      `Transcript path: ${String(args.transcriptPath ?? "<transcriptPath>")}`,
      `Output directory: ${String(args.outDir ?? "<outDir>")}`,
      `Final answer: ${String(args.finalAnswer ?? "<finalAnswer>")}`,
      "",
      "Call splunkready_certify_mcp_transcript with strictImport=true and requirePass=true.",
      "Use the resulting Readiness Receipt as the source of truth. Deterministic rules decide READY or NOT READY; LLM output may only explain the receipt."
    ].join("\n");
  }

  if (name === "splunkready_capture_trace") {
    return [
      "Capture a canonical SplunkReady trace for a Splunk-connected agent.",
      "",
      `Agent name: ${String(args.agentName ?? "<agentName>")}`,
      `Mission id: ${String(args.missionId ?? "mission-security-lateral-movement-readiness")}`,
      "",
      "Record each Splunk tool call, tool result, evidence ref, query ref, and final answer.",
      "Then certify the trace with splunkready_certify_external_trace. Do not use an LLM to decide pass/fail."
    ].join("\n");
  }

  if (name === "splunkready_explain_receipt") {
    return [
      "Explain this SplunkReady Readiness Receipt for an engineering reviewer.",
      "",
      `Receipt path: ${String(args.receiptPath ?? "<receiptPath>")}`,
      "",
      "Summarize the deterministic verdict, active rules, trace refs, evidence refs, and policy patch implications.",
      "Do not override or reinterpret the receipt verdict; deterministic grading is authoritative."
    ].join("\n");
  }

  if (name === "splunkready_splunk_mcp_certification_loop") {
    return [
      "Run a Splunk MCP investigation loop and certify it with SplunkReady.",
      "",
      `Splunk MCP server: ${String(args.splunkMcpServerName ?? "splunk")}`,
      `Transcript path: ${String(args.transcriptPath ?? "<transcriptPath>")}`,
      `Output directory: ${String(args.outDir ?? "<outDir>")}`,
      "",
      "Use Splunk MCP only for read-only investigation actions. Prefer saved searches and knowledge objects when the deployment exposes them.",
      "Preserve the JSON-RPC transcript of the Splunk MCP tool calls and responses.",
      "Then call splunkready_certify_mcp_transcript with strictImport=true and requirePass=true.",
      "Use the Readiness Receipt as the authoritative verdict; LLM or assistant text may only explain the deterministic result."
    ].join("\n");
  }

  throw new Error(`Unknown prompt: ${name}`);
};

const getPrompt = (name: string, args: Record<string, unknown>): Record<string, unknown> => {
  const prompt = splunkReadyMcpPrompts.find((candidate) => candidate.name === name);

  if (!prompt) {
    throw new Error(`Unknown prompt: ${name}`);
  }

  return {
    description: prompt.description,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: promptText(name, args)
        }
      }
    ]
  };
};

const callTool = async (name: string, args: unknown, env: NodeJS.ProcessEnv): Promise<Record<string, unknown>> => {
  if (name === "splunkready_describe_certification") {
    const parsed = emptyObjectSchema.safeParse(args ?? {});

    if (!parsed.success) {
      return toolResult({ status: "ERROR", message: zodMessage(parsed) }, true);
    }

    return toolResult(describeCertification());
  }

  if (name === "splunkready_certify_external_trace") {
    const parsed = certifyExternalTraceSchema.safeParse(args ?? {});

    if (!parsed.success) {
      return toolResult({ status: "ERROR", message: zodMessage(parsed) }, true);
    }

    try {
      assertNonSecretPath(parsed.data.tracePath);
      assertNonSecretPath(parsed.data.outDir);
      const result = await runExternalTraceCertificationFromPathWorkflow({
        outDir: parsed.data.outDir,
        tracePath: parsed.data.tracePath,
        requirePass: parsed.data.requirePass,
        agentName: parsed.data.agentName,
        agentVersion: parsed.data.agentVersion
      });

      return toolResult({ ...result });
    } catch (caught) {
      return toolResult({ status: "ERROR", message: redactUnknownError(caught, env) }, true);
    }
  }

  if (name === "splunkready_certify_mcp_transcript") {
    const parsed = certifyMcpTranscriptSchema.safeParse(args ?? {});

    if (!parsed.success) {
      return toolResult({ status: "ERROR", message: zodMessage(parsed) }, true);
    }

    try {
      assertNonSecretPath(parsed.data.transcriptPath);
      assertNonSecretPath(parsed.data.outDir);
      const transcript = await readFile(parsed.data.transcriptPath, "utf8");
      const result = await runMcpTranscriptCertificationWorkflow(
        {
          outDir: parsed.data.outDir,
          payload: {
            transcript,
            finalAnswer: parsed.data.finalAnswer,
            strictImport: parsed.data.strictImport,
            requirePass: parsed.data.requirePass,
            agentName: parsed.data.agentName,
            agentVersion: parsed.data.agentVersion
          }
        },
        env
      );
      const receipt = readinessReceiptSchema.parse(
        JSON.parse(await readFile(join(parsed.data.outDir, "receipt-external-001.json"), "utf8"))
      );
      const status = receipt.verdict === "READY" ? "PASS" : "FAIL";

      return toolResult({ ...result, status, outDir: parsed.data.outDir, mutation: false });
    } catch (caught) {
      return toolResult({ status: "ERROR", message: redactUnknownError(caught, env) }, true);
    }
  }

  throw new Error(`Unknown tool: ${name}`);
};

const parseRequest = (input: unknown): JsonRpcRequest | JsonRpcError => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return error(null, -32600, "Invalid Request");
  }

  const record = input as Record<string, unknown>;
  const id =
    "id" in record
      ? typeof record.id === "string" || typeof record.id === "number" || record.id === null
        ? record.id
        : null
      : undefined;

  if (record.jsonrpc !== "2.0" || typeof record.method !== "string") {
    return error(id ?? null, -32600, "Invalid Request");
  }

  return { jsonrpc: "2.0", id, method: record.method, params: record.params };
};

export const handleMcpMessage = async (
  input: unknown,
  env: NodeJS.ProcessEnv = process.env
): Promise<JsonRpcResponse | undefined> => {
  const request = parseRequest(input);

  if ("error" in request) {
    return request;
  }

  if (request.id === undefined) {
    return undefined;
  }

  if (request.method === "initialize") {
    return success(request.id, {
      protocolVersion,
      capabilities: {
        tools: { listChanged: false },
        resources: { listChanged: false },
        prompts: { listChanged: false }
      },
      serverInfo: {
        name: "splunkready",
        title: "SplunkReady Agent Readiness Compiler",
        version: "0.0.0"
      },
      instructions:
        "SplunkReady certifies Splunk-connected agent traces. Deterministic rules decide readiness; LLM and SAIA output is advisory only. Tools do not mutate Splunk."
    });
  }

  if (request.method === "notifications/initialized") {
    return undefined;
  }

  if (request.method === "tools/list") {
    return success(request.id, { tools: splunkReadyMcpTools });
  }

  if (request.method === "resources/list") {
    return success(request.id, { resources: splunkReadyMcpResources });
  }

  if (request.method === "resources/read") {
    const parsed = z
      .object({
        uri: z.string().trim().min(1)
      })
      .strict()
      .safeParse(request.params ?? {});

    if (!parsed.success) {
      return error(request.id, -32602, zodMessage(parsed));
    }

    try {
      return success(request.id, await readResource(parsed.data.uri));
    } catch (caught) {
      return error(request.id, -32602, redactUnknownError(caught, env));
    }
  }

  if (request.method === "prompts/list") {
    return success(request.id, { prompts: splunkReadyMcpPrompts });
  }

  if (request.method === "prompts/get") {
    const parsed = z
      .object({
        name: z.string().trim().min(1),
        arguments: z.record(z.unknown()).optional().default({})
      })
      .strict()
      .safeParse(request.params ?? {});

    if (!parsed.success) {
      return error(request.id, -32602, zodMessage(parsed));
    }

    try {
      return success(request.id, getPrompt(parsed.data.name, parsed.data.arguments));
    } catch (caught) {
      return error(request.id, -32602, redactUnknownError(caught, env));
    }
  }

  if (request.method === "tools/call") {
    const parsed = z
      .object({
        name: z.string().trim().min(1),
        arguments: z.unknown().optional()
      })
      .strict()
      .safeParse(request.params ?? {});

    if (!parsed.success) {
      return error(request.id, -32602, zodMessage(parsed));
    }

    try {
      return success(request.id, await callTool(parsed.data.name, parsed.data.arguments ?? {}, env));
    } catch (caught) {
      return error(request.id, -32602, redactUnknownError(caught, env));
    }
  }

  return error(request.id, -32601, `Method not found: ${request.method}`);
};

export const startStdioMcpServer = (env: NodeJS.ProcessEnv = process.env): void => {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });

  lines.on("line", (line) => {
    void (async () => {
      try {
        const response = await handleMcpMessage(JSON.parse(line), env);

        if (response) {
          process.stdout.write(`${JSON.stringify(response)}\n`);
        }
      } catch (caught) {
        const response = error(null, -32700, "Parse error", redactUnknownError(caught, env));
        process.stdout.write(`${JSON.stringify(response)}\n`);
      }
    })();
  });
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startStdioMcpServer();
}
