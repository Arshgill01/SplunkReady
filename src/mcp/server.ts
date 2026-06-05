import { createInterface } from "node:readline";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { z } from "zod";

import { runExternalTraceCertificationFromCli } from "../cli.js";
import { readinessReceiptSchema } from "../schemas/core.js";
import { redactUnknownError } from "../workbench/redaction.js";
import { runMcpTranscriptCertificationWorkflow } from "../workflows/external-certification.js";

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
  tools: splunkReadyMcpTools.map((tool) => tool.name)
});

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
      const result = await runExternalTraceCertificationFromCli(
        {
          outDir: parsed.data.outDir,
          tracePath: parsed.data.tracePath,
          requirePass: parsed.data.requirePass,
          agentName: parsed.data.agentName,
          agentVersion: parsed.data.agentVersion
        },
        env
      );

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
      capabilities: { tools: { listChanged: false } },
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
