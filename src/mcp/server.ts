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
import { runHostedModelDiagnosticWorkflow } from "../workflows/hosted-model-actions.js";

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

interface McpResourceTemplate {
  uriTemplate: string;
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

const certifyMcpTranscriptContentSchema = z
  .object({
    transcript: z.string().trim().min(1),
    finalAnswer: z.string().trim().min(1),
    outDir: z.string().trim().min(1),
    strictImport: z.boolean().optional().default(true),
    requirePass: z.boolean().optional().default(false),
    agentName: optionalName,
    agentVersion: optionalName
  })
  .strict();

const hostedModelDiagnosticSchema = z
  .object({
    outDir: z.string().trim().min(1),
    mode: z.enum(["fixture", "live"]).optional().default("fixture"),
    fixturePath: z.string().trim().min(1).optional(),
    missionPath: z.string().trim().min(1).optional(),
    requirePass: z.boolean().optional().default(false)
  })
  .strict();

const emptyObjectSchema = z.object({}).strict();

const secretPathPattern = /(^|[/\\])(?:\.env(?:\.|$)|\.splunkready(?:\.|$))/i;
const inlineSecretPattern = /\b(?:authorization|bearer|api[_-]?key|access[_-]?token|refresh[_-]?token|password|splunk_mcp_token)\b/i;

const assertNonSecretPath = (path: string): void => {
  if (secretPathPattern.test(path)) {
    throw new Error("Refusing to read or write secret environment files through the MCP server.");
  }
};

const assertNoInlineSecrets = (input: string): void => {
  if (inlineSecretPattern.test(input)) {
    throw new Error("Refusing to certify inline MCP transcript content that appears to contain secrets.");
  }
};

const recordFromUnknown = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

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
  },
  {
    name: "splunkready_certify_mcp_transcript_content",
    title: "Certify Inline MCP Transcript",
    description:
      "Certify Splunk MCP JSON-RPC transcript content supplied directly by an MCP client and write a deterministic Readiness Receipt.",
    inputSchema: objectSchema(
      {
        transcript: stringProperty("Splunk MCP JSONL transcript content. Do not include tokens or environment files."),
        finalAnswer: stringProperty("Producer-provided final answer to append before grading."),
        outDir: stringProperty("Local output directory for certification artifacts."),
        strictImport: booleanProperty("Reject transcripts with skipped records or unmatched tool calls.", true),
        requirePass: booleanProperty("Return a tool error if the receipt is not READY.", false),
        agentName: stringProperty("Optional transcript-producing agent name for the receipt."),
        agentVersion: stringProperty("Optional transcript-producing agent version for the receipt.")
      },
      ["transcript", "finalAnswer", "outDir"]
    ),
    outputSchema: objectSchema({
      status: stringProperty("PASS when the inline transcript receipt is READY, otherwise FAIL."),
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
    name: "splunkready_check_hosted_model_access",
    title: "Check Hosted Model Access",
    description:
      "Run SplunkReady's hosted-model diagnostic to prove SAIA generate/explain/optimize/ask access is available or honestly BLOCKED.",
    inputSchema: objectSchema(
      {
        outDir: stringProperty("Local output directory for hosted-model diagnostic artifacts."),
        mode: { type: "string", enum: ["fixture", "live"], default: "fixture", description: "Use fixture for public proof or live for operator-owned SAIA checks." },
        fixturePath: stringProperty("Optional fixture adapter path for fixture mode."),
        missionPath: stringProperty("Optional mission definition path."),
        requirePass: booleanProperty("Return a tool error if hosted-model access is not PASS.", false)
      },
      ["outDir"]
    ),
    outputSchema: objectSchema({
      status: stringProperty("PASS when SAIA hosted-model access is available; BLOCKED otherwise."),
      blockerClass: stringProperty("Stable hosted-model blocker class, or NONE when the diagnostic passes."),
      permissionStatus: stringProperty("OK or BLOCKED permission result from the diagnostic."),
      permissionBlockerClass: stringProperty("Stable hosted-model blocker class from the permission block."),
      outDir: stringProperty("Output directory that received hosted-model diagnostic artifacts."),
      mutation: { type: "boolean", description: "Whether SplunkReady mutated Splunk." },
      requiredTools: { type: "array", items: { type: "string" }, description: "Hosted-model tools required by the diagnostic." },
      availableTools: { type: "array", items: { type: "string" }, description: "Hosted-model tools available to the current adapter." },
      missingTools: { type: "array", items: { type: "string" }, description: "Hosted-model tools missing or blocked for the current adapter." },
      remediation: {
        type: "object",
        description: "Secret-safe remediation packet with blocker evidence, operator checks, and rerun command."
      },
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
    uri: "splunkready://client-config/splunk-and-splunkready",
    name: "dual-server-client-config",
    title: "Splunk MCP + SplunkReady MCP Client Configuration",
    description:
      "Credential-free MCP client template that composes an operator-provided Splunk MCP server with SplunkReady certification.",
    mimeType: "application/json"
  },
  {
    uri: "splunkready://client-config/claude-desktop",
    name: "claude-desktop-client-config",
    title: "Claude Desktop MCP Client Configuration",
    description:
      "Credential-free Claude Desktop template for composing an operator-provided Splunk MCP server with SplunkReady certification.",
    mimeType: "application/json"
  },
  {
    uri: "splunkready://client-config/cursor",
    name: "cursor-client-config",
    title: "Cursor MCP Client Configuration",
    description:
      "Credential-free Cursor template for composing an operator-provided Splunk MCP server with SplunkReady certification.",
    mimeType: "application/json"
  },
  {
    uri: "splunkready://workflows/splunk-mcp-certification-loop",
    name: "splunk-mcp-certification-loop",
    title: "Splunk MCP Certification Loop",
    description:
      "Agent workflow showing how Splunk MCP investigation calls become a captured transcript and deterministic Readiness Receipt.",
    mimeType: "text/markdown"
  },
  {
    uri: "splunkready://workflows/mcp-composition-scorecard",
    name: "mcp-composition-scorecard",
    title: "MCP Composition Scorecard",
    description:
      "Checklist for proving an MCP client composed an existing Splunk MCP server with SplunkReady certification.",
    mimeType: "text/markdown"
  },
  {
    uri: "splunkready://workflows/hosted-model-diagnostic",
    name: "hosted-model-diagnostic",
    title: "Hosted Model Diagnostic",
    description:
      "Agent workflow for proving SAIA generate/explain/optimize/ask access as advisory evidence without making hosted-model output authoritative.",
    mimeType: "text/markdown"
  }
];

export const splunkReadyMcpResourceTemplates: McpResourceTemplate[] = [
  {
    uriTemplate: "splunkready://receipts/{receiptId}",
    name: "readiness-receipt-by-id",
    title: "Readiness Receipt By ID",
    description:
      "Templated Readiness Receipt resource for MCP clients that need to fetch a named receipt artifact without using local file paths.",
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
  },
  {
    name: "splunkready_mcp_composition_review",
    title: "Review MCP Composition Evidence",
    description:
      "Guide an MCP-capable reviewer to verify that a proof uses existing Splunk MCP behavior plus SplunkReady certification.",
    arguments: [
      {
        name: "proofSummaryPath",
        description: "Local path to the generated mcp-proof-summary.json artifact.",
        required: true
      }
    ]
  },
  {
    name: "splunkready_hosted_model_diagnostic",
    title: "Check SAIA Hosted Model Access",
    description:
      "Guide an MCP-capable agent to run the hosted-model access diagnostic while preserving deterministic authority.",
    arguments: [
      {
        name: "outDir",
        description: "Local output directory for hosted-model diagnostic artifacts.",
        required: true
      },
      {
        name: "mode",
        description: "Use fixture for public proof or live for operator-owned SAIA checks.",
        required: false
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
  resourceTemplates: splunkReadyMcpResourceTemplates.map((template) => template.uriTemplate),
  prompts: splunkReadyMcpPrompts.map((prompt) => prompt.name)
});

const splunkReadyClientConfig = (): Record<string, unknown> => ({
  mcpServers: {
    splunkready: {
      command: "npm",
      args: ["run", "mcp"],
      cwd: "/path/to/SplunkReady"
    }
  }
});

const dualServerClientConfig = (): Record<string, unknown> => ({
  mcpServers: {
    splunk: {
      description:
        "Operator-provided Splunk MCP Server. Keep credentials in the MCP client or environment, not in captured transcripts.",
      command: "<existing-splunk-mcp-server-command>",
      args: ["<existing-splunk-mcp-server-args>"],
      env: {
        SPLUNK_MCP_URL: "${SPLUNKREADY_SPLUNK_MCP_URL}",
        SPLUNK_MCP_TOKEN: "${SPLUNKREADY_SPLUNK_MCP_TOKEN}"
      }
    },
    splunkready: {
      description: "Local SplunkReady certification server for deterministic Readiness Receipts.",
      command: "npm",
      args: ["run", "mcp"],
      cwd: "/path/to/SplunkReady"
    }
  },
  workflow: {
    investigateWith: "splunk",
    certifyWith: "splunkready",
    capture: "Preserve the Splunk MCP JSON-RPC request/response transcript as JSONL without tokens or environment files.",
    certificationTool: "splunkready_certify_mcp_transcript",
    readOnlySplunkTools: ["splunk_get_knowledge_objects", "splunk_run_saved_search"],
    deterministicAuthority: true,
    mutation: false
  }
});

const sourceCloneMcpServerConfig = (): Record<string, unknown> => ({
  command: "npm",
  args: ["run", "mcp"],
  cwd: "/path/to/SplunkReady",
  env: {
    NO_COLOR: "1"
  }
});

const claudeDesktopClientConfig = (): Record<string, unknown> => ({
  mcpServers: {
    splunk: {
      description:
        "Existing Splunk MCP Server. Replace the command/args with the operator-approved Splunk MCP launch command; keep credentials in the operator environment.",
      command: "<existing-splunk-mcp-server-command>",
      args: ["<existing-splunk-mcp-server-args>"],
      env: {
        SPLUNK_MCP_URL: "${SPLUNKREADY_SPLUNK_MCP_URL}",
        SPLUNK_MCP_TOKEN: "${SPLUNKREADY_SPLUNK_MCP_TOKEN}"
      }
    },
    splunkready: {
      description:
        "SplunkReady Agent Readiness Compiler from a source clone. Replace cwd with the checked-out repository path until the next npm package release includes `splunkready mcp`.",
      ...sourceCloneMcpServerConfig()
    }
  },
  workflow: {
    useSplunkFor: "Read-only investigation through the existing Splunk MCP server.",
    useSplunkReadyFor:
      "Deterministic certification of the captured Splunk MCP transcript into a Readiness Receipt.",
    certificationPrompt: "splunkready_splunk_mcp_certification_loop",
    certificationTool: "splunkready_certify_mcp_transcript_content",
    hostedModelDiagnosticTool: "splunkready_check_hosted_model_access",
    deterministicAuthority: true,
    mutation: false
  }
});

const cursorClientConfig = (): Record<string, unknown> => ({
  mcpServers: {
    splunk: {
      description:
        "Existing Splunk MCP Server. Replace this placeholder with the operator-approved Splunk MCP command and keep tokens outside captured transcripts.",
      command: "<existing-splunk-mcp-server-command>",
      args: ["<existing-splunk-mcp-server-args>"],
      env: {
        SPLUNK_MCP_URL: "${SPLUNKREADY_SPLUNK_MCP_URL}",
        SPLUNK_MCP_TOKEN: "${SPLUNKREADY_SPLUNK_MCP_TOKEN}"
      }
    },
    splunkready: {
      description:
        "SplunkReady certification server for receipts, resources, prompts, and no-mutation readiness checks from a source clone.",
      ...sourceCloneMcpServerConfig()
    }
  },
  workflow: {
    investigateWith: "splunk",
    certifyWith: "splunkready",
    preserveTranscript: "Store Splunk MCP JSON-RPC request/response lines without env files, bearer tokens, or passwords.",
    certificationPrompt: "splunkready_splunk_mcp_certification_loop",
    certificationTool: "splunkready_certify_mcp_transcript_content",
    deterministicAuthority: true,
    mutation: false
  }
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

  if (uri === "splunkready://receipts/pass") {
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
          text: JSON.stringify(splunkReadyClientConfig(), null, 2)
        }
      ]
    };
  }

  if (uri === "splunkready://client-config/splunk-and-splunkready") {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(dualServerClientConfig(), null, 2)
        }
      ]
    };
  }

  if (uri === "splunkready://client-config/claude-desktop") {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(claudeDesktopClientConfig(), null, 2)
        }
      ]
    };
  }

  if (uri === "splunkready://client-config/cursor") {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(cursorClientConfig(), null, 2)
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
            "Configure two MCP servers in the client: `splunk` for the existing Splunk MCP Server and `splunkready` for deterministic certification.",
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

  if (uri === "splunkready://workflows/mcp-composition-scorecard") {
    return {
      contents: [
        {
          uri,
          mimeType: "text/markdown",
          text: [
            "# MCP Composition Scorecard",
            "",
            "A competitive MCP proof should show composition, not replacement.",
            "Required evidence:",
            "1. The MCP client config contains both an existing Splunk MCP server named `splunk` and a local `splunkready` MCP server.",
            "2. The transcript contains read-only `splunk_*` tool calls produced by the Splunk MCP server.",
            "3. The transcript includes deployment evidence, preferably saved-search output with event refs.",
            "4. SplunkReady MCP certifies the captured transcript into a Readiness Receipt.",
            "5. Deterministic rules decide READY or NOT READY; LLM, SAIA, or assistant text may only explain.",
            "6. SplunkReady reports `mutation=false` and does not mutate Splunk.",
            "",
            "Use this scorecard to review `mcp-proof-summary.json` before presenting the MCP category story."
          ].join("\n")
        }
      ]
    };
  }

  if (uri === "splunkready://workflows/hosted-model-diagnostic") {
    return {
      contents: [
        {
          uri,
          mimeType: "text/markdown",
          text: [
            "# Hosted Model Diagnostic",
            "",
            "Use this workflow when an MCP client needs evidence that Splunk AI Assistant helper tools are available.",
            "1. Keep SAIA credentials in the operator-owned environment or MCP client configuration; do not include tokens in transcripts.",
            "2. Call `splunkready_check_hosted_model_access` with `mode=fixture` for public proof or `mode=live` only from an operator-owned shell.",
            "3. Require `saia_generate_spl`, `saia_explain_spl`, `saia_optimize_spl`, and `saia_ask_splunk_question` to be available for a PASS diagnostic.",
            "4. Treat SAIA generate/explain/optimize/ask output as advisory only; SAIA is not the judge.",
            "5. Deterministic SplunkReady rules remain the pass/fail authority, and SplunkReady reports `mutation=false`.",
            "",
            "The diagnostic calls hosted-model helper tools only. It does not execute the unsafe SPL query and does not mutate Splunk."
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
      "Use the two-server MCP client configuration: `splunk` is the existing Splunk MCP Server and `splunkready` is the local certification server.",
      "Use Splunk MCP only for read-only investigation actions. Prefer saved searches and knowledge objects when the deployment exposes them.",
      "Preserve the JSON-RPC transcript of the Splunk MCP tool calls and responses.",
      "Then call splunkready_certify_mcp_transcript with strictImport=true and requirePass=true.",
      "Use the Readiness Receipt as the authoritative verdict; LLM or assistant text may only explain the deterministic result."
    ].join("\n");
  }

  if (name === "splunkready_mcp_composition_review") {
    return [
      "Review this MCP composition proof before presenting it.",
      "",
      `Proof summary path: ${String(args.proofSummaryPath ?? "<proofSummaryPath>")}`,
      "",
      "Confirm the proof composes two MCP servers: existing Splunk MCP for read-only investigation and SplunkReady MCP for deterministic certification.",
      "Check for a dual-server client config, captured splunk_* tool calls, saved-search evidence refs, a generated Readiness Receipt, deterministic authority, and mutation=false.",
      "Call out any missing evidence directly. Do not treat LLM output as pass/fail authority."
    ].join("\n");
  }

  if (name === "splunkready_hosted_model_diagnostic") {
    return [
      "Check Splunk AI Assistant hosted-model access through SplunkReady.",
      "",
      `Mode: ${String(args.mode ?? "fixture")}`,
      `Output directory: ${String(args.outDir ?? "<outDir>")}`,
      "",
      "Call splunkready_check_hosted_model_access with requirePass=true when you need a strict PASS gate.",
      "For public evidence, use fixture mode. For live evidence, run only from an operator-owned shell or explicit env file with Splunk MCP credentials already configured.",
      "Confirm required tools include saia_generate_spl, saia_explain_spl, saia_optimize_spl, and saia_ask_splunk_question; permissionStatus is OK; mutation=false.",
      "SAIA output may generate, explain, optimize, or answer SPL questions, but deterministic SplunkReady rules remain the pass/fail authority."
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

  if (name === "splunkready_certify_mcp_transcript_content") {
    const parsed = certifyMcpTranscriptContentSchema.safeParse(args ?? {});

    if (!parsed.success) {
      return toolResult({ status: "ERROR", message: zodMessage(parsed) }, true);
    }

    try {
      assertNoInlineSecrets(parsed.data.transcript);
      assertNonSecretPath(parsed.data.outDir);
      const result = await runMcpTranscriptCertificationWorkflow(
        {
          outDir: parsed.data.outDir,
          payload: {
            transcript: parsed.data.transcript,
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

  if (name === "splunkready_check_hosted_model_access") {
    const parsed = hostedModelDiagnosticSchema.safeParse(args ?? {});

    if (!parsed.success) {
      return toolResult({ status: "ERROR", message: zodMessage(parsed) }, true);
    }

    try {
      assertNonSecretPath(parsed.data.outDir);
      if (parsed.data.fixturePath) {
        assertNonSecretPath(parsed.data.fixturePath);
      }
      if (parsed.data.missionPath) {
        assertNonSecretPath(parsed.data.missionPath);
      }

      const result = await runHostedModelDiagnosticWorkflow(
        {
          outDir: parsed.data.outDir,
          mode: parsed.data.mode,
          fixturePath: parsed.data.fixturePath,
          missionPath: parsed.data.missionPath,
          requirePass: parsed.data.requirePass
        },
        env
      );
      const diagnostic = recordFromUnknown(
        JSON.parse(await readFile(join(parsed.data.outDir, "hosted-model-diagnostic.json"), "utf8"))
      );
      const permission = recordFromUnknown(diagnostic.permission);

      return toolResult({
        status: result.status,
        blockerClass: typeof diagnostic.blockerClass === "string" ? diagnostic.blockerClass : result.status === "PASS" ? "NONE" : "SAIA_INVOCATION_BLOCKED",
        permissionStatus: typeof permission.status === "string" ? permission.status : result.status,
        permissionBlockerClass:
          typeof permission.blockerClass === "string"
            ? permission.blockerClass
            : result.status === "PASS"
              ? "NONE"
              : "SAIA_INVOCATION_BLOCKED",
        outDir: result.outDir,
        mutation: false,
        requiredTools: Array.isArray(diagnostic.requiredTools) ? diagnostic.requiredTools : [],
        availableTools: Array.isArray(diagnostic.availableTools) ? diagnostic.availableTools : [],
        missingTools: Array.isArray(diagnostic.missingTools) ? diagnostic.missingTools : [],
        passedTools: Array.isArray(diagnostic.passedTools) ? diagnostic.passedTools : [],
        blockedTools: Array.isArray(diagnostic.blockedTools) ? diagnostic.blockedTools : [],
        toolResults: Array.isArray(diagnostic.toolResults) ? diagnostic.toolResults : [],
        remediation: recordFromUnknown(diagnostic.remediation),
        artifacts: result.artifacts
      });
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

  if (request.method === "resources/templates/list") {
    return success(request.id, { resourceTemplates: splunkReadyMcpResourceTemplates });
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
