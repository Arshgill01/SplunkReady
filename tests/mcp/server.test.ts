import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { handleMcpMessage, splunkReadyMcpTools } from "../../src/mcp/server.js";

const sampleTracePath = new URL("../../examples/sample-external-trace-pass.json", import.meta.url);

const resultOf = (response: Awaited<ReturnType<typeof handleMcpMessage>>): Record<string, unknown> => {
  expect(response).toBeDefined();
  expect(response).not.toHaveProperty("error");

  return response && "result" in response ? (response.result as Record<string, unknown>) : {};
};

describe("SplunkReady MCP server", () => {
  it("negotiates MCP initialization with tool capability and no mutation instructions", async () => {
    const response = await handleMcpMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" }
      }
    });
    const result = resultOf(response);

    expect(result).toMatchObject({
      protocolVersion: "2025-06-18",
      capabilities: { tools: { listChanged: false } },
      serverInfo: {
        name: "splunkready",
        title: "SplunkReady Agent Readiness Compiler",
        version: "0.0.0"
      }
    });
    expect(String(result.instructions)).toContain("Deterministic rules decide readiness");
    expect(String(result.instructions)).toContain("Tools do not mutate Splunk");
  });

  it("lists deterministic SplunkReady certification tools", async () => {
    const response = await handleMcpMessage({ jsonrpc: "2.0", id: "tools", method: "tools/list" });
    const result = resultOf(response);

    expect(result.tools).toEqual(splunkReadyMcpTools);
    expect(splunkReadyMcpTools.map((tool) => tool.name)).toEqual([
      "splunkready_describe_certification",
      "splunkready_certify_external_trace",
      "splunkready_certify_mcp_transcript"
    ]);
    expect(splunkReadyMcpTools.every((tool) => tool.annotations.destructiveHint === false)).toBe(true);
  });

  it("certifies an external trace through tools/call", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-mcp-external-"));
    const response = await handleMcpMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "splunkready_certify_external_trace",
        arguments: {
          tracePath: sampleTracePath.pathname,
          outDir,
          requirePass: true,
          agentName: "MCP Client Agent",
          agentVersion: "mcp-pass"
        }
      }
    });
    const result = resultOf(response);
    const structured = result.structuredContent as Record<string, unknown>;

    expect(result.isError).toBe(false);
    expect(structured).toMatchObject({ status: "PASS", outDir, mutation: false });
    expect(structured.artifacts).toEqual(
      expect.arrayContaining([join(outDir, "receipt-external-001.json"), join(outDir, "trace-external.json")])
    );
  });

  it("returns a tool error instead of reading secret environment files", async () => {
    const response = await handleMcpMessage({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "splunkready_certify_external_trace",
        arguments: {
          tracePath: ".splunkready.local",
          outDir: await mkdtemp(join(tmpdir(), "splunkready-mcp-secret-"))
        }
      }
    });
    const result = resultOf(response);
    const structured = result.structuredContent as Record<string, unknown>;

    expect(result.isError).toBe(true);
    expect(structured.message).toBe("Refusing to read or write secret environment files through the MCP server.");
  });

  it("does not respond to JSON-RPC notifications", async () => {
    await expect(
      handleMcpMessage({ jsonrpc: "2.0", method: "notifications/initialized" })
    ).resolves.toBeUndefined();
  });

  it("uses protocol errors for unknown tools", async () => {
    const response = await handleMcpMessage({
      jsonrpc: "2.0",
      id: "unknown",
      method: "tools/call",
      params: { name: "splunkready_mutate_splunk", arguments: {} }
    });

    expect(response).toMatchObject({
      jsonrpc: "2.0",
      id: "unknown",
      error: {
        code: -32602,
        message: "Unknown tool: splunkready_mutate_splunk"
      }
    });
  });
});
