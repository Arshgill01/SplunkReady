import { createInterface } from "node:readline";

import {
  createFixtureSplunkAccessAdapter,
  loadFixtureSplunkDatasetFromFile,
  type FixtureSplunkDataset
} from "../adapters/fixture.js";
import type { KnowledgeObjectType } from "../adapters/splunk-access.js";

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

export type MockSplunkMcpResponse = JsonRpcSuccess | JsonRpcError;

interface MockSplunkMcpTool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  annotations: Record<string, unknown>;
}

export interface MockSplunkMcpOptions {
  fixture: FixtureSplunkDataset;
}

const recordFromUnknown = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const stringArrayFromUnknown = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];

const success = (id: JsonRpcId, result: unknown): JsonRpcSuccess => ({ jsonrpc: "2.0", id, result });

const error = (id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcError => ({
  jsonrpc: "2.0",
  id,
  error: data === undefined ? { code, message } : { code, message, data }
});

const objectSchema = (properties: Record<string, unknown>, required: string[] = []): Record<string, unknown> => ({
  type: "object",
  additionalProperties: false,
  properties,
  required
});

const stringProperty = (description: string): Record<string, unknown> => ({ type: "string", description });

export const mockSplunkMcpTools: MockSplunkMcpTool[] = [
  {
    name: "splunk_get_info",
    title: "Get Splunk Info",
    description: "Return read-only mock Splunk deployment metadata generated from the SplunkReady fixture dataset.",
    inputSchema: objectSchema({}),
    outputSchema: objectSchema({
      mode: stringProperty("Adapter mode."),
      deploymentName: stringProperty("Mock deployment name."),
      serverVersion: stringProperty("Mock Splunk server version."),
      readOnlyTools: { type: "array", items: { type: "string" }, description: "Read-only Splunk MCP tools available." }
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
  },
  {
    name: "splunk_get_knowledge_objects",
    title: "Get Knowledge Objects",
    description: "Return mock Splunk knowledge objects from the SplunkReady fixture dataset.",
    inputSchema: objectSchema({
      types: { type: "array", items: { type: "string" }, description: "Knowledge object types to return." },
      query: stringProperty("Optional name/description filter."),
      app: stringProperty("Optional Splunk app filter.")
    }),
    outputSchema: objectSchema({
      objects: { type: "array", items: { type: "object" }, description: "Matching knowledge objects." },
      resultCount: { type: "number", description: "Number of matching objects." },
      warnings: { type: "array", items: { type: "string" }, description: "Non-fatal mock warnings." }
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
  }
];

const readToolCall = (params: unknown): { name: string; args: Record<string, unknown> } => {
  const record = recordFromUnknown(params);
  const name = typeof record.name === "string" ? record.name : "";
  const args = recordFromUnknown(record.arguments);

  return { name, args };
};

const readKnowledgeObjectTypes = (args: Record<string, unknown>): KnowledgeObjectType[] => {
  const types = stringArrayFromUnknown(args.types);
  const fallbackTypes: KnowledgeObjectType[] = ["saved_searches", "macros", "lookups", "dashboards", "data_models"];
  const allowed = new Set<KnowledgeObjectType>([
    "saved_searches",
    "macros",
    "lookups",
    "dashboards",
    "panels",
    "field_aliases",
    "data_models"
  ]);
  const parsed = types.filter((type): type is KnowledgeObjectType => allowed.has(type as KnowledgeObjectType));

  return parsed.length > 0 ? parsed : fallbackTypes;
};

export const handleMockSplunkMcpMessage = async (
  request: JsonRpcRequest,
  options: MockSplunkMcpOptions
): Promise<MockSplunkMcpResponse | undefined> => {
  const id = request.id ?? null;

  if (request.method === "notifications/initialized") {
    return undefined;
  }

  if (request.method === "initialize") {
    return success(id, {
      protocolVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo: {
        name: "splunkready-mock-splunk-mcp",
        title: "SplunkReady Mock Splunk MCP",
        version: "0.0.0"
      },
      instructions:
        "Mock Splunk MCP server for credential-free read-only live-path demos. This server does not mutate Splunk."
    });
  }

  if (request.method === "tools/list") {
    return success(id, { tools: mockSplunkMcpTools });
  }

  if (request.method === "tools/call") {
    const { name, args } = readToolCall(request.params);
    const adapter = createFixtureSplunkAccessAdapter(options.fixture);
    const callOptions = { requestId: `mock-mcp-${String(id)}` };

    if (name === "splunk_get_info") {
      return success(id, {
        content: [{ type: "text", text: "Mock Splunk deployment metadata loaded." }],
        structuredContent: await adapter.getInfo(callOptions)
      });
    }

    if (name === "splunk_get_knowledge_objects") {
      return success(id, {
        content: [{ type: "text", text: "Mock Splunk knowledge objects loaded." }],
        structuredContent: await adapter.getKnowledgeObjects(
          {
            types: readKnowledgeObjectTypes(args),
            query: typeof args.query === "string" ? args.query : undefined,
            app: typeof args.app === "string" ? args.app : undefined
          },
          callOptions
        )
      });
    }

    return error(id, -32602, `Unknown mock Splunk tool ${name}.`);
  }

  return error(id, -32601, `Method not found: ${request.method}`);
};

export const startStdioMockSplunkMcpServer = async (input: { fixturePath: string }): Promise<void> => {
  const fixture = await loadFixtureSplunkDatasetFromFile(input.fixturePath);
  const readline = createInterface({ input: process.stdin, crlfDelay: Infinity });

  for await (const line of readline) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    try {
      const request = JSON.parse(trimmed) as JsonRpcRequest;
      const response = await handleMockSplunkMcpMessage(request, { fixture });

      if (response) {
        process.stdout.write(`${JSON.stringify(response)}\n`);
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unknown mock Splunk MCP error.";
      process.stdout.write(`${JSON.stringify(error(null, -32700, message))}\n`);
    }
  }
};
