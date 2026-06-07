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

const stringFromUnknown = (value: unknown): string | undefined => (typeof value === "string" && value.length > 0 ? value : undefined);

const numberFromUnknown = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

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

const numberProperty = (description: string): Record<string, unknown> => ({ type: "number", description });

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
  },
  {
    name: "splunk_run_query",
    title: "Run SPL Query",
    description: "Return a canned read-only SPL query result from the SplunkReady fixture dataset.",
    inputSchema: objectSchema(
      {
        query: stringProperty("Exact SPL query to resolve from the fixture dataset."),
        app: stringProperty("Optional Splunk app context."),
        maxRows: numberProperty("Optional maximum number of rows requested."),
        timeWindow: objectSchema({
          earliest: stringProperty("Earliest time bound."),
          latest: stringProperty("Latest time bound.")
        })
      },
      ["query"]
    ),
    outputSchema: objectSchema({
      queryRef: stringProperty("Fixture query reference."),
      rows: { type: "array", items: { type: "object" }, description: "Mock search rows." },
      resultCount: numberProperty("Number of mock rows returned."),
      evidenceRefs: { type: "array", items: { type: "string" }, description: "Fixture evidence references." },
      warnings: { type: "array", items: { type: "string" }, description: "Non-fatal mock warnings." }
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
  },
  {
    name: "splunk_run_saved_search",
    title: "Run Saved Search",
    description: "Return a canned read-only saved-search result from the SplunkReady fixture dataset.",
    inputSchema: objectSchema(
      {
        name: stringProperty("Saved-search name."),
        app: stringProperty("Splunk app that owns the saved search."),
        tokens: { type: "object", additionalProperties: { type: "string" }, description: "Optional saved-search token values." },
        maxRows: numberProperty("Optional maximum number of rows requested.")
      },
      ["name", "app"]
    ),
    outputSchema: objectSchema({
      savedSearchRef: stringProperty("Fixture saved-search reference."),
      rows: { type: "array", items: { type: "object" }, description: "Mock saved-search rows." },
      resultCount: numberProperty("Number of mock rows returned."),
      evidenceRefs: { type: "array", items: { type: "string" }, description: "Fixture evidence references." },
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

const readTimeWindow = (args: Record<string, unknown>) => {
  const timeWindow = recordFromUnknown(args.timeWindow);
  const earliest = stringFromUnknown(timeWindow.earliest);
  const latest = stringFromUnknown(timeWindow.latest);

  return earliest && latest ? { earliest, latest } : undefined;
};

const readStringRecord = (value: unknown): Record<string, string> | undefined => {
  const record = recordFromUnknown(value);
  const entries = Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === "string");

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
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

    if (name === "splunk_run_query") {
      const query = stringFromUnknown(args.query);

      if (!query) {
        return error(id, -32602, "splunk_run_query requires a non-empty query argument.");
      }

      return success(id, {
        content: [{ type: "text", text: "Mock Splunk query result loaded." }],
        structuredContent: await adapter.runQuery(
          {
            query,
            app: stringFromUnknown(args.app),
            maxRows: numberFromUnknown(args.maxRows),
            timeWindow: readTimeWindow(args)
          },
          callOptions
        )
      });
    }

    if (name === "splunk_run_saved_search") {
      const savedSearchName = stringFromUnknown(args.name);
      const app = stringFromUnknown(args.app);

      if (!savedSearchName || !app) {
        return error(id, -32602, "splunk_run_saved_search requires non-empty name and app arguments.");
      }

      try {
        return success(id, {
          content: [{ type: "text", text: "Mock Splunk saved-search result loaded." }],
          structuredContent: await adapter.runSavedSearch(
            {
              name: savedSearchName,
              app,
              maxRows: numberFromUnknown(args.maxRows),
              tokens: readStringRecord(args.tokens)
            },
            callOptions
          )
        });
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : `No mock saved-search result for ${app}::${savedSearchName}.`;
        return error(id, -32000, message);
      }
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
