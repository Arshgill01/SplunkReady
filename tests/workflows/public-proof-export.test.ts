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

  it("redacts hosted-model proof and diagnostic artifacts before public export", async () => {
    const root = await tempRoot();
    const sourceDir = join(root, "source");
    const outDir = join(root, "export");
    const secretText =
      "Bearer saia-token TOKEN=saia-token https://10.4.3.2:8089/services 172.16.4.20 /Users/alice/.splunkready";

    await mkdir(sourceDir, { recursive: true });
    await writeJson(join(sourceDir, "trace-after.json"), [
      {
        id: "trace-hosted-model-after",
        missionId: "mission-security-lateral-movement-readiness",
        timestamp: "2026-06-07T08:00:00.000Z",
        actor: "specimen_agent",
        type: "tool_call",
        toolName: "saia_explain_spl",
        toolInput: { query: "search index=*" },
        toolOutputSummary: secretText,
        queryRef: "query-hosted-model",
        timeWindow: { earliest: "-24h", latest: "now" },
        resultCount: 1,
        evidenceRefs: [],
        error: null
      }
    ]);
    await writeJson(join(sourceDir, "hosted-model-proof.json"), {
      status: "PASS",
      mode: "live",
      mutation: false,
      contract: {
        id: "contract-live",
        mode: "live",
        hostedModelTools: ["saia_explain_spl", "saia_optimize_spl"],
        availableTools: ["saia_explain_spl", "saia_optimize_spl"]
      },
      setup: {
        source: "splunkready-live-hosted-model-preflight",
        configured: true,
        requiredEnvironment: [
          { name: "SPLUNKREADY_SPLUNK_MCP_TOKEN", status: "set", requiredValue: "set", purpose: secretText }
        ],
        optionalEnvironment: [],
        operatorCommand: "splunkready hosted-model-diagnostic --mode live --out artifacts/hosted-model-diagnostic --require-pass true --json",
        secretHandling: secretText
      },
      query: "search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now",
      deterministicContext: {
        ruleIds: ["SPL-001", "SPL-003"],
        passFailAuthority: "deterministic-rule-engine",
        purpose: "Hosted model proof."
      },
      toolCalls: ["saia_explain_spl", "saia_optimize_spl"],
      assistance: {
        explanation: secretText,
        optimizedQuery: "search index=wineventlog",
        rationale: secretText,
        warnings: [secretText]
      },
      error: null,
      rawBody: secretText,
      notes: secretText
    });
    await writeJson(join(sourceDir, "hosted-model-diagnostic.json"), {
      status: "PASS",
      mode: "live",
      mutation: false,
      proofPath: "/Users/alice/.splunkready/hosted-model-proof.json",
      contract: { id: "contract-live", mode: "live" },
      setup: {
        source: "splunkready-live-hosted-model-preflight",
        configured: true,
        requiredEnvironment: [],
        optionalEnvironment: [],
        operatorCommand: "splunkready hosted-model-diagnostic --mode live --out artifacts/hosted-model-diagnostic --require-pass true --json",
        secretHandling: secretText
      },
      requiredTools: ["saia_explain_spl", "saia_optimize_spl"],
      availableTools: ["saia_explain_spl", "saia_optimize_spl"],
      missingTools: [],
      permission: { status: "OK", message: secretText },
      deterministicAuthority: "deterministic-rule-engine",
      notes: secretText
    });

    await runPublicProofExportWorkflow({
      outDir,
      sourceRunId: "run-hosted-model",
      sourceDir,
      sourceArtifactBase: "/api/artifacts/run-hosted-model",
      exportArtifactBase: "/api/artifacts/run-hosted-model-public"
    });

    const exportedProof = await readFile(join(outDir, "hosted-model-proof.json"), "utf8");
    const exportedDiagnostic = await readFile(join(outDir, "hosted-model-diagnostic.json"), "utf8");
    const manifest = JSON.parse(await readFile(join(outDir, "public-proof-export-manifest.json"), "utf8")) as {
      files: Array<{ path: string; redacted: boolean }>;
    };

    expect(manifest.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "hosted-model-proof.json", redacted: true }),
        expect.objectContaining({ path: "hosted-model-diagnostic.json", redacted: true })
      ])
    );
    for (const exported of [exportedProof, exportedDiagnostic]) {
      expect(exported).toContain("[REDACTED]");
      expect(exported).toContain("https://[REDACTED-ENDPOINT]");
      expect(exported).not.toContain("saia-token");
      expect(exported).not.toContain("10.4.3.2");
      expect(exported).not.toContain("172.16.4.20");
      expect(exported).not.toContain("/Users/alice");
      expect(exported).not.toContain("Bearer saia-token");
    }
  });
});
