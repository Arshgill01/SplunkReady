import { createInterface } from "node:readline";

import {
  createFixtureSplunkAccessAdapter,
  loadFixtureSplunkDatasetFromFile,
  type FixtureSplunkDataset
} from "../adapters/fixture.js";
import type { LiveSplunkTransport, LiveSplunkTransportRequest } from "../adapters/live.js";
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

const optionalStringArrayFromUnknown = (value: unknown): string[] | undefined => {
  const parsed = stringArrayFromUnknown(value);
  return parsed.length > 0 ? parsed : undefined;
};

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
    name: "splunk_get_user_info",
    title: "Get Splunk User Info",
    description: "Return read-only mock Splunk user metadata generated from the SplunkReady fixture dataset.",
    inputSchema: objectSchema({}),
    outputSchema: objectSchema({
      username: stringProperty("Mock Splunk username."),
      roles: { type: "array", items: { type: "string" }, description: "Mock Splunk roles." },
      defaultApp: stringProperty("Mock default app."),
      capabilities: { type: "array", items: { type: "string" }, description: "Mock Splunk capabilities." }
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
  },
  {
    name: "splunk_get_indexes",
    title: "Get Splunk Indexes",
    description: "Return read-only mock Splunk indexes generated from the SplunkReady fixture dataset.",
    inputSchema: objectSchema({}),
    outputSchema: { type: "array", items: { type: "object" } },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
  },
  {
    name: "splunk_get_metadata",
    title: "Get Splunk Metadata",
    description: "Return read-only mock sourcetype metadata generated from the SplunkReady fixture dataset.",
    inputSchema: objectSchema({
      indexes: { type: "array", items: { type: "string" }, description: "Optional indexes to inspect." },
      sourcetypes: { type: "array", items: { type: "string" }, description: "Optional sourcetypes to inspect." },
      index: stringProperty("Optional single Splunk MCP index filter."),
      type: stringProperty("Optional Splunk MCP metadata type."),
      earliest_time: stringProperty("Optional earliest time bound."),
      latest_time: stringProperty("Optional latest time bound.")
    }),
    outputSchema: objectSchema({
      indexes: { type: "array", items: { type: "object" }, description: "Matching mock indexes." },
      sourcetypes: { type: "array", items: { type: "object" }, description: "Matching mock sourcetypes." },
      source: stringProperty("Adapter source."),
      warnings: { type: "array", items: { type: "string" }, description: "Non-fatal mock warnings." }
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
    name: "saia_generate_spl",
    title: "Generate SPL",
    description: "Return fixture-backed advisory SPL generation output. It is not used for pass/fail grading.",
    inputSchema: objectSchema({ prompt: stringProperty("Prompt for advisory SPL generation."), app: stringProperty("Optional app context.") }, ["prompt"]),
    outputSchema: objectSchema({
      query: stringProperty("Generated SPL."),
      rationale: stringProperty("Advisory rationale."),
      warnings: { type: "array", items: { type: "string" }, description: "Non-fatal advisory warnings." }
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
  },
  {
    name: "saia_explain_spl",
    title: "Explain SPL",
    description: "Return fixture-backed advisory SPL explanation output. It is not used for pass/fail grading.",
    inputSchema: objectSchema({ spl: stringProperty("SPL to explain."), query: stringProperty("SPL to explain.") }),
    outputSchema: objectSchema({
      explanation: stringProperty("Advisory explanation."),
      warnings: { type: "array", items: { type: "string" }, description: "Non-fatal advisory warnings." }
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
  },
  {
    name: "saia_optimize_spl",
    title: "Optimize SPL",
    description: "Return fixture-backed advisory SPL optimization output. It is not used for pass/fail grading.",
    inputSchema: objectSchema({ spl: stringProperty("SPL to optimize."), query: stringProperty("SPL to optimize.") }),
    outputSchema: objectSchema({
      optimizedQuery: stringProperty("Optimized SPL."),
      rationale: stringProperty("Advisory rationale."),
      warnings: { type: "array", items: { type: "string" }, description: "Non-fatal advisory warnings." }
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
  },
  {
    name: "saia_ask_splunk_question",
    title: "Ask Splunk Question",
    description: "Return fixture-backed advisory Splunk AI Assistant output. It is not used for pass/fail grading.",
    inputSchema: objectSchema({ prompt: stringProperty("Question to ask."), question: stringProperty("Question to ask.") }),
    outputSchema: objectSchema({
      answer: stringProperty("Advisory answer."),
      warnings: { type: "array", items: { type: "string" }, description: "Non-fatal advisory warnings." }
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
  const rawTypes = stringArrayFromUnknown(args.types);
  const singularType = stringFromUnknown(args.type);
  const types = singularType ? [singularType] : rawTypes;
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
  const parsed = types
    .map((type) => (type === "views" ? "dashboards" : type))
    .filter((type): type is KnowledgeObjectType => allowed.has(type as KnowledgeObjectType));

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

const readMetadataIndexes = (args: Record<string, unknown>): string[] | undefined => {
  const indexes = stringArrayFromUnknown(args.indexes);
  const index = stringFromUnknown(args.index);

  if (indexes.length > 0) {
    return indexes;
  }

  if (index && index !== "*") {
    return [index];
  }

  return undefined;
};

const readSplInput = (args: Record<string, unknown>): string | undefined => stringFromUnknown(args.query) ?? stringFromUnknown(args.spl);

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

    if (name === "splunk_get_user_info") {
      return success(id, {
        content: [{ type: "text", text: "Mock Splunk user metadata loaded." }],
        structuredContent: await adapter.getUserInfo(callOptions)
      });
    }

    if (name === "splunk_get_indexes") {
      return success(id, {
        content: [{ type: "text", text: "Mock Splunk indexes loaded." }],
        structuredContent: await adapter.getIndexes(callOptions)
      });
    }

    if (name === "splunk_get_metadata") {
      return success(id, {
        content: [{ type: "text", text: "Mock Splunk metadata loaded." }],
        structuredContent: await adapter.getMetadata(
          {
            indexes: readMetadataIndexes(args),
            sourcetypes: optionalStringArrayFromUnknown(args.sourcetypes),
            timeWindow: readTimeWindow(args)
          },
          callOptions
        )
      });
    }

    if (name === "splunk_get_knowledge_objects") {
      return success(id, {
        content: [{ type: "text", text: "Mock Splunk knowledge objects loaded." }],
        structuredContent: await adapter.getKnowledgeObjects(
          {
            types: readKnowledgeObjectTypes(args),
            query: stringFromUnknown(args.query) ?? stringFromUnknown(args.search),
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
      const savedSearchName = stringFromUnknown(args.name) ?? stringFromUnknown(args.saved_search_name);
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

    if (name === "saia_generate_spl") {
      const prompt = stringFromUnknown(args.prompt);

      if (!prompt) {
        return error(id, -32602, "saia_generate_spl requires a non-empty prompt argument.");
      }

      return success(id, {
        content: [{ type: "text", text: "Mock Splunk AI Assistant generated SPL." }],
        structuredContent: await adapter.generateSpl?.({ prompt, app: stringFromUnknown(args.app) }, callOptions)
      });
    }

    if (name === "saia_explain_spl") {
      const query = readSplInput(args);

      if (!query) {
        return error(id, -32602, "saia_explain_spl requires a non-empty spl or query argument.");
      }

      return success(id, {
        content: [{ type: "text", text: "Mock Splunk AI Assistant explained SPL." }],
        structuredContent: await adapter.explainSpl?.({ query, app: stringFromUnknown(args.app) }, callOptions)
      });
    }

    if (name === "saia_optimize_spl") {
      const query = readSplInput(args);

      if (!query) {
        return error(id, -32602, "saia_optimize_spl requires a non-empty spl or query argument.");
      }

      return success(id, {
        content: [{ type: "text", text: "Mock Splunk AI Assistant optimized SPL." }],
        structuredContent: await adapter.optimizeSpl?.({ query, app: stringFromUnknown(args.app) }, callOptions)
      });
    }

    if (name === "saia_ask_splunk_question") {
      const question = stringFromUnknown(args.question) ?? stringFromUnknown(args.prompt);

      if (!question) {
        return error(id, -32602, "saia_ask_splunk_question requires a non-empty question or prompt argument.");
      }

      return success(id, {
        content: [{ type: "text", text: "Mock Splunk AI Assistant answered a question." }],
        structuredContent: await adapter.askSplunkQuestion?.({ question, app: stringFromUnknown(args.app) }, callOptions)
      });
    }

    return error(id, -32602, `Unknown mock Splunk tool ${name}.`);
  }

  return error(id, -32601, `Method not found: ${request.method}`);
};

export const createMockSplunkMcpLiveTransport = (fixture: FixtureSplunkDataset): LiveSplunkTransport => ({
  async call<TInput, TOutput>(request: LiveSplunkTransportRequest<TInput>): Promise<TOutput> {
    const response = await handleMockSplunkMcpMessage(
      {
        jsonrpc: "2.0",
        id: `${request.options.requestId}:${request.toolName}`,
        method: "tools/call",
        params: { name: request.toolName, arguments: request.input }
      },
      { fixture }
    );

    if (!response) {
      throw new Error(`Mock Splunk MCP did not return a response for ${request.toolName}.`);
    }

    if ("error" in response) {
      throw new Error(response.error.message);
    }

    const result = recordFromUnknown(response.result);
    const structuredContent = result.structuredContent;

    if (request.toolName === "splunk_get_metadata") {
      const metadata = recordFromUnknown(structuredContent);
      const sourcetypes = Array.isArray(metadata.sourcetypes) ? metadata.sourcetypes : [];

      return {
        results: sourcetypes
          .map((sourcetype) => recordFromUnknown(sourcetype))
          .map((sourcetype) => ({ sourcetype: stringFromUnknown(sourcetype.name) ?? "unknown-sourcetype" })),
        total_rows: sourcetypes.length
      } as TOutput;
    }

    return structuredContent as TOutput;
  }
});

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
