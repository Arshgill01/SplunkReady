import { describe, expect, it } from "vitest";

import { createFixtureSplunkAccessAdapter, loadFixtureSplunkDatasetFromFile } from "../../src/adapters/fixture.js";
import { compileEnvironmentContract } from "../../src/compiler/environment.js";
import { compileAgentPolicy, exportAgentPolicy } from "../../src/policy/compiler.js";

const fixturePath = new URL("../../fixtures/acme-soc-dev/adapter-fixture.json", import.meta.url);
const compileOptions = {
  requestId: "req-policy-001",
  contractVersion: "2026.06.01",
  generatedAt: "2026-06-01T06:30:00.000Z"
};
const policyOptions = {
  policyVersion: "policy-2026.06.01",
  compiledAt: "2026-06-01T06:45:00.000Z"
};

const compileFixturePolicy = async () => {
  const fixture = await loadFixtureSplunkDatasetFromFile(fixturePath);
  const adapter = createFixtureSplunkAccessAdapter(fixture);
  const contract = await compileEnvironmentContract(adapter, compileOptions);

  return compileAgentPolicy(contract, policyOptions);
};

describe("agent policy compiler", () => {
  it("compiles a policy that references the environment contract", async () => {
    const policy = await compileFixturePolicy();

    expect(policy).toMatchObject({
      id: "policy-contract-acme-soc-dev-policy-2026-06-01",
      version: "policy-2026.06.01",
      compiledAt: "2026-06-01T06:45:00.000Z",
      contractRef: {
        id: "contract-acme-soc-dev",
        name: "acme-soc-dev",
        version: "2026.06.01",
        mode: "fixture"
      },
      queryBudgets: { maxToolCalls: 6, maxResultRows: 50, timeoutSeconds: 30 },
      exportTargets: ["specimen-agent"]
    });
    expect(policy.allowedTools).toEqual([...policy.allowedTools].sort());
  });

  it("blocks broad query patterns and restricted indexes from contract data", async () => {
    const policy = await compileFixturePolicy();

    expect(policy.queryRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "SPL-001",
          action: "block",
          contractRef: "contract-acme-soc-dev.forbiddenQueryPatterns",
          value: { pattern: "index=*" }
        })
      ])
    );
    expect(policy.resourceRules).toEqual([
      expect.objectContaining({
        ruleId: "SPL-005",
        action: "block",
        contractRef: "contract-acme-soc-dev.restrictedIndexes",
        value: { index: "finance_pii" }
      })
    ]);
  });

  it("derives saved-search, app-context, evidence, and untrusted-data rules", async () => {
    const policy = await compileFixturePolicy();

    expect(policy.knowledgeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "KO-001",
          action: "prefer",
          value: expect.objectContaining({
            savedSearches: expect.arrayContaining([
              { app: "SplunkEnterpriseSecuritySuite", name: "ES - Lateral Movement Auth Chain" }
            ])
          })
        }),
        expect.objectContaining({
          ruleId: "KO-002",
          value: { appContexts: ["SplunkEnterpriseSecuritySuite", "search"] }
        })
      ])
    );
    expect(policy.evidenceRules.map((rule) => rule.ruleId)).toEqual(["EVD-001", "EVD-003"]);
    expect(policy.safetyRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "SAF-001",
          action: "treat_as_untrusted",
          value: { source: "splunk_event_text" }
        }),
        expect.objectContaining({
          ruleId: "SAF-002",
          value: { maxToolCalls: 6, maxResultRows: 50, timeoutSeconds: 30 }
        }),
        expect.objectContaining({
          ruleId: "SAF-003",
          value: expect.objectContaining({
            allowedTools: expect.arrayContaining(["splunk_run_query", "splunk_run_saved_search"])
          })
        })
      ])
    );
  });

  it("exports stable specimen-agent policy JSON", async () => {
    const policy = await compileFixturePolicy();
    const exported = exportAgentPolicy(policy);
    const parsed = JSON.parse(exported) as typeof policy;

    expect(parsed).toEqual(policy);
    expect(exported).toContain('"id": "policy-contract-acme-soc-dev-policy-2026-06-01"');
    expect(exported).toContain('"ruleId": "SPL-001"');
    expect(exported).toContain('"exportTargets": [\n    "specimen-agent"\n  ]');
    expect(exported.endsWith("\n")).toBe(true);
  });
});
