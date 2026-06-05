import { mkdtemp, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  runLiveCandidatesWorkflow,
  runLiveSecurityKitWorkflow,
  runLiveSecurityReadinessWorkflow,
  runLiveSmokeWorkflow
} from "../../src/workflows/live-actions.js";

const tempRoot = async (): Promise<string> => mkdtemp(join(tmpdir(), "splunkready-live-actions-test-"));

const defaultSavedSearchRows = [
  { eventRef: "live-evt-102", user: "svc-finance", dest: "win-finance-07" },
  { eventRef: "live-evt-118", user: "svc-finance", dest: "win-finance-07" },
  { eventRef: "live-evt-141", user: "svc-finance", dest: "win-finance-07" }
];

const startMockMcpServer = async (
  options: {
    indexes?: Array<{ name: string; sensitive: boolean }>;
    savedSearches?: Array<{ id: string; type: string; name: string; app: string }>;
    savedSearchRows?: Array<Record<string, unknown>>;
  } = {}
) => {
  const calls: Array<{ method: string; params: { name: string; arguments: unknown } }> = [];
  const savedSearchRows = options.savedSearchRows ?? defaultSavedSearchRows;
  const savedSearches = options.savedSearches ?? [
    {
      id: "saved-search-live-auth",
      type: "saved_searches",
      name: "ES - Lateral Movement Auth Chain",
      app: "SplunkEnterpriseSecuritySuite"
    }
  ];
  const server = createServer((request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      const parsed = JSON.parse(body) as { id: string; method: string; params: { name: string; arguments: unknown } };
      calls.push(parsed);

      const outputByToolName: Record<string, unknown> = {
        splunk_get_info: {
          mode: "live",
          deploymentName: "acme-soc-prod",
          readOnlyTools: [
            "splunk_get_info",
            "splunk_get_user_info",
            "splunk_get_indexes",
            "splunk_get_metadata",
            "splunk_get_knowledge_objects",
            "splunk_run_query",
            "splunk_run_saved_search",
            "saia_explain_spl",
            "saia_optimize_spl"
          ]
        },
        splunk_get_user_info: {
          username: "splunkready-smoke",
          roles: ["user"],
          defaultApp: "search",
          capabilities: ["search"]
        },
        splunk_get_indexes: options.indexes ?? [{ name: "wineventlog", sensitive: false }],
        splunk_get_metadata: {
          results: [{ sourcetype: "XmlWinEventLog:Security" }],
          total_rows: 1
        },
        splunk_get_knowledge_objects: {
          results: savedSearches,
          total_rows: savedSearches.length
        },
        splunk_run_query: {
          results: [],
          total_rows: 0
        },
        splunk_run_saved_search: {
          results: savedSearchRows,
          total_rows: savedSearchRows.length
        },
        saia_explain_spl: {
          explanation: "The SPL uses a broad index wildcard and a non-contract field."
        },
        saia_optimize_spl: {
          optimizedQuery: "| savedsearch \"ES - Lateral Movement Auth Chain\"",
          rationale: "Prefer the validated saved search from the live contract."
        }
      };

      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: parsed.id,
          result: { structuredContent: outputByToolName[parsed.params.name] }
        })
      );
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Mock MCP server did not expose a TCP port.");
  }

  return {
    calls,
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      })
  };
};

describe("live action workflows", () => {
  it("skips live smoke without leaking missing credential values", async () => {
    const outDir = await tempRoot();
    const result = await runLiveSmokeWorkflow(
      { outDir, requireLive: false },
      {
        SPLUNKREADY_LIVE_ENABLED: undefined,
        SPLUNKREADY_SPLUNK_MCP_URL: undefined,
        SPLUNKREADY_SPLUNK_MCP_TOKEN: "super-secret-token"
      }
    );

    expect(result).toMatchObject({
      status: "SKIP",
      outDir,
      artifacts: [],
      mutation: false
    });
    expect(result.messages.join(" ")).toContain("No live Splunk calls were made");
    expect(result.messages.join(" ")).not.toContain("super-secret-token");
  });

  it("derives live saved-search candidates without CLI ownership", async () => {
    const outDir = await tempRoot();
    const server = await startMockMcpServer();

    try {
      const result = await runLiveCandidatesWorkflow(
        { outDir, candidateLimit: 1 },
        {
          SPLUNKREADY_LIVE_ENABLED: "true",
          SPLUNKREADY_SPLUNK_MCP_URL: server.url,
          SPLUNKREADY_SPLUNK_MCP_TOKEN: "test-token",
          SPLUNKREADY_SPLUNK_APP: "search"
        }
      );

      expect(result).toMatchObject({ status: "PASS", outDir, mutation: false });
      expect(result.artifacts).toEqual(
        expect.arrayContaining([
          join(outDir, "environment-contract.json"),
          join(outDir, "live-candidates.json"),
          join(outDir, "live-derived-mission.json"),
          join(outDir, "live-derived-readiness-profile.json")
        ])
      );
    } finally {
      await server.close();
    }

    const report = JSON.parse(await readFile(join(outDir, "live-candidates.json"), "utf8")) as {
      checked: number;
      mutation: boolean;
      candidatesWithRows: Array<{ ref: string; evidenceRefs: string[] }>;
      derivedMission: { strategy: string; missionId?: string };
    };

    expect(report).toMatchObject({
      checked: 1,
      mutation: false,
      derivedMission: {
        strategy: "saved-search-with-evidence",
        missionId: "mission-live-saved-search-readiness"
      }
    });
    expect(report.candidatesWithRows).toEqual([
      expect.objectContaining({
        ref: "SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain",
        evidenceRefs: ["live-evt-102", "live-evt-118", "live-evt-141"]
      })
    ]);
    expect(server.calls.map((call) => call.params.name)).toContain("splunk_run_saved_search");
  });

  it("generates the operator-owned live security kit without live credentials", async () => {
    const outDir = await tempRoot();
    const result = await runLiveSecurityKitWorkflow({ outDir });

    expect(result).toMatchObject({
      status: "PASS",
      outDir,
      mutation: false,
      messages: ["Generated local operator-owned security kit. SplunkReady performed no Splunk write operation."]
    });
    expect(result.artifacts).toEqual(
      expect.arrayContaining([
        join(outDir, "live-security-kit.json"),
        join(outDir, "SplunkEnterpriseSecuritySuite", "default", "savedsearches.conf"),
        join(outDir, "lateral-movement-events.csv"),
        join(outDir, "README.md")
      ])
    );

    const manifest = JSON.parse(await readFile(join(outDir, "live-security-kit.json"), "utf8")) as {
      mutation: boolean;
      operatorActionRequired: boolean;
      validation: { status: string };
    };
    expect(manifest).toMatchObject({
      mutation: false,
      operatorActionRequired: true,
      validation: { status: "PASS" }
    });
  });

  it("keeps strict flagship security readiness blocked when the exact saved search is absent", async () => {
    const outDir = await tempRoot();
    const server = await startMockMcpServer({
      savedSearches: [
        {
          id: "saved-search-errors",
          type: "saved_searches",
          name: "Errors in the last 24 hours",
          app: "search"
        }
      ],
      savedSearchRows: []
    });

    try {
      const result = await runLiveSecurityReadinessWorkflow(
        { outDir },
        {
          SPLUNKREADY_LIVE_ENABLED: "true",
          SPLUNKREADY_SPLUNK_MCP_URL: server.url,
          SPLUNKREADY_SPLUNK_MCP_TOKEN: "test-token",
          SPLUNKREADY_SPLUNK_APP: "search"
        }
      );

      expect(result).toMatchObject({ status: "PASS", outDir, mutation: false });
    } finally {
      await server.close();
    }

    const report = JSON.parse(await readFile(join(outDir, "live-security-readiness.json"), "utf8")) as {
      status: string;
      proofMode: { fallbackAllowed: boolean };
      requiredSavedSearch: { present: boolean; run: { attempted: boolean; reason: string } };
    };

    expect(report).toMatchObject({
      status: "BLOCKED",
      proofMode: { fallbackAllowed: false },
      requiredSavedSearch: {
        present: false,
        run: {
          attempted: false,
          reason: "Exact flagship saved search is not present in the live contract."
        }
      }
    });
    expect(server.calls.map((call) => call.params.name)).not.toContain("splunk_run_saved_search");
  });

  it("keeps live action source independent from the CLI module", async () => {
    const source = await readFile(new URL("../../src/workflows/live-actions.ts", import.meta.url), "utf8");

    expect(source).not.toContain("../cli.js");
    expect(source).toContain("runLiveSecurityProofWorkflow");
  });
});
