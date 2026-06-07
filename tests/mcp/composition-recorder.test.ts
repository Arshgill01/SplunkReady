import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { reviewMcpComposition } from "../../src/mcp/composition-review.js";
import { createMcpCompositionRecorderSession, type McpRecorderSessionRecord } from "../../src/mcp/composition-recorder.js";
import { importMcpTranscript, parseMcpTranscriptRecords } from "../../src/traces/mcp-transcript.js";

const sampleTranscriptPath = new URL("../../examples/sample-mcp-transcript-pass.jsonl", import.meta.url);

const splunkReadySession: McpRecorderSessionRecord[] = [
  {
    direction: "request",
    sequence: 1,
    id: 1,
    method: "tools/call",
    params: {
      name: "splunkready_certify_mcp_transcript",
      arguments: {
        transcriptPath: "/Users/alice/SplunkReady/examples/sample-mcp-transcript-pass.jsonl",
        outDir: "/tmp/splunkready-mcp-proof",
        endpoint: "https://splunk.example.test/services/mcp",
        headers: { Authorization: "Bearer real-token-value" }
      }
    }
  },
  {
    direction: "response",
    sequence: 2,
    id: 1,
    result: {
      structuredContent: {
        status: "PASS",
        mutation: false,
        outDir: "/Users/alice/SplunkReady/artifacts/mcp-proof"
      }
    }
  },
  {
    direction: "request",
    sequence: 3,
    id: 2,
    method: "tools/call",
    params: {
      name: "splunkready_certify_mcp_transcript_content",
      arguments: {
        transcript: "redacted sample",
        finalAnswer: "Evidence refs evt-102, evt-118, and evt-141 support lateral movement."
      }
    }
  },
  {
    direction: "response",
    sequence: 4,
    id: 2,
    result: {
      structuredContent: {
        status: "PASS",
        mutation: false
      }
    }
  }
];

describe("MCP composition recorder", () => {
  it("records dual-server frames with redaction and strict import compatibility", async () => {
    const splunkTranscript = await readFile(sampleTranscriptPath, "utf8");
    const { frames, summary } = createMcpCompositionRecorderSession({
      splunkTranscript,
      splunkReadySession,
      artifactPath: "artifacts/mcp-proof/dual-server-session.jsonl",
      markdownPath: "artifacts/mcp-proof/dual-server-session.md"
    });
    const serialized = `${frames.map((frame) => JSON.stringify(frame)).join("\n")}\n`;

    expect(summary).toMatchObject({
      source: "splunkready-mcp-composition-recorder",
      status: "PASS",
      serverIds: ["splunk", "splunkready"],
      splunkToolNames: ["splunk_get_knowledge_objects", "splunk_run_saved_search"],
      splunkReadyToolNames: ["splunkready_certify_mcp_transcript", "splunkready_certify_mcp_transcript_content"],
      redaction: {
        status: "PASS",
        endpointMaterialPresent: false,
        tokenMaterialPresent: false,
        localPathMaterialPresent: false
      },
      mutation: false,
      deterministicAuthority: true
    });
    expect(serialized).toContain("\"serverId\":\"splunk\"");
    expect(serialized).toContain("\"serverId\":\"splunkready\"");
    expect(serialized).toContain("<redacted>");
    expect(serialized).not.toContain("https://splunk.example.test");
    expect(serialized).not.toContain("Authorization: Bearer");
    expect(serialized).not.toContain("real-token-value");
    expect(serialized).not.toContain("/Users/alice");
    expect(serialized).not.toContain("/tmp/splunkready-mcp-proof");
    expect(serialized).not.toContain("SPLUNKREADY_SPLUNK_MCP_TOKEN");

    const imported = importMcpTranscript(parseMcpTranscriptRecords(serialized), "mission-security-lateral-movement-readiness");

    expect(imported.summary).toMatchObject({
      source: "mcp-jsonrpc-transcript",
      skippedRecords: 0,
      unmatchedToolCalls: 0,
      toolCalls: 2,
      toolResults: 2,
      finalAnswers: 1,
      mutation: false
    });
  });

  it("lets composition review score wrapped recorder frames", async () => {
    const splunkTranscript = await readFile(sampleTranscriptPath, "utf8");
    const { frames } = createMcpCompositionRecorderSession({
      splunkTranscript,
      splunkReadySession,
      artifactPath: "artifacts/mcp-proof/dual-server-session.jsonl",
      markdownPath: "artifacts/mcp-proof/dual-server-session.md"
    });
    const review = reviewMcpComposition({
      transcript: frames.map((frame) => JSON.stringify(frame)).join("\n"),
      clientConfig: JSON.stringify({
        mcpServers: {
          splunk: { command: "npx", args: ["mcp-remote", "${SPLUNKREADY_SPLUNK_MCP_URL}"] },
          splunkready: { command: "npm", args: ["run", "mcp"] }
        }
      })
    });

    expect(review.status).toBe("PASS");
    expect(review.splunkToolNames).toEqual(["splunk_get_knowledge_objects", "splunk_run_saved_search"]);
    expect(review.evidenceRefs).toEqual(["evt-102", "evt-118", "evt-141"]);
    expect(review.mutation).toBe(false);
  });
});
