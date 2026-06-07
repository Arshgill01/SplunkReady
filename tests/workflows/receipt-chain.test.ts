import { mkdir, readFile, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { runReceiptChainWorkflow } from "../../src/workflows/receipt-chain.js";
import type { ReadinessReceipt } from "../../src/schemas/core.js";

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const receipt = (overrides: Partial<ReadinessReceipt> = {}): ReadinessReceipt => ({
  id: "receipt-before-001",
  agent: { name: "Specimen", version: "1.0.0" },
  environment: { id: "contract-acme-soc-dev", name: "ACME SOC Dev" },
  mode: "fixture",
  contractVersion: "contract-v1",
  missionSuiteVersion: "suite-v1",
  verdict: "NOT READY",
  score: 60,
  passedMissions: [],
  failedMissions: ["mission-security"],
  criticalViolations: ["violation-001"],
  violations: ["violation-001"],
  traceRefs: ["trace-001"],
  evidenceRefs: ["evt-001"],
  policyPatchSummary: [{ id: "patch-001", status: "generated" }],
  rerunComparison: {},
  generatedBy: "Agent Readiness Compiler",
  ...overrides
});

describe("receipt chain workflow", () => {
  it("builds a deterministic hash chain from schema-valid receipts", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-receipt-chain-"));

    await writeJson(join(outDir, "mission-a", "receipt-before-001.json"), receipt());
    await writeJson(
      join(outDir, "mission-a", "receipt-after-001.json"),
      receipt({
        id: "receipt-after-001",
        verdict: "READY",
        score: 100,
        passedMissions: ["mission-security"],
        failedMissions: [],
        criticalViolations: [],
        violations: []
      })
    );

    const result = await runReceiptChainWorkflow({ dir: outDir, generatedAt: "2026-06-07T00:00:00.000Z" });
    const artifact = JSON.parse(await readFile(join(outDir, "receipt-chain.json"), "utf8")) as typeof result.report;

    expect(result.status).toBe("PASS");
    expect(artifact).toMatchObject({
      source: "splunkready-receipt-chain",
      status: "PASS",
      mutation: false,
      deterministicAuthority: true,
      receiptCount: 2,
      chainValid: true
    });
    expect(artifact.entries).toHaveLength(2);
    expect(artifact.entries[0]).toMatchObject({
      sequence: 1,
      path: "mission-a/receipt-before-001.json",
      previousReceiptHash: null
    });
    expect(artifact.entries[1].previousReceiptHash).toBe(artifact.entries[0].receiptHash);
    expect(artifact.entries[1].receiptHash).toMatch(/^[a-f0-9]{64}$/);

    const rerun = await runReceiptChainWorkflow({ dir: outDir, generatedAt: "2026-06-07T00:00:00.000Z" });

    expect(rerun.status).toBe("PASS");
    expect(rerun.report.receiptCount).toBe(2);
    expect(rerun.report.entries.map((entry) => entry.path)).toEqual([
      "mission-a/receipt-before-001.json",
      "mission-a/receipt-after-001.json"
    ]);
  });

  it("fails when a requested public key is missing", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-receipt-chain-missing-key-"));

    await writeJson(join(outDir, "receipt-before-001.json"), receipt());

    const result = await runReceiptChainWorkflow({
      dir: outDir,
      publicKeyPath: join(outDir, "missing-public-key.pem")
    });

    expect(result.status).toBe("FAIL");
    expect(result.report.publicKey.status).toBe("MISSING");
    expect(result.report.failures).toEqual([`Public key not found: ${join(outDir, "missing-public-key.pem")}`]);
  });
});
