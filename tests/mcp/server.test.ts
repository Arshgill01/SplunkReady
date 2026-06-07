import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  handleMcpMessage,
  splunkReadyMcpPrompts,
  splunkReadyMcpResourceTemplates,
  splunkReadyMcpResources,
  splunkReadyMcpTools
} from "../../src/mcp/server.js";

const sampleTracePath = new URL("../../examples/sample-external-trace-pass.json", import.meta.url);
const sampleMcpTranscriptPath = new URL("../../examples/sample-mcp-transcript-pass.jsonl", import.meta.url);
const sampleFinalAnswer =
  "Evidence supports suspicious lateral movement from win-finance-07 through admin-login-02 to dc-01 and finance-sql-03. Provenance saved-search-lateral-movement returned 3 rows for the -24h to now window, with evidence rows evt-102, evt-118, and evt-141.";

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
      "splunkready_certify_mcp_transcript",
      "splunkready_certify_mcp_transcript_content",
      "splunkready_check_hosted_model_access"
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
      "splunkready://client-config/claude-desktop",
      "splunkready://client-config/cursor",
      "splunkready://workflows/splunk-mcp-certification-loop",
      "splunkready://workflows/mcp-composition-scorecard",
      "splunkready://workflows/hosted-model-diagnostic"
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
    expect(String(dualConfigContents[0].text)).toContain("\"command\": \"npx\"");
    expect(String(dualConfigContents[0].text)).toContain("\"mcp-remote\"");
    expect(String(dualConfigContents[0].text)).toContain("SPLUNKREADY_SPLUNK_MCP_URL");
    expect(String(dualConfigContents[0].text)).toContain("Authorization: Bearer ${SPLUNKREADY_SPLUNK_MCP_TOKEN}");
    expect(String(dualConfigContents[0].text)).toContain("SPLUNKREADY_SAIA_MCP_URL");
    expect(String(dualConfigContents[0].text)).toContain("SPLUNKREADY_SAIA_MCP_TOKEN");
    expect(String(dualConfigContents[0].text)).toContain("SAIA_MCP_URL");
    expect(String(dualConfigContents[0].text)).toContain("SPLUNK_AI_ASSISTANT_MCP_URL");
    expect(String(dualConfigContents[0].text)).toContain("SPLUNKREADY_SAIA_REALM");
    expect(String(dualConfigContents[0].text)).toContain("SPLUNKREADY_SAIA_TENANT");
    expect(String(dualConfigContents[0].text)).toContain("\"certificationTool\": \"splunkready_certify_mcp_transcript\"");
    expect(String(dualConfigContents[0].text)).toContain("\"mutation\": false");

    const claudeConfigResponse = await handleMcpMessage({
      jsonrpc: "2.0",
      id: "claude-config-read",
      method: "resources/read",
      params: { uri: "splunkready://client-config/claude-desktop" }
    });
    const claudeConfigResult = resultOf(claudeConfigResponse);
    const claudeConfigContents = claudeConfigResult.contents as Array<Record<string, unknown>>;

    expect(String(claudeConfigContents[0].text)).toContain("\"splunk\"");
    expect(String(claudeConfigContents[0].text)).toContain("\"splunkready\"");
    expect(String(claudeConfigContents[0].text)).toContain("\"command\": \"npx\"");
    expect(String(claudeConfigContents[0].text)).toContain("\"mcp-remote\"");
    expect(String(claudeConfigContents[0].text)).toContain("SPLUNKREADY_SPLUNK_MCP_URL");
    expect(String(claudeConfigContents[0].text)).toContain("Authorization: Bearer ${SPLUNKREADY_SPLUNK_MCP_TOKEN}");
    expect(String(claudeConfigContents[0].text)).toContain("\"command\": \"npm\"");
    expect(String(claudeConfigContents[0].text)).toContain("\"run\"");
    expect(String(claudeConfigContents[0].text)).toContain("\"mcp\"");
    expect(String(claudeConfigContents[0].text)).toContain("\"cwd\": \"/path/to/SplunkReady\"");
    expect(String(claudeConfigContents[0].text)).toContain("SPLUNKREADY_SAIA_ENDPOINT");
    expect(String(claudeConfigContents[0].text)).toContain("SPLUNKREADY_SAIA_TOKEN");
    expect(String(claudeConfigContents[0].text)).toContain("SPLUNKREADY_SAIA_MCP_URL");
    expect(String(claudeConfigContents[0].text)).toContain("SPLUNKREADY_SAIA_MCP_TOKEN");
    expect(String(claudeConfigContents[0].text)).toContain("SAIA_MCP_URL");
    expect(String(claudeConfigContents[0].text)).toContain("SPLUNK_AI_ASSISTANT_MCP_URL");
    expect(String(claudeConfigContents[0].text)).toContain("SPLUNKREADY_SAIA_REALM");
    expect(String(claudeConfigContents[0].text)).toContain("SPLUNKREADY_SAIA_TENANT");
    expect(String(claudeConfigContents[0].text)).toContain("\"certificationTool\": \"splunkready_certify_mcp_transcript_content\"");
    expect(String(claudeConfigContents[0].text)).toContain("\"hostedModelDiagnosticTool\": \"splunkready_check_hosted_model_access\"");
    expect(String(claudeConfigContents[0].text)).toContain("\"mutation\": false");

    const cursorConfigResponse = await handleMcpMessage({
      jsonrpc: "2.0",
      id: "cursor-config-read",
      method: "resources/read",
      params: { uri: "splunkready://client-config/cursor" }
    });
    const cursorConfigResult = resultOf(cursorConfigResponse);
    const cursorConfigContents = cursorConfigResult.contents as Array<Record<string, unknown>>;

    expect(String(cursorConfigContents[0].text)).toContain("\"splunk\"");
    expect(String(cursorConfigContents[0].text)).toContain("\"splunkready\"");
    expect(String(cursorConfigContents[0].text)).toContain("\"command\": \"npx\"");
    expect(String(cursorConfigContents[0].text)).toContain("\"mcp-remote\"");
    expect(String(cursorConfigContents[0].text)).toContain("SPLUNKREADY_SPLUNK_MCP_URL");
    expect(String(cursorConfigContents[0].text)).toContain("Authorization: Bearer ${SPLUNKREADY_SPLUNK_MCP_TOKEN}");
    expect(String(cursorConfigContents[0].text)).toContain("\"command\": \"npm\"");
    expect(String(cursorConfigContents[0].text)).toContain("\"run\"");
    expect(String(cursorConfigContents[0].text)).toContain("\"mcp\"");
    expect(String(cursorConfigContents[0].text)).toContain("\"cwd\": \"/path/to/SplunkReady\"");
    expect(String(cursorConfigContents[0].text)).toContain("\"preserveTranscript\"");
    expect(String(cursorConfigContents[0].text)).toContain("SPLUNKREADY_SAIA_ENDPOINT");
    expect(String(cursorConfigContents[0].text)).toContain("SPLUNKREADY_SAIA_TOKEN");
    expect(String(cursorConfigContents[0].text)).toContain("SPLUNKREADY_SAIA_MCP_URL");
    expect(String(cursorConfigContents[0].text)).toContain("SPLUNKREADY_SAIA_MCP_TOKEN");
    expect(String(cursorConfigContents[0].text)).toContain("SAIA_MCP_URL");
    expect(String(cursorConfigContents[0].text)).toContain("SPLUNK_AI_ASSISTANT_MCP_URL");
    expect(String(cursorConfigContents[0].text)).toContain("SPLUNKREADY_SAIA_REALM");
    expect(String(cursorConfigContents[0].text)).toContain("SPLUNKREADY_SAIA_TENANT");
    expect(String(cursorConfigContents[0].text)).toContain("\"hostedModelDiagnosticTool\": \"splunkready_check_hosted_model_access\"");
    expect(String(cursorConfigContents[0].text)).toContain("\"mutation\": false");

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

    const hostedModelWorkflowResponse = await handleMcpMessage({
      jsonrpc: "2.0",
      id: "hosted-model-workflow-read",
      method: "resources/read",
      params: { uri: "splunkready://workflows/hosted-model-diagnostic" }
    });
    const hostedModelWorkflowResult = resultOf(hostedModelWorkflowResponse);
    const hostedModelWorkflowContents = hostedModelWorkflowResult.contents as Array<Record<string, unknown>>;

    expect(String(hostedModelWorkflowContents[0].text)).toContain("splunkready_check_hosted_model_access");
    expect(String(hostedModelWorkflowContents[0].text)).toContain("saia_explain_spl");
    expect(String(hostedModelWorkflowContents[0].text)).toContain("advisory only");
    expect(String(hostedModelWorkflowContents[0].text)).toContain("mutation=false");

    const templatesResponse = await handleMcpMessage({
      jsonrpc: "2.0",
      id: "resource-templates",
      method: "resources/templates/list"
    });
    const templatesResult = resultOf(templatesResponse);

    expect(templatesResult.resourceTemplates).toEqual(splunkReadyMcpResourceTemplates);
    expect(splunkReadyMcpResourceTemplates.map((template) => template.uriTemplate)).toEqual([
      "splunkready://receipts/{receiptId}"
    ]);

    const templatedReceiptResponse = await handleMcpMessage({
      jsonrpc: "2.0",
      id: "templated-receipt-read",
      method: "resources/read",
      params: { uri: "splunkready://receipts/pass" }
    });
    const templatedReceiptResult = resultOf(templatedReceiptResponse);
    const templatedReceiptContents = templatedReceiptResult.contents as Array<Record<string, unknown>>;

    expect(templatedReceiptContents[0]).toMatchObject({
      uri: "splunkready://receipts/pass",
      mimeType: "text/markdown"
    });
    expect(String(templatedReceiptContents[0].text)).toContain("Readiness Receipt");
    expect(String(templatedReceiptContents[0].text)).toContain("READY");
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
      "splunkready_mcp_composition_review",
      "splunkready_hosted_model_diagnostic"
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

    const hostedModelPromptResponse = await handleMcpMessage({
      jsonrpc: "2.0",
      id: "prompt-hosted-model",
      method: "prompts/get",
      params: {
        name: "splunkready_hosted_model_diagnostic",
        arguments: {
          outDir: "artifacts/mcp-proof/mcp-hosted-model-access",
          mode: "fixture"
        }
      }
    });
    const hostedModelPromptResult = resultOf(hostedModelPromptResponse);
    const hostedModelPromptMessages = hostedModelPromptResult.messages as Array<{ content: { text: string } }>;

    expect(hostedModelPromptMessages[0].content.text).toContain("splunkready_check_hosted_model_access");
    expect(hostedModelPromptMessages[0].content.text).toContain("permissionStatus");
    expect(hostedModelPromptMessages[0].content.text).toContain("mutation=false");
    expect(hostedModelPromptMessages[0].content.text).toContain("deterministic");
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

  it("certifies inline MCP transcript content through tools/call", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-mcp-inline-"));
    const transcript = await readFile(sampleMcpTranscriptPath, "utf8");
    const response = await handleMcpMessage({
      jsonrpc: "2.0",
      id: "inline",
      method: "tools/call",
      params: {
        name: "splunkready_certify_mcp_transcript_content",
        arguments: {
          transcript,
          finalAnswer: sampleFinalAnswer,
          outDir,
          strictImport: true,
          requirePass: true,
          agentName: "Inline MCP Client Agent",
          agentVersion: "inline-pass"
        }
      }
    });
    const result = resultOf(response);
    const structured = result.structuredContent as Record<string, unknown>;

    expect(result.isError).toBe(false);
    expect(structured).toMatchObject({ status: "PASS", outDir, mutation: false });
    expect(structured.artifacts).toEqual(
      expect.arrayContaining([join(outDir, "receipt-external-001.json"), join(outDir, "uploaded-mcp-transcript.jsonl")])
    );
  });

  it("certifies MCP transcripts that use Splunk MCP saved_search_name and total_rows fields", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-mcp-saved-search-name-"));
    const transcript = (await readFile(sampleMcpTranscriptPath, "utf8"))
      .replace('"name":"ES - Lateral Movement Auth Chain"', '"saved_search_name":"ES - Lateral Movement Auth Chain"')
      .replaceAll('"resultCount":3', '"total_rows":3');
    const response = await handleMcpMessage({
      jsonrpc: "2.0",
      id: "saved-search-name",
      method: "tools/call",
      params: {
        name: "splunkready_certify_mcp_transcript_content",
        arguments: {
          transcript,
          finalAnswer: sampleFinalAnswer,
          outDir,
          strictImport: true,
          requirePass: true,
          agentName: "Splunk MCP Client Agent",
          agentVersion: "saved-search-name-pass"
        }
      }
    });
    const result = resultOf(response);
    const structured = result.structuredContent as Record<string, unknown>;

    expect(result.isError).toBe(false);
    expect(structured).toMatchObject({ status: "PASS", outDir, mutation: false });
  });

  it("creates the output directory for path-based MCP transcript certification", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "splunkready-mcp-path-"));
    const outDir = join(rootDir, "nested", "mcp-certification");
    const response = await handleMcpMessage({
      jsonrpc: "2.0",
      id: "path-mcp",
      method: "tools/call",
      params: {
        name: "splunkready_certify_mcp_transcript",
        arguments: {
          transcriptPath: sampleMcpTranscriptPath.pathname,
          finalAnswer: sampleFinalAnswer,
          outDir,
          strictImport: true,
          requirePass: true,
          agentName: "Path MCP Client Agent",
          agentVersion: "path-pass"
        }
      }
    });
    const result = resultOf(response);
    const structured = result.structuredContent as Record<string, unknown>;

    expect(result.isError).toBe(false);
    expect(structured).toMatchObject({ status: "PASS", outDir, mutation: false });
    expect(structured.artifacts).toEqual(
      expect.arrayContaining([join(outDir, "receipt-external-001.json"), join(outDir, "uploaded-mcp-transcript.jsonl")])
    );
  });

  it("rejects inline MCP transcript content that appears to include secrets", async () => {
    const response = await handleMcpMessage({
      jsonrpc: "2.0",
      id: "inline-secret",
      method: "tools/call",
      params: {
        name: "splunkready_certify_mcp_transcript_content",
        arguments: {
          transcript: '{"jsonrpc":"2.0","method":"tools/call","params":{"authorization":"Bearer secret"}}',
          finalAnswer: sampleFinalAnswer,
          outDir: await mkdtemp(join(tmpdir(), "splunkready-mcp-inline-secret-"))
        }
      }
    });
    const result = resultOf(response);
    const structured = result.structuredContent as Record<string, unknown>;

    expect(result.isError).toBe(true);
    expect(structured.message).toBe("Refusing to certify inline MCP transcript content that appears to contain secrets.");
  });

  it("checks hosted-model access through tools/call in fixture mode", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-mcp-hosted-model-"));
    const response = await handleMcpMessage({
      jsonrpc: "2.0",
      id: "hosted-model",
      method: "tools/call",
      params: {
        name: "splunkready_check_hosted_model_access",
        arguments: {
          outDir,
          mode: "fixture",
          requirePass: true
        }
      }
    });
    const result = resultOf(response);
    const structured = result.structuredContent as Record<string, unknown>;

    expect(result.isError).toBe(false);
    expect(structured).toMatchObject({
      status: "PASS",
      blockerClass: "NONE",
      permissionStatus: "OK",
      permissionBlockerClass: "NONE",
      outDir,
      mutation: false,
      remediation: { status: "CLEAR", blockerClass: "NONE", safeForPublicExport: true, mutation: false },
      requiredTools: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"],
      availableTools: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"],
      missingTools: []
    });
    expect(structured.artifacts).toEqual(
      expect.arrayContaining([join(outDir, "hosted-model-proof.json"), join(outDir, "hosted-model-diagnostic.json")])
    );
  });

  it("reports hosted-model access as blocked in live mode when env is not exported", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-mcp-hosted-model-blocked-"));
    const response = await handleMcpMessage(
      {
        jsonrpc: "2.0",
        id: "hosted-model-blocked",
        method: "tools/call",
        params: {
          name: "splunkready_check_hosted_model_access",
          arguments: {
            outDir,
            mode: "live"
          }
        }
      },
      {}
    );
    const result = resultOf(response);
    const structured = result.structuredContent as Record<string, unknown>;

    expect(result.isError).toBe(false);
    expect(structured).toMatchObject({
      status: "BLOCKED",
      blockerClass: "LIVE_CONFIG_MISSING",
      permissionStatus: "BLOCKED",
      permissionBlockerClass: "LIVE_CONFIG_MISSING",
      outDir,
      mutation: false,
      remediation: { status: "ACTION_REQUIRED", blockerClass: "LIVE_CONFIG_MISSING", safeForPublicExport: true, mutation: false },
      requiredTools: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"],
      availableTools: [],
      missingTools: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"]
    });
    expect(JSON.stringify(structured)).not.toContain("Bearer");
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
