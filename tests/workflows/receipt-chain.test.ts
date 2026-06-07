import { mkdir, readFile, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { generateReadinessReceipt } from "../../src/receipts/generator.js";
import { annotateReceiptChainMetadata, initializeReceiptKeys, runReceiptChainWorkflow, runReceiptReplayWorkflow } from "../../src/workflows/receipt-chain.js";
import type { EnvironmentContract, Mission, ReadinessReceipt, TraceEvent, Violation } from "../../src/schemas/core.js";

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

const environment: EnvironmentContract = {
  id: "contract-acme-soc-dev",
  name: "ACME SOC Dev",
  version: "contract-v1",
  generatedAt: "2026-06-01T06:30:00.000Z",
  mode: "fixture",
  indexes: [{ name: "main", sensitive: false }],
  restrictedIndexes: [],
  sourcetypes: [{ name: "splunkd", fields: ["host", "source"] }],
  canonicalFields: {},
  macros: [],
  lookups: [],
  savedSearches: [],
  dashboardPanels: [],
  dataModels: [],
  appContexts: ["search"],
  mcpTools: ["splunk_run_query"],
  queryBudgets: { maxToolCalls: 4, maxResultRows: 100, timeoutSeconds: 30 },
  evidenceRules: [],
  forbiddenQueryPatterns: ["index=*"]
};

const mission: Mission = {
  id: "mission-security",
  title: "Security readiness",
  domain: "security",
  prompt: "Investigate safely.",
  requestedTimeWindow: { earliest: "-24h", latest: "now" },
  expectedTools: ["splunk_run_query"],
  allowedTools: ["splunk_run_query"],
  forbiddenPatterns: ["index=*"],
  requiredEvidence: [{ type: "result_count" }],
  checks: ["SPL-001"],
  severityWeights: { Critical: 25, High: 15, Medium: 8, Low: 2 }
};

const traceEvents: TraceEvent[] = [
  {
    id: "trace-001",
    missionId: mission.id,
    timestamp: "2026-06-01T06:31:00.000Z",
    type: "final_answer",
    actor: "specimen_agent",
    toolName: null,
    toolInput: null,
    toolOutputSummary: "No unsafe action was taken.",
    queryRef: null,
    timeWindow: null,
    resultCount: 0,
    evidenceRefs: ["evt-001"],
    error: null
  }
];

const replayViolation = (): Violation => ({
  id: "violation-001",
  missionId: mission.id,
  traceEventId: "trace-001",
  ruleId: "SPL-001",
  severity: "Critical",
  reason: "Query contains a forbidden SPL pattern.",
  evidence: { query: "index=*" },
  suggestedPolicyPatch: "Use a scoped index.",
  evidenceRefs: ["evt-001"]
});

const writeReplayBundle = async (outDir: string): Promise<void> => {
  const beforeViolations = [replayViolation()];
  const afterViolations: Violation[] = [];
  const before = generateReadinessReceipt({
    id: "receipt-before-001",
    agent: { name: "Specimen", version: "1.0.0" },
    environment,
    missionSuiteVersion: "suite-v1",
    missions: [mission],
    traceEvents,
    violations: beforeViolations,
    policyPatchSummary: [{ id: "patch-001", status: "generated" }],
    rerunComparison: {}
  }).receipt;
  const after = generateReadinessReceipt({
    id: "receipt-after-001",
    agent: { name: "Specimen", version: "1.0.0" },
    environment,
    missionSuiteVersion: "suite-v1",
    missions: [mission],
    traceEvents,
    violations: afterViolations,
    policyPatchSummary: [],
    rerunComparison: {}
  }).receipt;

  await writeJson(join(outDir, "environment-contract.json"), environment);
  await writeJson(join(outDir, "missions.json"), [mission]);
  await writeJson(join(outDir, "trace-before.json"), traceEvents);
  await writeJson(join(outDir, "trace-after.json"), traceEvents);
  await writeJson(join(outDir, "violations-before.json"), beforeViolations);
  await writeJson(join(outDir, "violations-after.json"), afterViolations);
  await writeJson(join(outDir, "receipt-before-001.json"), before);
  await writeJson(join(outDir, "receipt-after-001.json"), after);
  await annotateReceiptChainMetadata(outDir);
};

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

  it("signs and verifies the receipt chain with an Ed25519 key pair", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-receipt-chain-sign-"));
    const keyDir = await mkdtemp(join(tmpdir(), "splunkready-receipt-chain-keys-"));

    await writeJson(join(outDir, "receipt-before-001.json"), receipt());
    const [publicKeyPath, privateKeyPath] = await initializeReceiptKeys(keyDir);

    const signed = await runReceiptChainWorkflow({
      dir: outDir,
      publicKeyPath,
      privateKeyPath,
      generatedAt: "2026-06-07T00:00:00.000Z"
    });

    expect(signed.status).toBe("PASS");
    expect(signed.report.signature).toMatchObject({
      algorithm: "ed25519",
      signedPayload: "chainDigest",
      status: "SIGNED"
    });
    expect(signed.report.signature.signatureBase64).toEqual(expect.any(String));

    const verified = await runReceiptChainWorkflow({
      dir: outDir,
      publicKeyPath,
      generatedAt: "2026-06-07T00:00:00.000Z"
    });

    expect(verified.status).toBe("PASS");
    expect(verified.report.signature.status).toBe("VERIFIED");

    await writeJson(join(outDir, "receipt-before-001.json"), receipt({ score: 61 }));

    const tampered = await runReceiptChainWorkflow({
      dir: outDir,
      publicKeyPath,
      generatedAt: "2026-06-07T00:00:00.000Z"
    });

    expect(tampered.status).toBe("FAIL");
    expect(tampered.report.signature.status).toBe("INVALID");
    expect(tampered.report.failures).toEqual([`Receipt chain signature does not verify with ${publicKeyPath}.`]);
  });

  it("embeds and validates receipt chain metadata", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-receipt-chain-metadata-"));

    await writeJson(join(outDir, "receipt-before-001.json"), receipt());
    await writeJson(join(outDir, "receipt-after-001.json"), receipt({ id: "receipt-after-001", score: 100, verdict: "READY" }));

    await annotateReceiptChainMetadata(outDir);

    const before = JSON.parse(await readFile(join(outDir, "receipt-before-001.json"), "utf8")) as ReadinessReceipt;
    const after = JSON.parse(await readFile(join(outDir, "receipt-after-001.json"), "utf8")) as ReadinessReceipt;

    expect(before.receiptHash).toMatch(/^[a-f0-9]{64}$/);
    expect(before.previousReceiptHash).toBeNull();
    expect(after.previousReceiptHash).toBe(before.receiptHash);

    const verified = await runReceiptChainWorkflow({ dir: outDir, generatedAt: "2026-06-07T00:00:00.000Z" });

    expect(verified.status).toBe("PASS");

    await writeJson(join(outDir, "receipt-after-001.json"), { ...after, previousReceiptHash: null });

    const mismatched = await runReceiptChainWorkflow({ dir: outDir, generatedAt: "2026-06-07T00:00:00.000Z" });

    expect(mismatched.status).toBe("FAIL");
    expect(mismatched.report.failures).toContain(
      "receipt-after-001.json: embedded previousReceiptHash does not match the preceding receipt hash."
    );
  });

  it("replays receipts from proof-bundle inputs and detects tampering", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-receipt-replay-"));

    await writeReplayBundle(outDir);

    const replayed = await runReceiptReplayWorkflow({ dir: outDir, generatedAt: "2026-06-07T00:00:00.000Z" });

    expect(replayed.status).toBe("PASS");
    expect(replayed.report).toMatchObject({
      source: "splunkready-receipt-replay",
      mutation: false,
      deterministicAuthority: true,
      replayedReceiptCount: 2
    });
    expect(replayed.report.entries.every((entry) => entry.replayMatches)).toBe(true);

    const after = JSON.parse(await readFile(join(outDir, "receipt-after-001.json"), "utf8")) as ReadinessReceipt;
    await writeJson(join(outDir, "receipt-after-001.json"), { ...after, score: 99 });

    const tampered = await runReceiptReplayWorkflow({ dir: outDir, generatedAt: "2026-06-07T00:00:00.000Z" });

    expect(tampered.status).toBe("FAIL");
    expect(tampered.report.failures).toContain(
      "receipt-after-001.json: replayed receipt hash does not match source receipt hash."
    );
  });
});
