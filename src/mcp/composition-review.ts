export interface McpCompositionReviewInput {
  transcript: string;
  clientConfig: string;
}

export interface McpCompositionReviewCheck {
  id: string;
  status: "PASS" | "FAIL";
  evidence: string;
}

export interface McpCompositionReview {
  source: "splunkready-mcp-composition-review";
  status: "PASS" | "FAIL";
  score: number;
  checks: McpCompositionReviewCheck[];
  splunkToolNames: string[];
  splunkToolCallCount: number;
  evidenceRefs: string[];
  deterministicAuthority: true;
  mutation: false;
}

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const recordFromUnknown = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const collectEvidenceRefs = (value: unknown): string[] => {
  const record = recordFromUnknown(value);
  const directRefs = stringArray(record.evidenceRefs);
  const results = Array.isArray(record.results) ? record.results : [];
  const resultRefs = results
    .map((result) => recordFromUnknown(result).eventRef)
    .filter((eventRef): eventRef is string => typeof eventRef === "string" && eventRef.length > 0);

  return [...directRefs, ...resultRefs];
};

const parseTranscriptLines = (transcript: string): Record<string, unknown>[] =>
  transcript
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => recordFromUnknown(JSON.parse(line) as unknown));

const unwrapTranscriptRecord = (record: Record<string, unknown>): Record<string, unknown> => {
  const message = recordFromUnknown(record.message);
  const payload = recordFromUnknown(record.payload);
  const request = recordFromUnknown(record.request);
  const response = recordFromUnknown(record.response);

  return Object.keys(message).length > 0
    ? message
    : Object.keys(payload).length > 0
      ? payload
      : Object.keys(request).length > 0
        ? request
        : Object.keys(response).length > 0
          ? response
          : record;
};

const readToolName = (record: Record<string, unknown>): string => {
  const message = unwrapTranscriptRecord(record);

  if (message.method !== "tools/call") {
    return "";
  }

  const params = recordFromUnknown(message.params);
  const name = params.name;

  return typeof name === "string" ? name : "";
};

const clientConfigNamesServer = (clientConfig: string, serverName: string): boolean =>
  clientConfig.includes(`"${serverName}"`) || clientConfig.includes(`'${serverName}'`);

const clientConfigUsesSplunkReadyMcp = (clientConfig: string): boolean =>
  (clientConfig.includes("npm") && clientConfig.includes("run") && clientConfig.includes("mcp")) ||
  (clientConfig.includes("splunkready") && clientConfig.includes("mcp"));

export const reviewMcpComposition = (input: McpCompositionReviewInput): McpCompositionReview => {
  const records = parseTranscriptLines(input.transcript);
  const toolNames = records.map(readToolName).filter((toolName) => toolName.length > 0);
  const splunkToolNames = [...new Set(toolNames.filter((toolName) => toolName.startsWith("splunk_")))];
  const evidenceRefs = [
    ...new Set(
      records.flatMap((record) => {
        const message = unwrapTranscriptRecord(record);
        const result = recordFromUnknown(message.result);
        const structuredContent = recordFromUnknown(result.structuredContent);

        return [...collectEvidenceRefs(message), ...collectEvidenceRefs(structuredContent)];
      })
    )
  ];
  const hasSplunkServer = clientConfigNamesServer(input.clientConfig, "splunk");
  const hasSplunkReadyServer = clientConfigNamesServer(input.clientConfig, "splunkready");
  const hasRemoteSplunk = input.clientConfig.includes("mcp-remote") || input.clientConfig.includes("SPLUNKREADY_SPLUNK_MCP_URL");
  const hasSplunkReadyMcp = clientConfigUsesSplunkReadyMcp(input.clientConfig);
  const hasInvestigationTool = splunkToolNames.some((toolName) =>
    ["splunk_get_knowledge_objects", "splunk_run_saved_search", "splunk_run_query"].includes(toolName)
  );
  const hasSavedSearchEvidence = splunkToolNames.includes("splunk_run_saved_search") && evidenceRefs.length > 0;

  const checks: McpCompositionReviewCheck[] = [
    {
      id: "client-config-two-servers",
      status: hasSplunkServer && hasSplunkReadyServer ? "PASS" : "FAIL",
      evidence: hasSplunkServer && hasSplunkReadyServer
        ? "Client config names separate splunk and splunkready MCP servers."
        : "Client config must name separate splunk and splunkready MCP servers."
    },
    {
      id: "client-config-existing-splunk-mcp",
      status: hasRemoteSplunk ? "PASS" : "FAIL",
      evidence: hasRemoteSplunk
        ? "Client config routes Splunk calls through an existing Splunk MCP endpoint."
        : "Client config does not show an existing Splunk MCP endpoint or mcp-remote bridge."
    },
    {
      id: "client-config-splunkready-certifier",
      status: hasSplunkReadyMcp ? "PASS" : "FAIL",
      evidence: hasSplunkReadyMcp
        ? "Client config starts SplunkReady as a local certification MCP server."
        : "Client config does not show a SplunkReady MCP command."
    },
    {
      id: "transcript-existing-splunk-tools",
      status: splunkToolNames.length > 0 ? "PASS" : "FAIL",
      evidence: `${splunkToolNames.length} unique splunk_* tool(s) found in the transcript.`
    },
    {
      id: "transcript-investigation-depth",
      status: hasInvestigationTool ? "PASS" : "FAIL",
      evidence: hasInvestigationTool
        ? "Transcript includes Splunk knowledge-object, saved-search, or SPL execution."
        : "Transcript lacks Splunk investigation tools."
    },
    {
      id: "saved-search-evidence-refs",
      status: hasSavedSearchEvidence ? "PASS" : "FAIL",
      evidence: `${evidenceRefs.length} evidence ref(s) found from saved-search or structured output.`
    },
    {
      id: "deterministic-authority",
      status: "PASS",
      evidence: "This review is deterministic and does not use LLM, SAIA, or assistant text as pass/fail authority."
    },
    {
      id: "no-splunkready-mutation",
      status: "PASS",
      evidence: "SplunkReady MCP review is read-only and reports mutation=false."
    }
  ];
  const passed = checks.filter((check) => check.status === "PASS").length;

  return {
    source: "splunkready-mcp-composition-review",
    status: passed === checks.length ? "PASS" : "FAIL",
    score: Math.round((passed / checks.length) * 100),
    checks,
    splunkToolNames,
    splunkToolCallCount: toolNames.filter((toolName) => toolName.startsWith("splunk_")).length,
    evidenceRefs,
    deterministicAuthority: true,
    mutation: false
  };
};
