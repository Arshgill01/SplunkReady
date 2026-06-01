import { describe, expect, it } from "vitest";

import {
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
