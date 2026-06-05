import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { runSuiteProofWorkflow, type SuiteProofWorkflowSteps } from "../../src/workflows/suite-proof.js";

const tempRoot = async (): Promise<string> => mkdtemp(join(tmpdir(), "splunkready-suite-proof-workflow-test-"));

const writeJson = async (filePath: string, value: unknown): Promise<string> => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
};

const mission = (id: string, domain: string): unknown => ({
  id,
  title: `${id} title`,
  domain,
  prompt: "Investigate safely.",
  requestedTimeWindow: { earliest: "-24h", latest: "now" },
  expectedTools: ["splunk_get_indexes"],
  allowedTools: ["splunk_get_indexes"],
  forbiddenPatterns: ["index=*"],
  requiredEvidence: [{ ref: "evt-001" }],
  checks: ["SPL-001"],
  severityWeights: { Critical: 10, High: 6, Medium: 3, Low: 1 }
});

const receipt = (missionId: string, verdict: "NOT READY" | "READY", score: number, violations: string[]): unknown => ({
  id: `receipt-${missionId}-${verdict.toLowerCase().replace(" ", "-")}`,
  agent: { name: "Naive Specimen Agent", version: "test" },
  environment: { id: "env-test", name: "Test env" },
  mode: "fixture",
  contractVersion: "contract-test",
  missionSuiteVersion: "suite-test",
  verdict,
  score,
  passedMissions: verdict === "READY" ? [missionId] : [],
  failedMissions: verdict === "READY" ? [] : [missionId],
  criticalViolations: violations,
  violations,
  traceRefs: [`trace-${missionId}`],
  evidenceRefs: verdict === "READY" ? ["evt-001"] : [],
  policyPatchSummary: [{ id: "patch-001", status: "proposed" }],
  rerunComparison: { before: "NOT READY", after: verdict }
});

const readinessProfile = (missionId: string): unknown => ({
  id: `profile-${missionId}`,
  generatedAt: "2026-06-01T06:45:00.000Z",
  compiler: "Agent Readiness Compiler",
  contractRef: { id: "contract-test", name: "Test contract", version: "contract-test", mode: "fixture" },
  missionRefs: [missionId],
  sourceRefs: ["fixture:test"],
  deploymentSignals: {
    mode: "fixture",
    indexCount: 2,
    restrictedIndexCount: 1,
    sourcetypeCount: 1,
    savedSearchCount: 1,
    appContextCount: 1,
    dataModelCount: 0,
    allowedTools: ["splunk_get_indexes"],
    queryBudgets: {
      maxToolCalls: 4,
      maxResultRows: 100,
      timeoutSeconds: 30
    }
  },
  ruleBindings: [
    {
      ruleId: "SPL-001",
      severity: "Critical",
      source: "mission",
      contractRefs: ["contract-test"],
      missionRefs: [missionId],
      evidence: [{ ref: "evt-001", value: "broad query" }],
      rationale: "Block broad query shape."
    }
  ],
  llmUsage: {
    passFailAuthority: "deterministic-rule-engine",
    allowedRoles: ["trace-producer"],
    prohibitedRoles: ["pass-fail-judge"]
  }
});

const violations = (missionId: string): unknown[] => [
  {
    id: `violation-${missionId}`,
    missionId,
    traceEventId: `trace-${missionId}`,
    ruleId: "SPL-001",
    severity: "Critical",
    reason: "Broad query shape.",
    evidence: { query: "index=*" },
    suggestedPolicyPatch: "Use a scoped saved search.",
    evidenceRefs: ["evt-001"]
  }
];

const fakeSteps = (): SuiteProofWorkflowSteps => ({
  compile: async ({ missionPath, outDir }) => {
    const parsedMission = JSON.parse(await readFile(missionPath, "utf8")) as { id: string };
    await writeJson(join(outDir, "readiness-profile.json"), readinessProfile(parsedMission.id));
    return [join(outDir, "environment-contract.json"), join(outDir, "readiness-profile.json")];
  },
  evaluate: async ({ missionPath, outDir }) => {
    const parsedMission = JSON.parse(await readFile(missionPath, "utf8")) as { id: string };
    await writeJson(join(outDir, "violations-before.json"), violations(parsedMission.id));
    return [join(outDir, "trace-before.json"), join(outDir, "violations-before.json")];
  },
  receiptBefore: async ({ missionPath, outDir }) => {
    const parsedMission = JSON.parse(await readFile(missionPath, "utf8")) as { id: string };
    await writeJson(join(outDir, "receipt-before-001.json"), receipt(parsedMission.id, "NOT READY", 45, [`violation-${parsedMission.id}`]));
    return [join(outDir, "receipt-before-001.json")];
  },
  rerun: async ({ missionPath, outDir }) => {
    const parsedMission = JSON.parse(await readFile(missionPath, "utf8")) as { id: string };
    await writeJson(join(outDir, "violations-after.json"), []);
    await writeJson(join(outDir, "receipt-after-001.json"), receipt(parsedMission.id, "READY", 100, []));
    return [join(outDir, "trace-after.json"), join(outDir, "violations-after.json")];
  },
  receiptAfter: async ({ outDir }) => [join(outDir, "receipt-after-001.json")]
});

describe("suite proof workflow", () => {
  it("aggregates fail-to-pass fixture missions and writes compiler diagnostics", async () => {
    const root = await tempRoot();
    const missionsDir = join(root, "missions");
    const outDir = join(root, "suite-proof");
    const securityMission = join(missionsDir, "security.json");
    const observabilityMission = join(missionsDir, "observability.json");
    const suitePath = join(root, "suite.json");

    await writeJson(securityMission, mission("mission-security", "security"));
    await writeJson(observabilityMission, mission("mission-observability", "observability"));
    await writeJson(suitePath, {
      id: "suite-test",
      title: "Suite test",
      missionPaths: ["missions/security.json", "missions/observability.json"]
    });

    const result = await runSuiteProofWorkflow(
      {
        mode: "fixture",
        suitePath,
        outDir,
        requireFailToPass: true,
        generatedAt: "2026-06-01T06:45:00.000Z"
      },
      fakeSteps()
    );

    expect(result).toMatchObject({
      status: "PASS",
      summary: {
        suiteId: "suite-test",
        missionCount: 2,
        domains: ["observability", "security"],
        totals: { failToPass: 2, readyAfterPatch: 2, evidenceRefs: 2 }
      }
    });
    expect(result.artifacts).toEqual(
      expect.arrayContaining([
        join(outDir, "suite-proof-summary.json"),
        join(outDir, "suite-proof-summary.md"),
        join(outDir, "compiler-diagnostics.json"),
        join(outDir, "compiler-diagnostics.md")
      ])
    );
    await expect(readFile(join(outDir, "suite-proof-summary.md"), "utf8")).resolves.toContain("fail-to-pass");
  });

  it("keeps suite proof workflow source independent from the CLI module", async () => {
    const source = await readFile(new URL("../../src/workflows/suite-proof.ts", import.meta.url), "utf8");

    expect(source).not.toContain("../cli.js");
  });
});
