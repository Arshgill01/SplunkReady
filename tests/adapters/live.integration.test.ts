import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import { createHttpLiveSplunkTransport, createLiveSplunkAccessAdapter } from "../../src/adapters/live.js";

const requestOptions = { requestId: "req-live-integration-001", missionId: "mission-live-integration" };

type JsonRpcRequest = {
  jsonrpc: string;
  id: string;
  method: string;
  params: {
    name: string;
    arguments: unknown;
    defaultApp?: string;
  };
};

type Handler = (request: JsonRpcRequest, rawRequest: IncomingMessage, response: ServerResponse) => unknown | Promise<unknown>;

const servers: Array<{ close: () => Promise<void> }> = [];

const readBody = async (request: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
};

const startMockMcpServer = async (handler: Handler) => {
  const calls: JsonRpcRequest[] = [];
  const server = createServer(async (request, response) => {
    try {
      const body = await readBody(request);
      const parsed = JSON.parse(body) as JsonRpcRequest;
      calls.push(parsed);
      const payload = await handler(parsed, request, response);

      if (response.writableEnded) {
        return;
      }

      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(payload));
    } catch (error) {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Mock MCP server did not expose a TCP port.");
  }

  const close = () =>
    new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  servers.push({ close });

  return {
    url: `http://127.0.0.1:${address.port}/mcp`,
    calls,
    close
  };
};

const createAdapter = (endpointUrl: string, timeoutMs = 1_000) =>
  createLiveSplunkAccessAdapter({
    enabled: true,
    endpointUrl,
    authToken: "test-token",
    defaultApp: "search",
    timeoutMs,
    transport: createHttpLiveSplunkTransport(),
    capabilities: [
      "splunk_get_info",
      "splunk_get_indexes",
      "splunk_get_knowledge_objects",
      "splunk_run_saved_search"
    ]
  });

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("live Splunk HTTP adapter integration", () => {
  it("extracts MCP result.structuredContent responses through the HTTP transport", async () => {
    const mcp = await startMockMcpServer((request, rawRequest) => {
      expect(rawRequest.headers.authorization).toBe("Bearer test-token");
      expect(request).toMatchObject({
        jsonrpc: "2.0",
        method: "tools/call",
        params: { name: "splunk_get_info", arguments: {}, defaultApp: "search" }
      });

      return {
        jsonrpc: "2.0",
        result: {
          structuredContent: {
            mode: "live",
            deploymentName: "integration-splunk",
            serverVersion: "10.0.0",
            readOnlyTools: ["splunk_get_info", "splunk_get_indexes"]
          }
        }
      };
    });

    await expect(createAdapter(mcp.url).getInfo(requestOptions)).resolves.toMatchObject({
      mode: "live",
      deploymentName: "integration-splunk",
      serverVersion: "10.0.0"
    });
    expect(mcp.calls).toHaveLength(1);
  });

  it("extracts MCP result.output responses through the HTTP transport", async () => {
    const mcp = await startMockMcpServer(() => ({
      jsonrpc: "2.0",
      result: {
        output: {
          results: [
            { title: "main", description: "application logs" },
            { title: "finance_pii", description: "restricted finance data" }
          ]
        }
      }
    }));

    await expect(createAdapter(mcp.url).getIndexes(requestOptions)).resolves.toEqual([
      { name: "main", sensitive: false, description: "application logs" },
      { name: "finance_pii", sensitive: true, description: "restricted finance data" }
    ]);
  });

  it("extracts JSON MCP result.content text responses through the HTTP transport", async () => {
    const mcp = await startMockMcpServer(() => ({
      jsonrpc: "2.0",
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              results: [
                {
                  name: "ES - Lateral Movement Auth Chain",
                  app: "SplunkEnterpriseSecuritySuite",
                  description: "Validated saved search"
                }
              ]
            })
          }
        ]
      }
    }));

    await expect(
      createAdapter(mcp.url).getKnowledgeObjects({ types: ["saved_searches"], query: "lateral movement" }, requestOptions)
    ).resolves.toMatchObject({
      resultCount: 1,
      objects: [
        expect.objectContaining({
          type: "saved_searches",
          app: "SplunkEnterpriseSecuritySuite",
          name: "ES - Lateral Movement Auth Chain"
        })
      ]
    });
  });

  it("normalizes saved-search rows and evidence refs from MCP HTTP output", async () => {
    const mcp = await startMockMcpServer(() => ({
      jsonrpc: "2.0",
      result: {
        structuredContent: {
          rows: [
            { eventRef: "live-evt-001", src: "win-finance-07" },
            { _cd: "bucket:123", src: "admin-login-02" }
          ]
        }
      }
    }));

    await expect(
      createAdapter(mcp.url).runSavedSearch(
        { name: "ES - Lateral Movement Auth Chain", app: "SplunkEnterpriseSecuritySuite", maxRows: 5 },
        requestOptions
      )
    ).resolves.toMatchObject({
      savedSearchRef: "SplunkEnterpriseSecuritySuite:ES - Lateral Movement Auth Chain",
      resultCount: 2,
      evidenceRefs: ["live-evt-001", "bucket:123"]
    });
  });

  it("wraps HTTP timeout failures as retryable live adapter transport errors", async () => {
    const mcp = await startMockMcpServer(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ jsonrpc: "2.0", result: { structuredContent: {} } }), 50);
        })
    );

    await expect(createAdapter(mcp.url, 5).getInfo(requestOptions)).rejects.toMatchObject({
      name: "SplunkAdapterError",
      code: "LIVE_ADAPTER_TRANSPORT_ERROR",
      retryable: true,
      context: {
        mode: "live",
        toolName: "splunk_get_info",
        requestId: "req-live-integration-001"
      }
    });
  });
});
