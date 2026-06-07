import { readFile, writeFile } from "node:fs/promises";

export interface McpRecorderSessionRecord {
  direction: "request" | "notification" | "response";
  sequence: number;
  method?: string;
  id?: string | number | null;
  params?: unknown;
  result?: unknown;
  error?: unknown;
}

export interface McpRecorderFrame {
  source: "splunkready-mcp-composition-recorder";
  serverId: "splunk" | "splunkready";
  serverRole: "existing-splunk-mcp" | "splunkready-certifier-mcp";
  direction: "request" | "notification" | "response" | "final_answer";
  sequence: number;
  message: unknown;
}

export interface McpCompositionRecorderSummary {
  source: "splunkready-mcp-composition-recorder";
  status: "PASS" | "FAIL";
  artifactPath: string;
  markdownPath: string;
  frameCount: number;
  serverIds: string[];
  requestCount: number;
  responseCount: number;
  splunkToolNames: string[];
  splunkReadyToolNames: string[];
  evidenceRefs: string[];
  redaction: {
    status: "PASS" | "FAIL";
    endpointMaterialPresent: boolean;
    tokenMaterialPresent: boolean;
    localPathMaterialPresent: boolean;
  };
  certification?: {
    status: "PASS" | "FAIL";
    outDir: string;
    artifactCount: number;
  };
  deterministicAuthority: true;
  mutation: false;
}

const sensitiveKeyPattern = /(authorization|token|password|secret|api[_-]?key|endpoint|baseurl|base_url|url)/i;
const localPathPattern = /(^|["'\s])(?:\/Users\/|\/private\/|\/tmp\/|~\/)[^\s"',}]*/g;
const endpointPattern = /\bhttps?:\/\/[^\s"',}]+/g;
const authorizationHeaderPattern = /Authorization:\s*Bearer\s+[^"',\n]+/g;
const bearerPattern = /Bearer\s+[A-Za-z0-9._~+/=-]+/g;
const sensitiveEnvNamePattern = /\b[A-Z][A-Z0-9_]*(?:TOKEN|SECRET|API_KEY|ENDPOINT|URL)[A-Z0-9_]*\b/g;
const publicMcpEnvNamePattern = /\b(?:SPLUNKREADY_[A-Z0-9_]*|SAIA_MCP_[A-Z0-9_]*|SPLUNK_AI_ASSISTANT_MCP_[A-Z0-9_]*)\b/g;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const redactString = (value: string): string =>
  value
    .replace(authorizationHeaderPattern, "<redacted-authorization-header>")
    .replace(bearerPattern, "<redacted-token>")
    .replace(endpointPattern, "<redacted-endpoint>")
    .replace(sensitiveEnvNamePattern, "<redacted-env-name>")
    .replace(publicMcpEnvNamePattern, "<redacted-env-name>")
    .replace(/\/TOKEN\b/g, "/<redacted-token-name>")
    .replace(localPathPattern, (match, prefix: string) => `${prefix}<redacted-local-path>`);

export const redactMcpRecorderValue = (value: unknown, key = ""): unknown => {
  if (typeof value === "string") {
    return sensitiveKeyPattern.test(key) ? "<redacted>" : redactString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactMcpRecorderValue(item));
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      sensitiveKeyPattern.test(entryKey) ? "<redacted>" : redactMcpRecorderValue(entryValue, entryKey)
    ])
  );
};

const parseJsonl = (text: string): unknown[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as unknown);

const serverRoleFor = (serverId: McpRecorderFrame["serverId"]): McpRecorderFrame["serverRole"] =>
  serverId === "splunk" ? "existing-splunk-mcp" : "splunkready-certifier-mcp";

const messageDirection = (message: unknown, fallback: McpRecorderFrame["direction"]): McpRecorderFrame["direction"] => {
  if (isRecord(message) && (message.type === "final_answer" || message.event === "final_answer" || message.kind === "final_answer")) {
    return "final_answer";
  }

  return fallback;
};

const frameFromMessage = (
  serverId: McpRecorderFrame["serverId"],
  sequence: number,
  message: unknown,
  fallbackDirection: McpRecorderFrame["direction"]
): McpRecorderFrame => ({
  source: "splunkready-mcp-composition-recorder",
  serverId,
  serverRole: serverRoleFor(serverId),
  direction: messageDirection(message, fallbackDirection),
  sequence,
  message: redactMcpRecorderValue(message)
});

const jsonRpcMessageFromSessionRecord = (record: McpRecorderSessionRecord): unknown => {
  if (record.direction === "response") {
    return {
      jsonrpc: "2.0",
      id: record.id ?? null,
      ...(record.error === undefined ? { result: record.result } : { error: record.error })
    };
  }

  return {
    jsonrpc: "2.0",
    ...(record.id === undefined ? {} : { id: record.id }),
    method: record.method,
    params: record.params
  };
};

const toolNameFromMessage = (message: unknown): string => {
  if (!isRecord(message) || message.method !== "tools/call" || !isRecord(message.params)) {
    return "";
  }

  const name = message.params.name;
  return typeof name === "string" ? name : "";
};

const evidenceRefsFrom = (value: unknown): string[] => {
  if (!isRecord(value)) {
    return [];
  }

  const direct = Array.isArray(value.evidenceRefs) ? value.evidenceRefs : [];
  const results = Array.isArray(value.results) ? value.results : [];
  const rows = Array.isArray(value.rows) ? value.rows : [];

  return [
    ...direct.filter((ref): ref is string => typeof ref === "string" && ref.length > 0),
    ...results
      .filter(isRecord)
      .map((result) => result.eventRef)
      .filter((ref): ref is string => typeof ref === "string" && ref.length > 0),
    ...rows
      .filter(isRecord)
      .map((row) => row.eventRef)
      .filter((ref): ref is string => typeof ref === "string" && ref.length > 0)
  ];
};

const collectEvidenceRefs = (message: unknown): string[] => {
  if (!isRecord(message)) {
    return [];
  }

  const result = isRecord(message.result) ? message.result : {};
  const structuredContent = isRecord(result.structuredContent) ? result.structuredContent : {};

  return [...evidenceRefsFrom(message), ...evidenceRefsFrom(structuredContent)];
};

const redactionStatus = (serialized: string): McpCompositionRecorderSummary["redaction"] => {
  const endpointMaterialPresent = endpointPattern.test(serialized);
  endpointPattern.lastIndex = 0;
  const tokenMaterialPresent = /Bearer\s+(?!<redacted-token>)[A-Za-z0-9._~+/=-]+/.test(serialized);
  const localPathMaterialPresent = /(?:\/Users\/|\/private\/|\/tmp\/|~\/)/.test(serialized);

  return {
    status: endpointMaterialPresent || tokenMaterialPresent || localPathMaterialPresent ? "FAIL" : "PASS",
    endpointMaterialPresent,
    tokenMaterialPresent,
    localPathMaterialPresent
  };
};

const summarizeFrames = (
  frames: McpRecorderFrame[],
  artifactPath: string,
  markdownPath: string
): McpCompositionRecorderSummary => {
  const serverIds = [...new Set(frames.map((frame) => frame.serverId))];
  const requestCount = frames.filter((frame) => frame.direction === "request").length;
  const responseCount = frames.filter((frame) => frame.direction === "response").length;
  const toolPairs = frames.map((frame) => ({ serverId: frame.serverId, toolName: toolNameFromMessage(frame.message) }));
  const splunkToolNames = [
    ...new Set(toolPairs.filter((pair) => pair.serverId === "splunk" && pair.toolName.startsWith("splunk_")).map((pair) => pair.toolName))
  ];
  const splunkReadyToolNames = [
    ...new Set(
      toolPairs
        .filter((pair) => pair.serverId === "splunkready" && pair.toolName.startsWith("splunkready_"))
        .map((pair) => pair.toolName)
    )
  ];
  const evidenceRefs = [...new Set(frames.flatMap((frame) => collectEvidenceRefs(frame.message)))];
  const serialized = frames.map((frame) => JSON.stringify(frame)).join("\n");
  const redaction = redactionStatus(serialized);
  const status =
    serverIds.includes("splunk") &&
    serverIds.includes("splunkready") &&
    splunkToolNames.includes("splunk_get_knowledge_objects") &&
    splunkToolNames.includes("splunk_run_saved_search") &&
    splunkReadyToolNames.includes("splunkready_certify_mcp_transcript") &&
    splunkReadyToolNames.includes("splunkready_certify_mcp_transcript_content") &&
    evidenceRefs.length > 0 &&
    redaction.status === "PASS"
      ? "PASS"
      : "FAIL";

  return {
    source: "splunkready-mcp-composition-recorder",
    status,
    artifactPath,
    markdownPath,
    frameCount: frames.length,
    serverIds,
    requestCount,
    responseCount,
    splunkToolNames,
    splunkReadyToolNames,
    evidenceRefs,
    redaction,
    deterministicAuthority: true,
    mutation: false
  };
};

export const writeMcpCompositionRecorderFrames = async (input: {
  frames: McpRecorderFrame[];
  artifactPath: string;
  markdownPath: string;
  certification?: McpCompositionRecorderSummary["certification"];
}): Promise<McpCompositionRecorderSummary> => {
  const summary: McpCompositionRecorderSummary = {
    ...summarizeFrames(input.frames, input.artifactPath, input.markdownPath),
    certification: input.certification
  };

  await writeFile(input.artifactPath, `${input.frames.map((frame) => JSON.stringify(frame)).join("\n")}\n`, "utf8");
  await writeFile(input.markdownPath, renderMcpCompositionRecorderMarkdown(summary), "utf8");

  return summary;
};

export const renderMcpCompositionRecorderMarkdown = (summary: McpCompositionRecorderSummary): string => `# MCP Composition Recorder

Status: ${summary.status}

Mutation: ${summary.mutation ? "yes" : "no"}

Deterministic authority: ${summary.deterministicAuthority ? "yes" : "no"}

Artifact: ${summary.artifactPath}

Frames: ${summary.frameCount}

Servers: ${summary.serverIds.join(", ")}

Requests: ${summary.requestCount}

Responses: ${summary.responseCount}

Splunk tools:
${summary.splunkToolNames.map((toolName) => `- ${toolName}`).join("\n")}

SplunkReady tools:
${summary.splunkReadyToolNames.map((toolName) => `- ${toolName}`).join("\n")}

Evidence refs:
${summary.evidenceRefs.map((ref) => `- ${ref}`).join("\n")}

Redaction: ${summary.redaction.status}
- endpoint material present: ${summary.redaction.endpointMaterialPresent ? "yes" : "no"}
- token material present: ${summary.redaction.tokenMaterialPresent ? "yes" : "no"}
- local path material present: ${summary.redaction.localPathMaterialPresent ? "yes" : "no"}

Certification: ${summary.certification?.status ?? "NOT_RUN"}
`;

export const createMcpCompositionRecorderSession = (input: {
  splunkTranscript: string;
  splunkReadySession: McpRecorderSessionRecord[];
  artifactPath: string;
  markdownPath: string;
}): { frames: McpRecorderFrame[]; summary: McpCompositionRecorderSummary } => {
  let sequence = 0;
  const splunkFrames = parseJsonl(input.splunkTranscript).map((message) =>
    frameFromMessage("splunk", ++sequence, message, isRecord(message) && "result" in message ? "response" : "request")
  );
  const splunkReadyFrames = input.splunkReadySession.map((record) =>
    frameFromMessage("splunkready", ++sequence, jsonRpcMessageFromSessionRecord(record), record.direction)
  );
  const frames = [...splunkFrames, ...splunkReadyFrames];
  const summary = summarizeFrames(frames, input.artifactPath, input.markdownPath);

  return { frames, summary };
};

export const writeMcpCompositionRecorderSession = async (input: {
  splunkTranscriptPath: string;
  splunkReadySession: McpRecorderSessionRecord[];
  artifactPath: string;
  markdownPath: string;
}): Promise<McpCompositionRecorderSummary> => {
  const splunkTranscript = await readFile(input.splunkTranscriptPath, "utf8");
  const { frames, summary } = createMcpCompositionRecorderSession({
    splunkTranscript,
    splunkReadySession: input.splunkReadySession,
    artifactPath: input.artifactPath,
    markdownPath: input.markdownPath
  });

  return writeMcpCompositionRecorderFrames({
    frames,
    artifactPath: input.artifactPath,
    markdownPath: input.markdownPath,
    certification: summary.certification
  });
};
