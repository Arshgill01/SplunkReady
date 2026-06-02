import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { createFixtureSplunkAccessAdapter, loadFixtureSplunkDatasetFromFile } from "../../src/adapters/fixture.js";
import { NaiveSpecimenAgent } from "../../src/agents/specimen.js";
import { compileEnvironmentContract } from "../../src/compiler/environment.js";
import { parseMissionDefinition } from "../../src/missions/dsl.js";
import { compileAgentPolicy } from "../../src/policy/compiler.js";
import { generatePolicyPatch } from "../../src/policy/patch.js";
import { generateReadinessReceipt } from "../../src/receipts/generator.js";
import { policyPatchSchema, type Mission, type TraceEvent, type Violation } from "../../src/schemas/core.js";

const fixturePath = new URL("../../fixtures/acme-soc-dev/adapter-fixture.json", import.meta.url);
const missionPath = new URL(
  "../../fixtures/acme-soc-dev/missions/security-investigation-readiness.json",
  import.meta.url
);
const compileOptions = {
  requestId: "req-policy-patch-001",
  contractVersion: "2026.06.01",
  generatedAt: "2026-06-01T06:30:00.000Z"
};

const mission: Mission = {
  id: "mission-security-lateral-movement-readiness",
  title: "Security Investigation Readiness",
  domain: "security",
  prompt: "Investigate win-finance-07 authentication activity for the last 24 hours.",
  requestedTimeWindow: { earliest: "-24h", latest: "now" },
  expectedTools: ["splunk_get_knowledge_objects", "splunk_run_saved_search"],
  allowedTools: ["splunk_get_knowledge_objects", "splunk_run_saved_search", "splunk_run_query"],
  forbiddenPatterns: ["index=*"],
  requiredEvidence: [{ type: "query_provenance" }],
  checks: ["KO-001", "EVD-001", "SAF-001", "SAF-002"],
  severityWeights: { Critical: 25, High: 15, Medium: 8, Low: 2 }
};

const traceEvent = (id: string): TraceEvent => ({
  id,
  missionId: mission.id,
  timestamp: "2026-06-01T06:31:00.000Z",
  actor: "specimen_agent",
  type: "final_answer",
  toolName: null,
  toolInput: null,
  toolOutputSummary: "No evidence was found by the naive broad search.",
  queryRef: null,
  timeWindow: mission.requestedTimeWindow,
  resultCount: 0,
  evidenceRefs: [],
  error: null
});

const violation = (overrides: Partial<Violation> & Pick<Violation, "id" | "ruleId" | "severity">): Violation => ({
  missionId: mission.id,
  traceEventId: "trace-final-answer",
  reason: "Observed deterministic readiness failure.",
  evidence: { source: "test" },
  suggestedPolicyPatch: "Patch observed agent behavior.",
  ...overrides
});

const loadReceiptFixture = async () => {
  const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
  const adapter = createFixtureSplunkAccessAdapter(fixture);
  const environment = await compileEnvironmentContract(adapter, compileOptions);
  const violations = [
    violation({
      id: "violation-spl-001",
      ruleId: "SPL-001",
      severity: "Critical",
      traceEventId: "trace-query-call",
      evidence: { query: "search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now" }
    }),
    violation({ id: "violation-ko-001", ruleId: "KO-001", severity: "High" }),
    violation({ id: "violation-evd-001", ruleId: "EVD-001", severity: "Critical" }),
    violation({ id: "violation-saf-002", ruleId: "SAF-002", severity: "High" }),
    violation({ id: "violation-saf-001", ruleId: "SAF-001", severity: "Critical" })
  ];
  const generatedReceipt = generateReadinessReceipt({
    id: "receipt-before-001",
    agent: { name: "Naive SOC MCP Agent", version: "0.1.0" },
    environment,
    missionSuiteVersion: "security-readiness-1",
    missions: [mission],
    traceEvents: [traceEvent("trace-final-answer")],
    violations,
    policyPatchSummary: []
  });

  return { adapter, environment, generatedReceipt, violations };
};

describe("policy patch export", () => {
  it("exports machine-readable and human-readable patch rules tied to observed violations", async () => {
    const { environment, generatedReceipt, violations } = await loadReceiptFixture();
    const generatedPatch = generatePolicyPatch({
      id: "patch-security-readiness",
      createdAt: "2026-06-01T06:45:00.000Z",
      sourceReceipt: generatedReceipt.receipt,
      targetAgent: generatedReceipt.receipt.agent,
      environment,
      violations
    });

    expect(policyPatchSchema.safeParse(generatedPatch.patch).success).toBe(true);
    expect(generatedPatch.patch).toMatchObject({
      id: "patch-security-readiness",
      sourceReceiptId: "receipt-before-001",
      targetAgent: { name: "Naive SOC MCP Agent", version: "0.1.0" },
      violationRefs: [
        "violation-spl-001",
        "violation-ko-001",
        "violation-evd-001",
        "violation-saf-002",
        "violation-saf-001"
      ],
      status: "exported"
    });
    expect(generatedPatch.patch.rules.map((rule) => rule.id)).toEqual([
      "inject-contract-summary",
      "discover-saved-searches-first",
      "carry-evidence-into-final-answer",
      "stay-inside-query-budget",
      "treat-splunk-event-text-as-data"
    ]);
    expect(JSON.parse(generatedPatch.json)).toEqual(generatedPatch.patch);
    expect(generatedPatch.markdown).toContain("# Policy Patch: patch-security-readiness");
    expect(generatedPatch.markdown).toContain("`violation-evd-001`");
    expect(generatedPatch.markdown).toContain("This patch is exported for human review. It does not mutate Splunk.");
  });

  it("embeds SAIA explain and optimize output for SPL violations", async () => {
    const { environment, generatedReceipt, violations } = await loadReceiptFixture();
    const generatedPatch = generatePolicyPatch({
      id: "patch-security-readiness",
      createdAt: "2026-06-01T06:45:00.000Z",
      sourceReceipt: generatedReceipt.receipt,
      targetAgent: generatedReceipt.receipt.agent,
      environment,
      violations,
      splAssistance: [
        {
          violationRef: "violation-spl-001",
          ruleId: "SPL-001",
          query: "search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now",
          explanation: "The query searches all indexes and references src_ip.",
          optimizedQuery: "search index=wineventlog host=win-finance-07 src=* earliest=-24h latest=now",
          rationale: "Narrow to the known authentication index and canonical src field.",
          warnings: ["Prefer a validated saved search."]
        }
      ]
    });

    expect(generatedPatch.patch.splAssistance).toEqual([
      expect.objectContaining({
        violationRef: "violation-spl-001",
        ruleId: "SPL-001",
        optimizedQuery: "search index=wineventlog host=win-finance-07 src=* earliest=-24h latest=now"
      })
    ]);
    expect(generatedPatch.markdown).toContain("## SAIA Assistance");
    expect(generatedPatch.markdown).toContain("SAIA Explanation: The query searches all indexes and references src_ip.");
    expect(generatedPatch.markdown).toContain(
      "SAIA Optimized Query: `search index=wineventlog host=win-finance-07 src=* earliest=-24h latest=now`"
    );
    expect(generatedPatch.markdown).toContain("SAIA Rationale: Narrow to the known authentication index and canonical src field.");
  });

  it("keeps patch text scoped and free of Splunk write operations", async () => {
    const { environment, generatedReceipt, violations } = await loadReceiptFixture();
    const generatedPatch = generatePolicyPatch({
      id: "patch-security-readiness",
      createdAt: "2026-06-01T06:45:00.000Z",
      sourceReceipt: generatedReceipt.receipt,
      targetAgent: generatedReceipt.receipt.agent,
      environment,
      violations
    });
    const allText = `${generatedPatch.json}\n${generatedPatch.markdown}`;

    expect(allText).toContain("This patch does not change Splunk configuration.");
    expect(allText).not.toMatch(/\bsplunk_(?:delete|update|create|edit|write)_/i);
    expect(allText).not.toContain("apply to Splunk");
  });

  it("rejects violations that are not referenced by the source receipt", async () => {
    const { environment, generatedReceipt, violations } = await loadReceiptFixture();

    expect(() =>
      generatePolicyPatch({
        id: "patch-security-readiness",
        createdAt: "2026-06-01T06:45:00.000Z",
        sourceReceipt: generatedReceipt.receipt,
        targetAgent: generatedReceipt.receipt.agent,
        environment,
        violations: [...violations, violation({ id: "violation-missing", ruleId: "SPL-001", severity: "Critical" })]
      })
    ).toThrow("Policy patch violations missing from source receipt: violation-missing");
  });

  it("supports the before and after fixture rerun path used by the patch", async () => {
    const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
    const adapter = createFixtureSplunkAccessAdapter(fixture);
    const environment = await compileEnvironmentContract(adapter, compileOptions);
    const policy = compileAgentPolicy(environment, {
      policyVersion: "policy-2026.06.01",
      compiledAt: "2026-06-01T06:45:00.000Z"
    });
    const loadedMission = parseMissionDefinition(JSON.parse(await readFile(missionPath, "utf8")) as unknown);
    const agent = new NaiveSpecimenAgent();
    const before = await agent.run({ mission: loadedMission, adapter });
    const after = await agent.run({ mission: loadedMission, adapter, policy });

    expect(before.traceEvents[0]).toMatchObject({
      toolName: "splunk_run_query",
      toolInput: {
        query: "search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now"
      }
    });
    expect(after.traceEvents[2]).toMatchObject({
      toolName: "splunk_run_saved_search",
      toolInput: {
        name: "ES - Lateral Movement Auth Chain",
        app: "SplunkEnterpriseSecuritySuite"
      }
    });
    expect(after.finalAnswer).toContain("Evidence supports the investigation");
  });
});
