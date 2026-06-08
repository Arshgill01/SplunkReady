import { execFile } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(import.meta.dirname, "../..");
const scriptPath = resolve(repoRoot, "scripts/audit-mcp-category-evidence.mjs");

const tempRoot = async (): Promise<string> => mkdtemp(join(tmpdir(), "splunkready-mcp-category-test-"));

const writeFixture = async (path: string, value: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");
};

const writeBaseTree = async (root: string, zedJsonl: string): Promise<void> => {
  await writeFixture(
    join(root, "submission-evidence/mcp-proof/mcp-proof-summary.json"),
    `${JSON.stringify(
      {
        status: "PASS",
        mutation: false,
        tools: [
          "splunkready_describe_certification",
          "splunkready_certify_external_trace",
          "splunkready_certify_mcp_transcript",
          "splunkready_certify_mcp_transcript_content",
          "splunkready_review_mcp_composition",
          "splunkready_check_hosted_model_access"
        ].map((name) => ({ name })),
        resources: Array.from({ length: 10 }, (_, index) => ({ uri: `splunkready://resource/${index}` })),
        resourceTemplates: [{ uriTemplate: "splunkready://receipts/{receiptId}" }],
        prompts: Array.from({ length: 6 }, (_, index) => ({ name: `prompt_${index}` })),
        liveMockSplunkMcp: {
          status: "PASS",
          includesSavedSearchExecution: true,
          artifactPath: "submission-evidence/mcp-proof/mock-splunk-mcp-session.jsonl"
        },
        compositionRecorder: {
          status: "PASS",
          artifactPath: "submission-evidence/mcp-proof/dual-server-session.jsonl",
          frameCount: 9,
          serverIds: ["splunk", "splunkready"],
          splunkReadyToolNames: [
            "splunkready_certify_mcp_transcript",
            "splunkready_certify_mcp_transcript_content",
            "splunkready_recorder_flush"
          ]
        },
        appInspectComposition: {
          status: "PASS",
          artifactPath: "submission-evidence/mcp-proof/appinspect-mcp-composition.json",
          validation: { failureCount: 0, errorCount: 0 }
        },
        hostedModelAccess: { status: "PASS", mutation: false },
        operatorLiveHostedModelStatus: {
          status: "BLOCKED",
          blockerClass: "SAIA_REST_HANDLERS_PARTIALLY_REGISTERED",
          safeForPublicExport: true,
          mutation: false
        },
        officialSplunkMcpToolCoverage: {
          status: "PASS",
          mutation: false,
          investigationTools: ["splunk_get_knowledge_objects", "splunk_run_saved_search"]
        }
      },
      null,
      2
    )}\n`
  );
  await writeFixture(join(root, "submission-evidence/mcp-proof/zed-client-session/zed-mcp-recorder-session.jsonl"), zedJsonl);
  await writeFixture(
    join(root, "submission-evidence/mcp-proof/zed-client-session/zed-mcp-recorder-session.md"),
    "Status: PASS\nCertification: PASS\n"
  );
  await writeFixture(
    join(root, "submission-evidence/mcp-proof/zed-client-session/mcp-transcript-certification.json"),
    `${JSON.stringify({ status: "PASS", mutation: false }, null, 2)}\n`
  );
  await writeFixture(
    join(root, "submission-evidence/mcp-proof/zed-client-session/receipt-external-001.json"),
    `${JSON.stringify({ verdict: "READY", score: 100, mutation: false }, null, 2)}\n`
  );
  await writeFixture(join(root, "submission-evidence/screenshots/zed-mcp-recorder-summary.png"), "fake-png");
};

const compactZedJsonl = [
  {
    serverId: "splunk",
    message: { params: { name: "splunk_get_knowledge_objects" } }
  },
  {
    serverId: "splunk",
    message: { result: { structuredContent: { evidenceRefs: [] } } }
  },
  {
    serverId: "splunk",
    message: { params: { name: "splunk_run_saved_search" } }
  },
  {
    serverId: "splunk",
    message: { result: { structuredContent: { evidenceRefs: ["evt-102", "evt-118", "evt-141"] } } }
  },
  {
    serverId: "splunkready",
    message: { type: "final_answer", evidenceRefs: ["evt-102", "evt-118", "evt-141"] }
  }
]
  .map((frame) => JSON.stringify(frame))
  .join("\n");

describe("MCP category evidence audit", () => {
  it("passes with limitations for the current compact Zed evidence shape", async () => {
    const root = await tempRoot();
    await writeBaseTree(root, `${compactZedJsonl}\n`);

    const result = await execFileAsync(process.execPath, [scriptPath, "--out", "submission-evidence/mcp-proof"], {
      cwd: root
    });
    const parsed = JSON.parse(result.stdout);

    expect(parsed.status).toBe("PASS_WITH_LIMITATIONS");
    expect(parsed.summary.zedEvidenceTier).toBe("VERIFIED_COMPACT");
    expect(parsed.claimBoundary.zedJsonlContainsSplunkReadyFlushFrame).toBe(false);
  });

  it("distinguishes compact Zed evidence that contains a visible recorder flush", async () => {
    const root = await tempRoot();
    const compactWithFlush = [
      ...compactZedJsonl.split("\n").filter(Boolean).map((line) => JSON.parse(line)),
      {
        serverId: "splunkready",
        message: { params: { name: "splunkready_recorder_flush" } }
      },
      {
        serverId: "splunkready",
        message: { result: { structuredContent: { evidenceRefs: ["evt-102", "evt-118", "evt-141"] } } }
      }
    ]
      .map((frame) => JSON.stringify(frame))
      .join("\n");
    await writeBaseTree(root, `${compactWithFlush}\n`);

    const result = await execFileAsync(process.execPath, [scriptPath, "--out", "submission-evidence/mcp-proof"], {
      cwd: root
    });
    const parsed = JSON.parse(result.stdout);

    expect(parsed.status).toBe("PASS_WITH_LIMITATIONS");
    expect(parsed.summary.zedEvidenceTier).toBe("VERIFIED_COMPACT_WITH_FLUSH");
    expect(parsed.claimBoundary.zedJsonlContainsSplunkReadyFlushFrame).toBe(true);
    expect(parsed.claimBoundary.note).toContain("visible recorder-flush JSONL frame");
  });

  it("fails when Zed evidence is missing saved-search execution", async () => {
    const root = await tempRoot();
    const weakJsonl = `${JSON.stringify({
      serverId: "splunk",
      message: { params: { name: "splunk_get_knowledge_objects" } }
    })}\n`;
    await writeBaseTree(root, weakJsonl);

    await expect(
      execFileAsync(process.execPath, [scriptPath, "--out", "submission-evidence/mcp-proof"], { cwd: root })
    ).rejects.toMatchObject({
      code: 1
    });
  });
});
