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
    expect(mockSplunkMcpTools.map((tool) => tool.name)).toEqual(["splunk_get_info", "splunk_get_knowledge_objects"]);
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

  it("keeps fixture files free of concrete token placeholders for mock server startup", async () => {
    const fixtureText = await readFile(fixturePath, "utf8");

    expect(fixtureText).not.toContain("Bearer ");
    expect(fixtureText).not.toContain("SPLUNKREADY_SPLUNK_MCP_TOKEN=");
  });
});
