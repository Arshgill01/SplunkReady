import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { loadFixtureSplunkDatasetFromFile } from "../../src/adapters/fixture.js";
import {
  handleMockSplunkMcpMessage,
  mockSplunkMcpTools
} from "../../src/mock-splunk-mcp/server.js";

const fixturePath = new URL("../../fixtures/acme-soc-dev/adapter-fixture.json", import.meta.url);

const resultOf = (response: Awaited<ReturnType<typeof handleMockSplunkMcpMessage>>): Record<string, unknown> => {
  expect(response).toBeDefined();
  expect(response).not.toHaveProperty("error");

  return response && "result" in response ? (response.result as Record<string, unknown>) : {};
};

describe("mock Splunk MCP server", () => {
  it("negotiates initialize without mutation capability", async () => {
    const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
    const response = await handleMockSplunkMcpMessage(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "test-client", version: "0.0.0" }
        }
      },
      { fixture }
    );
    const result = resultOf(response);

    expect(result).toMatchObject({
      protocolVersion: "2025-06-18",
      capabilities: { tools: { listChanged: false } },
      serverInfo: {
        name: "splunkready-mock-splunk-mcp",
        title: "SplunkReady Mock Splunk MCP",
        version: "0.0.0"
      }
    });
    expect(String(result.instructions)).toContain("does not mutate Splunk");
  });

  it("lists read-only mock Splunk tools", async () => {
    const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
    const response = await handleMockSplunkMcpMessage({ jsonrpc: "2.0", id: "tools", method: "tools/list" }, { fixture });
    const result = resultOf(response);

    expect(result.tools).toEqual(mockSplunkMcpTools);
    expect(mockSplunkMcpTools.map((tool) => tool.name)).toEqual([
      "splunk_get_info",
      "splunk_get_knowledge_objects",
      "splunk_run_query",
      "splunk_run_saved_search"
    ]);
    expect(mockSplunkMcpTools.every((tool) => tool.annotations.destructiveHint === false)).toBe(true);
  });

  it("calls splunk_get_info from fixture data", async () => {
    const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
    const response = await handleMockSplunkMcpMessage(
      {
        jsonrpc: "2.0",
        id: "info",
        method: "tools/call",
        params: { name: "splunk_get_info", arguments: {} }
      },
      { fixture }
    );
    const result = resultOf(response);
    const structuredContent = result.structuredContent as Record<string, unknown>;

    expect(structuredContent).toMatchObject({
      mode: "fixture",
      deploymentName: "acme-soc-dev",
      serverVersion: "fixture-splunk-9.x"
    });
    expect(structuredContent.readOnlyTools).toContain("splunk_get_info");
  });

  it("calls splunk_get_knowledge_objects from fixture data", async () => {
    const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
    const response = await handleMockSplunkMcpMessage(
      {
        jsonrpc: "2.0",
        id: "knowledge",
        method: "tools/call",
        params: {
          name: "splunk_get_knowledge_objects",
          arguments: { types: ["saved_searches"], query: "lateral", app: "SplunkEnterpriseSecuritySuite" }
        }
      },
      { fixture }
    );
    const result = resultOf(response);
    const structuredContent = result.structuredContent as { resultCount: number; objects: Array<Record<string, unknown>> };

    expect(structuredContent.resultCount).toBeGreaterThan(0);
    expect(structuredContent.objects.some((object) => String(object.name).includes("Lateral Movement"))).toBe(true);
  });

  it("calls splunk_run_query from exact fixture SPL", async () => {
    const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
    const response = await handleMockSplunkMcpMessage(
      {
        jsonrpc: "2.0",
        id: "query",
        method: "tools/call",
        params: {
          name: "splunk_run_query",
          arguments: {
            query: "search index=wineventlog host=win-finance-07 src=* earliest=-24h latest=now",
            app: "search",
            maxRows: 25
          }
        }
      },
      { fixture }
    );
    const result = resultOf(response);
    const structuredContent = result.structuredContent as {
      queryRef: string;
      resultCount: number;
      evidenceRefs: string[];
    };

    expect(structuredContent.queryRef).toBe("query-canonical-lateral-movement");
    expect(structuredContent.resultCount).toBeGreaterThan(0);
    expect(structuredContent.evidenceRefs).toEqual(expect.arrayContaining(["evt-102", "evt-118"]));
  });

  it("calls splunk_run_saved_search from fixture saved-search data", async () => {
    const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
    const response = await handleMockSplunkMcpMessage(
      {
        jsonrpc: "2.0",
        id: "saved-search",
        method: "tools/call",
        params: {
          name: "splunk_run_saved_search",
          arguments: {
            app: "SplunkEnterpriseSecuritySuite",
            name: "ES - Lateral Movement Auth Chain",
            tokens: { host: "win-finance-07" },
            maxRows: 25
          }
        }
      },
      { fixture }
    );
    const result = resultOf(response);
    const structuredContent = result.structuredContent as {
      savedSearchRef: string;
      resultCount: number;
      evidenceRefs: string[];
    };

    expect(structuredContent.savedSearchRef).toBe("saved-search-lateral-movement");
    expect(structuredContent.resultCount).toBeGreaterThan(0);
    expect(structuredContent.evidenceRefs).toEqual(expect.arrayContaining(["evt-102", "evt-118", "evt-141"]));
  });

  it("rejects saved-search calls without required name and app", async () => {
    const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
    const response = await handleMockSplunkMcpMessage(
      {
        jsonrpc: "2.0",
        id: "missing-saved-search",
        method: "tools/call",
        params: { name: "splunk_run_saved_search", arguments: { app: "SplunkEnterpriseSecuritySuite" } }
      },
      { fixture }
    );

    expect(response).toMatchObject({
      jsonrpc: "2.0",
      id: "missing-saved-search",
      error: {
        code: -32602,
        message: "splunk_run_saved_search requires non-empty name and app arguments."
      }
    });
  });

  it("keeps fixture files free of concrete token placeholders for mock server startup", async () => {
    const fixtureText = await readFile(fixturePath, "utf8");

    expect(fixtureText).not.toContain("Bearer ");
    expect(fixtureText).not.toContain("SPLUNKREADY_SPLUNK_MCP_TOKEN=");
  });
});
