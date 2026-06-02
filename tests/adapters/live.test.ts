import { describe, expect, it } from "vitest";

import {
  createHttpLiveSplunkTransport,
  createLiveSplunkAccessAdapter,
  createLiveSplunkAdapterConfigFromEnv,
  type LiveSplunkTransport,
  type LiveSplunkTransportRequest
} from "../../src/adapters/live.js";
import type { AdapterTraceErrorEvent, AdapterTraceStartEvent } from "../../src/adapters/splunk-access.js";

const requestOptions = { requestId: "req-live-001", missionId: "mission-lateral-movement" };

describe("live Splunk adapter skeleton", () => {
  it("is disabled by default and does not require credentials during tests", async () => {
    const adapter = createLiveSplunkAccessAdapter();

    await expect(adapter.getInfo(requestOptions)).rejects.toMatchObject({
      code: "LIVE_ADAPTER_DISABLED",
      context: {
        mode: "live",
        toolName: "splunk_get_info",
        requestId: "req-live-001"
      }
    });
  });

  it("returns actionable missing-config errors without echoing secrets", async () => {
    const adapter = createLiveSplunkAccessAdapter({
      enabled: true,
      authToken: "super-secret-token"
    });

    await expect(adapter.getIndexes(requestOptions)).rejects.toMatchObject({
      code: "LIVE_ADAPTER_MISSING_CONFIG",
      message: expect.stringContaining("SPLUNKREADY_SPLUNK_MCP_URL")
    });
    await expect(adapter.getIndexes(requestOptions)).rejects.not.toMatchObject({
      message: expect.stringContaining("super-secret-token")
    });
  });

  it("exposes the shared adapter interface through a mock live transport", async () => {
    const transport: LiveSplunkTransport = {
      async call<TInput, TOutput>(request: LiveSplunkTransportRequest<TInput>): Promise<TOutput> {
        expect(request.authToken).toBe("test-token");
        expect(request.endpointUrl).toBe("https://splunk.example.invalid/mcp");

        if (request.toolName === "splunk_get_info") {
          return {
            mode: "live" as const,
            deploymentName: "acme-soc-prod",
            readOnlyTools: ["splunk_get_info", "splunk_run_saved_search"]
          } as TOutput;
        }

        if (request.toolName === "splunk_run_saved_search") {
          return {
            savedSearchRef: "saved-search-lateral-movement",
            rows: [{ eventRef: "live-evt-001", src: "win-finance-07" }],
            resultCount: 1,
            evidenceRefs: ["live-evt-001"],
            warnings: []
          } as TOutput;
        }

        throw new Error(`unexpected tool ${request.toolName}`);
      }
    };
    const adapter = createLiveSplunkAccessAdapter({
      enabled: true,
      endpointUrl: "https://splunk.example.invalid/mcp",
      authToken: "test-token",
      capabilities: ["splunk_get_info", "splunk_run_saved_search"],
      transport
    });

    await expect(adapter.getInfo(requestOptions)).resolves.toMatchObject({
      mode: "live",
      deploymentName: "acme-soc-prod"
    });
    await expect(
      adapter.runSavedSearch(
        {
          name: "ES - Lateral Movement Auth Chain",
          app: "SplunkEnterpriseSecuritySuite"
        },
        requestOptions
      )
    ).resolves.toMatchObject({ resultCount: 1, evidenceRefs: ["live-evt-001"] });
  });

  it("maps internal SPL assistance query input to the live MCP spl argument", async () => {
    const calls: Array<{ toolName: string; input: unknown }> = [];
    const transport: LiveSplunkTransport = {
      async call<TInput, TOutput>(request: LiveSplunkTransportRequest<TInput>): Promise<TOutput> {
        calls.push({ toolName: request.toolName, input: request.input });

        if (request.toolName === "saia_explain_spl") {
          return { explanation: "The SPL uses a broad index wildcard." } as TOutput;
        }

        if (request.toolName === "saia_optimize_spl") {
          return { optimizedQuery: "search index=wineventlog", rationale: "Narrow to the authorized index." } as TOutput;
        }

        throw new Error(`unexpected tool ${request.toolName}`);
      }
    };
    const adapter = createLiveSplunkAccessAdapter({
      enabled: true,
      endpointUrl: "https://splunk.example.invalid/mcp",
      authToken: "test-token",
      capabilities: ["saia_explain_spl", "saia_optimize_spl"],
      transport
    });
    const query = "search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now";

    await expect(adapter.explainSpl?.({ query }, requestOptions)).resolves.toMatchObject({
      explanation: "The SPL uses a broad index wildcard."
    });
    await expect(adapter.optimizeSpl?.({ query }, requestOptions)).resolves.toMatchObject({
      optimizedQuery: "search index=wineventlog"
    });
    expect(calls).toEqual([
      { toolName: "saia_explain_spl", input: { spl: query } },
      { toolName: "saia_optimize_spl", input: { spl: query } }
    ]);
  });

  it("normalizes live Splunk MCP result envelopes at the adapter boundary", async () => {
    const calls: Array<{ toolName: string; input: unknown }> = [];
    const transport: LiveSplunkTransport = {
      async call<TInput, TOutput>(request: LiveSplunkTransportRequest<TInput>): Promise<TOutput> {
        calls.push({ toolName: request.toolName, input: request.input });

        if (request.toolName === "splunk_get_info") {
          return {
            results: [
              {
                version: "10.0.0",
                serverName: "splunk-dev"
              }
            ],
            total_rows: 1
          } as TOutput;
        }

        if (request.toolName === "splunk_get_user_info") {
          return {
            results: [
              {
                username: "admin",
                roles: "admin, power",
                defaultApp: "search",
                capabilitiesCount: "128"
              }
            ],
            total_rows: 1
          } as TOutput;
        }

        if (request.toolName === "splunk_get_indexes") {
          return {
            results: [
              { title: "_audit", disabled: false },
              { title: "finance_pii", disabled: false }
            ],
            total_rows: 2
          } as TOutput;
        }

        if (request.toolName === "splunk_get_metadata") {
          expect(request.input).toMatchObject({
            type: "sourcetypes",
            index: "*",
            earliest_time: "-15m",
            latest_time: "now"
          });
          return {
            results: [{ sourcetype: "XmlWinEventLog:Security" }],
            total_rows: 1
          } as TOutput;
        }

        if (request.toolName === "splunk_get_knowledge_objects") {
          if ((request.input as { type?: string }).type === "saved_searches") {
            if ((request.input as { search?: string }).search) {
              return {
                results: [
                  {
                    name: "ES - Lateral Movement Auth Chain",
                    app: "SplunkEnterpriseSecuritySuite",
                    description: "Mission preferred saved search"
                  },
                  {
                    name: "Errors in the last 24 hours",
                    app: "search",
                    description: "Generic error report"
                  }
                ],
                total_rows: 2
              } as TOutput;
            }

            return {
              results: [
                {
                  name: "ES - Lateral Movement Auth Chain",
                  app: "SplunkEnterpriseSecuritySuite",
                  description: "Mission preferred saved search"
                }
              ],
              total_rows: 1
            } as TOutput;
          }

          if ((request.input as { type?: string }).type === "views") {
            return {
              results: [
                {
                  name: "ES - Dashboard Lateral Movement By Source",
                  "eai:acl.app": "SplunkEnterpriseSecuritySuite"
                }
              ],
              total_rows: 1
            } as TOutput;
          }
        }

        throw new Error(`unexpected tool ${request.toolName}`);
      }
    };
    const adapter = createLiveSplunkAccessAdapter({
      enabled: true,
      endpointUrl: "https://splunk.example.invalid/services/mcp",
      authToken: "test-token",
      capabilities: [
        "splunk_get_info",
        "splunk_get_user_info",
        "splunk_get_indexes",
        "splunk_get_metadata",
        "splunk_get_knowledge_objects"
      ],
      transport
    });

    await expect(adapter.getInfo(requestOptions)).resolves.toMatchObject({
      mode: "live",
      deploymentName: "splunk-dev",
      serverVersion: "10.0.0"
    });
    await expect(adapter.getUserInfo(requestOptions)).resolves.toMatchObject({
      username: "admin",
      roles: ["admin", "power"],
      defaultApp: "search"
    });
    await expect(adapter.getIndexes(requestOptions)).resolves.toEqual([
      { name: "_audit", sensitive: false, description: undefined },
      { name: "finance_pii", sensitive: true, description: undefined }
    ]);
    await expect(
      adapter.getMetadata(
        { indexes: ["_audit"], timeWindow: { earliest: "-15m", latest: "now" } },
        requestOptions
      )
    ).resolves.toMatchObject({
      source: "live",
      indexes: [{ name: "_audit", sensitive: false }],
      sourcetypes: [{ name: "XmlWinEventLog:Security", indexes: ["_audit"], fields: [] }]
    });
    await expect(adapter.getKnowledgeObjects({ types: ["saved_searches", "dashboards"] }, requestOptions)).resolves.toMatchObject({
      resultCount: 2,
      warnings: ["Live MCP serves dashboards through the views knowledge-object type."],
      objects: expect.arrayContaining([
        expect.objectContaining({
          type: "saved_searches",
          name: "ES - Lateral Movement Auth Chain",
          app: "SplunkEnterpriseSecuritySuite"
        }),
        expect.objectContaining({
          type: "dashboards",
          name: "ES - Dashboard Lateral Movement By Source",
          app: "SplunkEnterpriseSecuritySuite"
        })
      ])
    });
    await expect(
      adapter.getKnowledgeObjects({ types: ["saved_searches"], query: "lateral movement" }, requestOptions)
    ).resolves.toMatchObject({
      resultCount: 1,
      objects: [
        expect.objectContaining({
          type: "saved_searches",
          name: "ES - Lateral Movement Auth Chain"
        })
      ]
    });
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ toolName: "splunk_get_metadata", input: expect.objectContaining({ type: "sourcetypes" }) }),
        expect.objectContaining({ toolName: "splunk_get_knowledge_objects", input: expect.objectContaining({ type: "saved_searches" }) }),
        expect.objectContaining({ toolName: "splunk_get_knowledge_objects", input: expect.objectContaining({ type: "views" }) })
      ])
    );
  });

  it("calls MCP tools over HTTP without placing secrets in the request body", async () => {
    const fetchImpl: typeof fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        method: string;
        params: { name: string; arguments: Record<string, never>; defaultApp?: string };
      };
      const headers = init?.headers as Record<string, string>;

      expect(init?.method).toBe("POST");
      expect(headers.authorization).toBe("Bearer test-token");
      expect(String(init?.body)).not.toContain("test-token");
      expect(body).toMatchObject({
        method: "tools/call",
        params: {
          name: "splunk_get_info",
          arguments: {},
          defaultApp: "search"
        }
      });

      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          result: {
            structuredContent: {
              mode: "live",
              deploymentName: "acme-soc-prod",
              readOnlyTools: ["splunk_get_info"]
            }
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };

    await expect(
      createHttpLiveSplunkTransport({ fetch: fetchImpl }).call<Record<string, never>, unknown>({
        toolName: "splunk_get_info",
        input: {},
        endpointUrl: "https://splunk.example.invalid/mcp",
        authToken: "test-token",
        defaultApp: "search",
        timeoutMs: 30_000,
        options: requestOptions
      })
    ).resolves.toMatchObject({
      mode: "live",
      deploymentName: "acme-soc-prod"
    });
  });

  it("checks configured live capabilities before transport calls", async () => {
    let transportCalled = false;
    const adapter = createLiveSplunkAccessAdapter({
      enabled: true,
      endpointUrl: "https://splunk.example.invalid/mcp",
      authToken: "test-token",
      capabilities: ["splunk_get_info"],
      transport: {
        async call() {
          transportCalled = true;
          throw new Error("should not call transport");
        }
      }
    });

    await expect(
      adapter.runQuery({ query: "search index=wineventlog earliest=-15m latest=now" }, requestOptions)
    ).rejects.toMatchObject({
      code: "LIVE_ADAPTER_CAPABILITY_UNAVAILABLE",
      message: expect.stringContaining("splunk_run_query")
    });
    expect(transportCalled).toBe(false);
  });

  it("emits live trace start and error hooks for missing config", async () => {
    const starts: AdapterTraceStartEvent[] = [];
    const errors: AdapterTraceErrorEvent[] = [];
    const adapter = createLiveSplunkAccessAdapter(
      { enabled: true },
      {
        onToolStart: (event) => {
          starts.push(event);
        },
        onToolError: (event) => {
          errors.push(event);
        }
      }
    );

    await expect(adapter.getUserInfo(requestOptions)).rejects.toMatchObject({
      code: "LIVE_ADAPTER_MISSING_CONFIG"
    });
    expect(starts[0]?.context).toMatchObject({
      mode: "live",
      toolName: "splunk_get_user_info"
    });
    expect(errors[0]?.error).toMatchObject({
      code: "LIVE_ADAPTER_MISSING_CONFIG"
    });
  });

  it("builds disabled live config from empty environment", () => {
    expect(createLiveSplunkAdapterConfigFromEnv({})).toEqual({
      enabled: false,
      endpointUrl: undefined,
      authToken: undefined,
      defaultApp: undefined,
      timeoutMs: undefined,
      capabilities: undefined
    });
  });
});
