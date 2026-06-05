import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  handleMcpMessage,
  splunkReadyMcpPrompts,
  splunkReadyMcpResources,
  splunkReadyMcpTools
} from "../../src/mcp/server.js";

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
      capabilities: {
        tools: { listChanged: false },
        resources: { listChanged: false },
        prompts: { listChanged: false }
      },
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

  it("lists and reads composable certification resources", async () => {
    const listResponse = await handleMcpMessage({ jsonrpc: "2.0", id: "resources", method: "resources/list" });
    const listResult = resultOf(listResponse);

    expect(listResult.resources).toEqual(splunkReadyMcpResources);
    expect(splunkReadyMcpResources.map((resource) => resource.uri)).toEqual([
      "splunkready://certification/posture",
      "splunkready://examples/external-trace-pass",
      "splunkready://examples/mcp-transcript-pass",
      "splunkready://examples/pass-receipt",
      "splunkready://client-config/stdio",
      "splunkready://client-config/splunk-and-splunkready",
      "splunkready://workflows/splunk-mcp-certification-loop",
      "splunkready://workflows/mcp-composition-scorecard"
    ]);

    const readResponse = await handleMcpMessage({
      jsonrpc: "2.0",
      id: "resource-read",
      method: "resources/read",
      params: { uri: "splunkready://certification/posture" }
    });
    const readResult = resultOf(readResponse);
    const contents = readResult.contents as Array<Record<string, unknown>>;

    expect(contents[0]).toMatchObject({
      uri: "splunkready://certification/posture",
      mimeType: "application/json"
    });
    expect(String(contents[0].text)).toContain("\"deterministicAuthority\": true");
    expect(String(contents[0].text)).toContain("\"mutation\": false");

    const dualConfigResponse = await handleMcpMessage({
      jsonrpc: "2.0",
      id: "dual-config-read",
      method: "resources/read",
      params: { uri: "splunkready://client-config/splunk-and-splunkready" }
    });
    const dualConfigResult = resultOf(dualConfigResponse);
    const dualConfigContents = dualConfigResult.contents as Array<Record<string, unknown>>;

    expect(String(dualConfigContents[0].text)).toContain("\"splunk\"");
    expect(String(dualConfigContents[0].text)).toContain("\"splunkready\"");
    expect(String(dualConfigContents[0].text)).toContain("\"certificationTool\": \"splunkready_certify_mcp_transcript\"");
    expect(String(dualConfigContents[0].text)).toContain("\"mutation\": false");

    const workflowResponse = await handleMcpMessage({
      jsonrpc: "2.0",
      id: "workflow-read",
      method: "resources/read",
      params: { uri: "splunkready://workflows/splunk-mcp-certification-loop" }
    });
    const workflowResult = resultOf(workflowResponse);
    const workflowContents = workflowResult.contents as Array<Record<string, unknown>>;

    expect(String(workflowContents[0].text)).toContain("Use the configured Splunk MCP Server");
    expect(String(workflowContents[0].text)).toContain("Configure two MCP servers");
    expect(String(workflowContents[0].text)).toContain("splunkready_certify_mcp_transcript");

    const scorecardResponse = await handleMcpMessage({
      jsonrpc: "2.0",
      id: "scorecard-read",
      method: "resources/read",
      params: { uri: "splunkready://workflows/mcp-composition-scorecard" }
    });
    const scorecardResult = resultOf(scorecardResponse);
    const scorecardContents = scorecardResult.contents as Array<Record<string, unknown>>;

    expect(String(scorecardContents[0].text)).toContain("composition, not replacement");
    expect(String(scorecardContents[0].text)).toContain("existing Splunk MCP server");
    expect(String(scorecardContents[0].text)).toContain("mutation");
  });

  it("lists and returns reusable MCP certification prompts", async () => {
    const listResponse = await handleMcpMessage({ jsonrpc: "2.0", id: "prompts", method: "prompts/list" });
    const listResult = resultOf(listResponse);

    expect(listResult.prompts).toEqual(splunkReadyMcpPrompts);
    expect(splunkReadyMcpPrompts.map((prompt) => prompt.name)).toEqual([
      "splunkready_certify_mcp_transcript",
      "splunkready_capture_trace",
      "splunkready_explain_receipt",
      "splunkready_splunk_mcp_certification_loop",
      "splunkready_mcp_composition_review"
    ]);

    const getResponse = await handleMcpMessage({
      jsonrpc: "2.0",
      id: "prompt-get",
      method: "prompts/get",
      params: {
        name: "splunkready_certify_mcp_transcript",
        arguments: {
          transcriptPath: "examples/sample-mcp-transcript-pass.jsonl",
          outDir: "artifacts/mcp-prompt-proof",
          finalAnswer: "Evidence refs support the conclusion."
        }
      }
    });
    const getResult = resultOf(getResponse);
    const messages = getResult.messages as Array<{ content: { text: string } }>;

    expect(messages[0].content.text).toContain("splunkready_certify_mcp_transcript");
    expect(messages[0].content.text).toContain("strictImport=true");
    expect(messages[0].content.text).toContain("Deterministic rules decide READY or NOT READY");

    const loopResponse = await handleMcpMessage({
      jsonrpc: "2.0",
      id: "prompt-loop",
      method: "prompts/get",
      params: {
        name: "splunkready_splunk_mcp_certification_loop",
        arguments: {
          splunkMcpServerName: "splunk",
          transcriptPath: "artifacts/splunk-mcp/transcript.jsonl",
          outDir: "artifacts/splunk-mcp/certification"
        }
      }
    });
    const loopResult = resultOf(loopResponse);
    const loopMessages = loopResult.messages as Array<{ content: { text: string } }>;

    expect(loopMessages[0].content.text).toContain("Splunk MCP server: splunk");
    expect(loopMessages[0].content.text).toContain("two-server MCP client configuration");
    expect(loopMessages[0].content.text).toContain("Preserve the JSON-RPC transcript");
    expect(loopMessages[0].content.text).toContain("Readiness Receipt as the authoritative verdict");

    const reviewResponse = await handleMcpMessage({
      jsonrpc: "2.0",
      id: "prompt-review",
      method: "prompts/get",
      params: {
        name: "splunkready_mcp_composition_review",
        arguments: {
          proofSummaryPath: "artifacts/mcp-proof/mcp-proof-summary.json"
        }
      }
    });
    const reviewResult = resultOf(reviewResponse);
    const reviewMessages = reviewResult.messages as Array<{ content: { text: string } }>;

    expect(reviewMessages[0].content.text).toContain("two MCP servers");
    expect(reviewMessages[0].content.text).toContain("saved-search evidence refs");
    expect(reviewMessages[0].content.text).toContain("mutation=false");
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
