import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { runProofAuditWorkflow } from "../../src/workflows/proof-audit.js";

const tempRoot = async (): Promise<string> => mkdtemp(join(tmpdir(), "splunkready-proof-audit-test-"));

const writeJson = async (filePath: string, value: unknown): Promise<string> => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
};

describe("proof audit workflow", () => {
  it("audits a passing suite proof summary without importing the CLI", async () => {
    const outDir = await tempRoot();
    await writeJson(join(outDir, "suite-proof-summary.json"), {
      status: "PASS",
      mode: "fixture",
      mutation: false,
      suiteId: "suite-proof-test",
      missionCount: 2,
      totals: {
        failToPass: 2,
        readyAfterPatch: 2,
        evidenceRefs: 4
      },
      missions: [
        { missionId: "mission-one", proofLoop: "fail-to-pass" },
        { missionId: "mission-two", proofLoop: "fail-to-pass" }
      ]
    });

    const result = await runProofAuditWorkflow({ outDir, requirePass: true, generatedAt: "2026-06-05T00:00:00.000Z" });
    const audit = JSON.parse(await readFile(join(outDir, "proof-audit.json"), "utf8")) as { status: string; proofType: string };

    expect(result.status).toBe("PASS");
    expect(result.artifacts).toEqual(
      expect.arrayContaining([join(outDir, "proof-audit.json"), join(outDir, "proof-manifest.json")])
    );
    expect(audit).toMatchObject({ status: "PASS", proofType: "suite" });
  });

  it("enforces strict proof-audit failure when required artifacts are absent", async () => {
    const outDir = await tempRoot();

    await expect(runProofAuditWorkflow({ outDir, requirePass: true })).rejects.toThrow(
      "proof-audit strict gate failed with FAIL"
    );
  });
});
