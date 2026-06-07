import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runPublicProofExportWorkflow } from "../../src/workflows/public-proof-export.js";

const tempRoot = async (): Promise<string> => mkdtemp(join(tmpdir(), "splunkready-public-proof-export-test-"));

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

describe("public proof export workflow", () => {
  it("redacts live security proof summaries before public export", async () => {
    const root = await tempRoot();
    const sourceDir = join(root, "source");
    const outDir = join(root, "export");
    const secretText =
      "Bearer live-token TOKEN=live-token https://10.9.8.7:8089/services 192.168.1.42 /Users/alice/.splunkready";

    await mkdir(sourceDir, { recursive: true });
    await writeJson(join(sourceDir, "trace-after.json"), [
      {
        id: "trace-live-security-after",
        missionId: "mission-security-lateral-movement-readiness",
        timestamp: "2026-06-07T08:00:00.000Z",
        actor: "specimen_agent",
        type: "tool_call",
        toolName: "splunk_run_saved_search",
        toolInput: { savedSearch: "SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain" },
        toolOutputSummary: secretText,
        queryRef: "query-live-security-after",
        timeWindow: { earliest: "-24h", latest: "now" },
        resultCount: 3,
        evidenceRefs: ["live-evt-102", "live-evt-118", "live-evt-141"],
        error: null
      }
    ]);
    await writeJson(join(sourceDir, "live-security-proof-summary.json"), {
      source: "splunkready-live-security-proof",
      status: "PASS",
      mutation: false,
      failToPass: true,
      readyAfterPatch: true,
      endpoint: "https://10.9.8.7:8089/services",
      token: "live-token",
      rawBody: secretText,
      operatorPath: "/Users/alice/.splunkready/live.env",
      nested: {
        privateIp: "192.168.1.42",
        authorization: "Bearer live-token"
      }
    });

    await runPublicProofExportWorkflow({
      outDir,
      sourceRunId: "run-live-security",
      sourceDir,
      sourceArtifactBase: "/api/artifacts/run-live-security",
      exportArtifactBase: "/api/artifacts/run-live-security-public"
    });

    const exportedSummary = await readFile(join(outDir, "live-security-proof-summary.json"), "utf8");
    const manifest = JSON.parse(await readFile(join(outDir, "public-proof-export-manifest.json"), "utf8")) as {
      redactionStatus: string;
      files: Array<{ path: string; redacted: boolean }>;
    };

    expect(manifest.redactionStatus).toBe("REDACTED");
    expect(manifest.files).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "live-security-proof-summary.json", redacted: true })])
    );
    expect(exportedSummary).toContain("[REDACTED]");
    expect(exportedSummary).toContain("https://[REDACTED-ENDPOINT]");
    expect(exportedSummary).not.toContain("live-token");
    expect(exportedSummary).not.toContain("10.9.8.7");
    expect(exportedSummary).not.toContain("192.168.1.42");
    expect(exportedSummary).not.toContain("/Users/alice");
    expect(exportedSummary).not.toContain("Bearer live-token");
  });
});
