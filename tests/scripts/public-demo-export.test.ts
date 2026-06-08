import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { exportPublicDemo } from "../../scripts/export-public-demo.js";

const tempRoot = async (): Promise<string> => mkdtemp(join(tmpdir(), "splunkready-public-demo-test-"));

const writeFixture = async (path: string, value: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");
};

const createSourceTree = async (): Promise<string> => {
  const root = await tempRoot();

  await writeFixture(join(root, "dist-ui", "index.html"), "<!doctype html><div id=\"app\"></div>");
  await writeFixture(join(root, "dist-ui", "assets", "index.js"), "window.__splunkready = true;");
  await writeFixture(join(root, "submission-evidence", "mcp-proof", "mcp-proof-summary.json"), "{\"status\":\"PASS\"}\n");
  await writeFixture(join(root, "submission-evidence", "mcp-proof", "mcp-client-session.jsonl"), "{\"method\":\"initialize\"}\n");
  await writeFixture(join(root, "submission-evidence", "mcp-proof", "mcp-client-session.md"), "# MCP client session\n");
  await writeFixture(join(root, "submission-evidence", "suite-proof", "suite-proof-summary.json"), "{\"status\":\"PASS\"}\n");
  await writeFixture(
    join(root, "submission-evidence", "public-proof-export", "public-proof-summary.json"),
    "{\"status\":\"REDACTED\"}\n"
  );
  await writeFixture(
    join(root, "submission-evidence", "real-splunk-stress-llm-layer", "llm-deliberation-before.json"),
    "{\"source\":\"splunkready-llm-deliberation\",\"phase\":\"before\"}\n"
  );
  await writeFixture(
    join(root, "submission-evidence", "real-splunk-stress-llm-layer", "llm-deliberation-after.json"),
    "{\"source\":\"splunkready-llm-deliberation\",\"phase\":\"after\"}\n"
  );
  await writeFixture(
    join(root, "submission-evidence", "real-splunk-stress-llm-layer", "llm-claim-audit-before.json"),
    "{\"source\":\"splunkready-llm-claim-audit\",\"status\":\"PASS\"}\n"
  );
  await writeFixture(
    join(root, "submission-evidence", "real-splunk-stress-llm-layer", "llm-claim-audit-after.json"),
    "{\"source\":\"splunkready-llm-claim-audit\",\"status\":\"PASS\"}\n"
  );
  await writeFixture(
    join(root, "submission-evidence", "real-splunk-stress-llm-layer", "real-splunk-stress-replay-summary.json"),
    "{\"status\":\"PASS\",\"mutation\":false}\n"
  );
  await writeFixture(
    join(root, "submission-evidence", "real-splunk-stress-llm-layer", "ui-artifacts.json"),
    "{\"source\":\"splunkready-ui-artifacts\",\"version\":1,\"artifacts\":[{\"label\":\"Real Splunk LLM stress proof\",\"path\":\"artifacts/real-splunk-stress-llm-layer\"}]}\n"
  );
  await writeFixture(join(root, "submission-evidence", "screenshots", "workbench-mcp-proof.png"), "png-bytes");
  await writeFixture(join(root, "submission-evidence", "screenshots", "workbench-llm-deliberation.png"), "llm-png-bytes");
  await writeFixture(join(root, "submission-evidence", "screenshots", "public-demo-llm-deliberation.png"), "public-llm-png-bytes");

  return root;
};

const generateJudgeProofFixture = async ({ targetArtifactDir }: { targetArtifactDir: string }): Promise<void> => {
  const interactiveSource = join(targetArtifactDir, "suite-proof", "mission-security-lateral-movement-readiness");

  await writeFixture(
    join(targetArtifactDir, "judge-proof-summary.json"),
    `${JSON.stringify({
      source: "splunkready-judge-proof",
      status: "PASS",
      mode: "fixture",
      mutation: false,
      generatedAt: "2026-06-06T00:00:00.000Z",
      llmActivation: {
        policy: "include-when-requested-or-env-enabled",
        includeRequested: false,
        enabledByEnv: false,
        configured: false,
        included: false
      },
      proofDirs: {
        suite: "out/public-demo/artifacts/judge-proof/suite-proof",
        firewall: "out/public-demo/artifacts/judge-proof/firewall-check",
        llm: "out/public-demo/artifacts/judge-proof/llm-proof"
      },
      gates: [],
      llmEvidence: {
        status: "NOT_REQUESTED",
        role: "trace-producer",
        passFailAuthority: "deterministic-rule-engine",
        proofDir: "out/public-demo/artifacts/judge-proof/llm-proof",
        artifacts: [],
        reason: "credential-free public export",
        nextCommand: "npm run splunkready -- judge-proof --out artifacts/judge-proof --include-llm-proof true --json"
      },
      certificationIndex: "out/public-demo/artifacts/judge-proof/certification-index.json",
      uiArtifacts: "out/public-demo/artifacts/judge-proof/ui-artifacts.json",
      nextCommands: ["npm run workbench"]
    })}\n`
  );
  await writeFixture(join(targetArtifactDir, "judge-proof-summary.md"), "# SplunkReady Judge Proof\n");
  await writeFixture(join(interactiveSource, "environment-contract.json"), "{\"id\":\"contract-acme-soc-dev\"}\n");
  await writeFixture(join(interactiveSource, "missions.json"), "[{\"id\":\"mission-security-lateral-movement-readiness\"}]\n");
  await writeFixture(join(interactiveSource, "trace-after.json"), "[]\n");
};

describe("public demo export", () => {
  it("copies the built UI and credential-free proof evidence into one static folder", async () => {
    const root = await createSourceTree();
    const result = await exportPublicDemo({
      root,
      outDir: "out/public-demo",
      generatedAt: "2026-06-06T00:00:00.000Z",
      generateJudgeProof: generateJudgeProofFixture,
      sourceCommit: "public-demo-input-commit",
      deploymentCommit: "workflow-dispatch-commit"
    });

    await expect(readFile(join(root, "out/public-demo/index.html"), "utf8")).resolves.toContain("app");
    await expect(readFile(join(root, "out/public-demo/assets/index.js"), "utf8")).resolves.toContain("splunkready");
    await expect(readFile(join(root, "out/public-demo/artifacts/mcp-proof/mcp-proof-summary.json"), "utf8")).resolves.toContain(
      "PASS"
    );
    await expect(readFile(join(root, "out/public-demo/artifacts/mcp-proof/artifact-manifest.json"), "utf8")).resolves.toContain(
      "mcp-proof-summary.json"
    );
    await expect(readFile(join(root, "out/public-demo/artifacts/mcp-proof/mcp-client-session.jsonl"), "utf8")).resolves.toContain(
      "initialize"
    );
    await expect(readFile(join(root, "out/public-demo/screenshots/workbench-mcp-proof.png"), "utf8")).resolves.toBe("png-bytes");
    await expect(readFile(join(root, "out/public-demo/screenshots/workbench-llm-deliberation.png"), "utf8")).resolves.toBe(
      "llm-png-bytes"
    );
    await expect(readFile(join(root, "out/public-demo/screenshots/public-demo-llm-deliberation.png"), "utf8")).resolves.toBe(
      "public-llm-png-bytes"
    );
    await expect(
      readFile(join(root, "out/public-demo/artifacts/real-splunk-stress-llm-layer/llm-deliberation-before.json"), "utf8")
    ).resolves.toContain("splunkready-llm-deliberation");
    await expect(
      readFile(join(root, "out/public-demo/artifacts/real-splunk-stress-llm-layer/artifact-manifest.json"), "utf8")
    ).resolves.toContain("llm-claim-audit-after.json");
    await expect(readFile(join(root, "out/public-demo/artifacts/judge-proof/judge-proof-summary.json"), "utf8")).resolves.toContain(
      "deterministic-rule-engine"
    );
    await expect(readFile(join(root, "out/public-demo/artifacts/judge-proof/artifact-manifest.json"), "utf8")).resolves.toContain(
      "judge-proof-summary.json"
    );
    await expect(readFile(join(root, "out/public-demo/public-demo-manifest.json"), "utf8")).resolves.toContain(
      "?artifacts=artifacts%2Fmcp-proof#mcp-proof"
    );
    await expect(readFile(join(root, "out/public-demo/public-demo-manifest.json"), "utf8")).resolves.toContain(
      "?demo=interactive"
    );
    await expect(
      readFile(join(root, "out/public-demo/artifacts/interactive-demo/artifact-manifest.json"), "utf8")
    ).resolves.toContain("trace-after.json");
    expect(result.copiedArtifactBases).toEqual([
      "artifacts/mcp-proof",
      "artifacts/suite-proof",
      "artifacts/public-proof-export",
      "artifacts/real-splunk-stress-llm-layer",
      "artifacts/judge-proof",
      "artifacts/interactive-demo"
    ]);
    expect(result.manifest.mutation).toBe(false);
    expect(result.manifest.sourceCommit).toBe("public-demo-input-commit");
    expect(result.manifest.deploymentCommit).toBe("workflow-dispatch-commit");
  });

  it("refuses to copy symbolic links into the public demo export", async () => {
    const root = await createSourceTree();

    await symlink(
      join(root, "outside-secret.txt"),
      join(root, "submission-evidence", "mcp-proof", "linked-secret.txt")
    );

    await expect(
      exportPublicDemo({ root, outDir: "out/public-demo", generateJudgeProof: generateJudgeProofFixture })
    ).rejects.toThrow(
      "Refusing to copy symbolic link into public demo export"
    );
  });
});
