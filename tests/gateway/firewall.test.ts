import { describe, expect, it } from "vitest";

import { createFixtureSplunkAccessAdapter, loadFixtureSplunkDatasetFromFile } from "../../src/adapters/fixture.js";
import type { QueryResult, RunQueryRequest, SplunkAccessAdapter } from "../../src/adapters/splunk-access.js";
import { compileEnvironmentContract } from "../../src/compiler/environment.js";
import { firewallBlockedCode, SplunkFirewallGateway } from "../../src/gateway/firewall.js";
import { compileAgentPolicy } from "../../src/policy/compiler.js";

const loadFirewall = async (override?: Partial<SplunkAccessAdapter>) => {
  const fixture = await loadFixtureSplunkDatasetFromFile("fixtures/acme-soc-dev/adapter-fixture.json");
  const baseAdapter = createFixtureSplunkAccessAdapter(fixture);
  const contract = await compileEnvironmentContract(baseAdapter, {
    requestId: "req-firewall-test-001",
    contractVersion: "2026.06.01",
    generatedAt: "2026-06-01T06:30:00.000Z"
  });
  const policy = compileAgentPolicy(contract, {
    policyVersion: "policy-firewall-test",
    compiledAt: "2026-06-01T06:45:00.000Z"
  });
  const adapter = { ...baseAdapter, ...override } satisfies SplunkAccessAdapter;

  return { firewall: new SplunkFirewallGateway(adapter, contract, policy) };
};

describe("SplunkFirewallGateway", () => {
  it("blocks forbidden broad SPL before delegating to Splunk", async () => {
    let delegated = false;
    const { firewall } = await loadFirewall({
      async runQuery(): Promise<QueryResult> {
        delegated = true;
        throw new Error("not reached");
      }
    });

    await expect(
      firewall.runQuery(
        { query: "search index=* host=win-finance-07 earliest=-24h latest=now", maxRows: 10 },
        { requestId: "req-firewall-block-001", missionId: "mission-firewall-test" }
      )
    ).rejects.toMatchObject({
      code: firewallBlockedCode,
      context: { toolName: "splunk_run_query" },
      message: expect.stringContaining("SPL-001")
    });
    expect(delegated).toBe(false);
  });

  it("blocks sensitive or restricted indexes before delegating to Splunk", async () => {
    const { firewall } = await loadFirewall();

    await expect(
      firewall.runQuery(
        { query: "search index=finance_pii earliest=-24h latest=now | head 10", maxRows: 10 },
        { requestId: "req-firewall-block-002" }
      )
    ).rejects.toMatchObject({
      code: firewallBlockedCode,
      message: expect.stringContaining("SPL-005")
    });
  });

  it("blocks SPL fields and sourcetypes absent from the compiled contract", async () => {
    const { firewall } = await loadFirewall();

    await expect(
      firewall.runQuery(
        { query: "search index=wineventlog src_ip=* earliest=-24h latest=now | head 10", maxRows: 10 },
        { requestId: "req-firewall-block-003" }
      )
    ).rejects.toMatchObject({
      code: firewallBlockedCode,
      message: expect.stringContaining("SPL-003")
    });
  });

  it("allows compliant read-only queries to reach the underlying adapter", async () => {
    const delegatedQueries: RunQueryRequest[] = [];
    const { firewall } = await loadFirewall({
      async runQuery(input): Promise<QueryResult> {
        delegatedQueries.push(input);
        return {
          queryRef: "firewall-allowed-query",
          rows: [],
          resultCount: 0,
          evidenceRefs: [],
          warnings: []
        };
      }
    });

    const result = await firewall.runQuery(
      { query: "search index=wineventlog src=* earliest=-24h latest=now | head 10", maxRows: 10 },
      { requestId: "req-firewall-allow-001" }
    );

    expect(result.queryRef).toBe("firewall-allowed-query");
    expect(delegatedQueries).toEqual([
      { query: "search index=wineventlog src=* earliest=-24h latest=now | head 10", maxRows: 10 }
    ]);
  });
});
