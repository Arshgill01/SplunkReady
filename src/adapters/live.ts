import { readOnlySplunkToolNameSchema, type ReadOnlySplunkToolName } from "../schemas/core.js";
import {
  createSplunkAdapterError,
  type AdapterCallOptions,
  type AdapterRequestContext,
  type AdapterTraceHooks,
  type AskSplunkQuestionRequest,
  type AskSplunkQuestionResult,
  type ExplainSplRequest,
  type ExplainSplResult,
  type GenerateSplRequest,
  type GenerateSplResult,
  type IndexSummary,
  type KnowledgeObjectSummary,
  type KnowledgeObjectType,
  type KnowledgeObjectRequest,
  type KnowledgeObjectResult,
  type MetadataRequest,
  type MetadataResult,
  type OptimizeSplRequest,
  type OptimizeSplResult,
  type QueryResult,
  type RunQueryRequest,
  type RunSavedSearchRequest,
  type SavedSearchResult,
  type SplunkAccessAdapter,
  type SplunkInfo,
  type SplunkUserInfo
} from "./splunk-access.js";

export interface LiveSplunkTransportRequest<TInput> {
  toolName: ReadOnlySplunkToolName;
  input: TInput;
  endpointUrl: string;
  authToken: string;
  headers?: Record<string, string>;
  defaultApp?: string;
  timeoutMs: number;
  options: AdapterCallOptions;
}

export interface LiveSplunkTransport {
  call<TInput, TOutput>(request: LiveSplunkTransportRequest<TInput>): Promise<TOutput>;
}

export interface LiveSplunkAdapterConfig {
  enabled?: boolean;
  endpointUrl?: string;
  authToken?: string;
  hostedModelEndpointUrl?: string;
  hostedModelAuthToken?: string;
  hostedModelHeaders?: Record<string, string>;
  defaultApp?: string;
  timeoutMs?: number;
  capabilities?: ReadOnlySplunkToolName[];
  transport?: LiveSplunkTransport;
}

export interface HttpLiveSplunkTransportOptions {
  fetch?: typeof fetch;
}

const firstEnvValue = (env: NodeJS.ProcessEnv, names: string[]): string | undefined =>
  names.map((name) => env[name]).find((value): value is string => Boolean(value));

export const liveCoreEndpointEnvNames = ["SPLUNKREADY_SPLUNK_MCP_URL", "SPLUNK_MCP_URL"];
export const liveCoreTokenEnvNames = ["SPLUNKREADY_SPLUNK_MCP_TOKEN", "SPLUNK_MCP_TOKEN"];
export const liveHostedModelEndpointEnvNames = [
  "SPLUNKREADY_SAIA_ENDPOINT",
  "SPLUNKREADY_SAIA_MCP_URL",
  "SAIA_MCP_URL",
  "SPLUNK_AI_ASSISTANT_MCP_URL",
  "SPLUNKREADY_HOSTED_MODEL_MCP_URL"
];
export const liveHostedModelTokenEnvNames = [
  "SPLUNKREADY_SAIA_TOKEN",
  "SPLUNKREADY_SAIA_MCP_TOKEN",
  "SAIA_MCP_TOKEN",
  "SPLUNK_AI_ASSISTANT_MCP_TOKEN",
  "SPLUNKREADY_HOSTED_MODEL_MCP_TOKEN"
];

export const liveHostedModelRealmEnvNames = ["SPLUNKREADY_SAIA_REALM", "SAIA_REALM", "SPLUNK_REALM"];
export const liveHostedModelTenantEnvNames = ["SPLUNKREADY_SAIA_TENANT", "SAIA_TENANT", "SPLUNK_TENANT"];
export const liveHostedModelSfTokenEnvNames = ["SPLUNKREADY_SAIA_SF_TOKEN", "SAIA_SF_TOKEN", "SPLUNK_SF_TOKEN"];

const createHostedModelHeadersFromEnv = (env: NodeJS.ProcessEnv): Record<string, string> | undefined => {
  const realm = firstEnvValue(env, liveHostedModelRealmEnvNames);
  const tenant = firstEnvValue(env, liveHostedModelTenantEnvNames);
  const sfToken = firstEnvValue(env, liveHostedModelSfTokenEnvNames) ?? firstEnvValue(env, liveHostedModelTokenEnvNames);
  const headers: Record<string, string> = {};

  if (realm) {
    headers["X-SF-REALM"] = realm;
  }

  if (tenant) {
    headers.splunk_tenant = tenant;
  }

  if ((realm || tenant) && sfToken) {
    headers["X-SF-TOKEN"] = sfToken;
  }

  return Object.keys(headers).length > 0 ? headers : undefined;
};

export const createLiveSplunkAdapterConfigFromEnv = (
  env: NodeJS.ProcessEnv = process.env
): LiveSplunkAdapterConfig => ({
  enabled: env.SPLUNKREADY_LIVE_ENABLED === "true",
  endpointUrl: firstEnvValue(env, liveCoreEndpointEnvNames),
  authToken: firstEnvValue(env, liveCoreTokenEnvNames),
  hostedModelEndpointUrl: firstEnvValue(env, liveHostedModelEndpointEnvNames),
  hostedModelAuthToken: firstEnvValue(env, liveHostedModelTokenEnvNames),
  hostedModelHeaders: createHostedModelHeadersFromEnv(env),
  defaultApp: env.SPLUNKREADY_SPLUNK_APP,
  timeoutMs: env.SPLUNKREADY_SPLUNK_TIMEOUT_MS ? Number(env.SPLUNKREADY_SPLUNK_TIMEOUT_MS) : undefined,
  capabilities: parseCapabilities(env.SPLUNKREADY_SPLUNK_CAPABILITIES)
});

const parseCapabilities = (rawCapabilities: string | undefined): ReadOnlySplunkToolName[] | undefined => {
  if (!rawCapabilities) {
    return undefined;
  }

  return rawCapabilities
    .split(",")
    .map((toolName) => toolName.trim())
    .filter((toolName) => toolName.length > 0)
    .map((toolName) => readOnlySplunkToolNameSchema.parse(toolName));
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const stringValue = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const rowsFrom = (value: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  if (isRecord(value) && Array.isArray(value.results)) {
    return value.results.filter(isRecord);
  }

  if (isRecord(value) && Array.isArray(value.rows)) {
    return value.rows.filter(isRecord);
  }

  if (isRecord(value) && Array.isArray(value.objects)) {
    return value.objects.filter(isRecord);
  }

  return [];
};

const firstRowFrom = (value: unknown): Record<string, unknown> => rowsFrom(value)[0] ?? (isRecord(value) ? value : {});

const normalizeLiveInfo = (value: unknown, capabilities: ReadOnlySplunkToolName[] | undefined): SplunkInfo => {
  const row = firstRowFrom(value);
  const deploymentName = stringValue(row.serverName) ?? stringValue(row.splunk_server) ?? "live-splunk";

  return {
    mode: "live",
    deploymentName: stringValue(row.deploymentName) ?? deploymentName,
    serverVersion: stringValue(row.serverVersion) ?? stringValue(row.version),
    readOnlyTools:
      row.readOnlyTools &&
      Array.isArray(row.readOnlyTools) &&
      row.readOnlyTools.every((toolName) => typeof toolName === "string")
        ? row.readOnlyTools.map((toolName) => readOnlySplunkToolNameSchema.parse(toolName))
        : capabilities ?? readOnlySplunkToolNameSchema.options
  };
};

const normalizeLiveUserInfo = (value: unknown): SplunkUserInfo => {
  const row = firstRowFrom(value);
  const roles = stringValue(row.roles)
    ?.split(",")
    .map((role) => role.trim())
    .filter((role) => role.length > 0) ?? [];
  const capabilitiesCount = stringValue(row.capabilitiesCount);

  return {
    username: stringValue(row.username) ?? "unknown-live-user",
    roles,
    defaultApp: stringValue(row.defaultApp),
    capabilities: capabilitiesCount ? [`${capabilitiesCount} live capabilities reported`] : []
  };
};

const normalizeLiveIndexes = (value: unknown): IndexSummary[] =>
  rowsFrom(value).map((row) => {
    const name = stringValue(row.name) ?? stringValue(row.title) ?? "unknown-index";

    return {
      name,
      sensitive: /(?:pii|secret|credential|private)/i.test(name),
      description: stringValue(row.description)
    };
  });

const liveMetadataInput = (input: MetadataRequest): Record<string, unknown> => ({
  type: "sourcetypes",
  index: "*",
  earliest_time: input.timeWindow?.earliest ?? "-24h",
  latest_time: input.timeWindow?.latest ?? "now",
  row_limit: 100
});

const normalizeLiveMetadata = (input: MetadataRequest, value: unknown): MetadataResult => {
  const sourcetypes = rowsFrom(value)
    .map((row) => stringValue(row.sourcetype) ?? stringValue(row.name) ?? stringValue(row.title))
    .filter((name): name is string => Boolean(name))
    .map((name) => ({ name, indexes: input.indexes ?? [], fields: [] }));

  return {
    indexes: (input.indexes ?? []).map((name) => ({
      name,
      sensitive: /(?:pii|secret|credential|private)/i.test(name)
    })),
    sourcetypes,
    source: "live",
    warnings:
      sourcetypes.length > 0
        ? ["Live MCP metadata provided sourcetype names; field discovery is not available from this inventory call."]
        : ["Live MCP metadata returned no sourcetypes for the smoke-test time window."]
  };
};

const liveKnowledgeTypeFor = (type: KnowledgeObjectType): string => (type === "dashboards" ? "views" : type);

const normalizeKnowledgeObject = (
  requestedType: KnowledgeObjectType,
  row: Record<string, unknown>,
  defaultApp: string | undefined
): KnowledgeObjectSummary => {
  const name = stringValue(row.name) ?? stringValue(row.title) ?? "unknown-knowledge-object";
  const rawApp = stringValue(row.app) ?? stringValue(row["eai:acl.app"]);
  const app = rawApp && rawApp !== "eai:appName" ? rawApp : (defaultApp ?? "search");

  return {
    id: `${requestedType}:${app}:${name}`,
    type: requestedType,
    name,
    app,
    description: stringValue(row.description),
    metadata: row
  };
};

const normalizeKnowledgeObjects = (
  requestedType: KnowledgeObjectType,
  value: unknown,
  defaultApp: string | undefined
): KnowledgeObjectSummary[] =>
  rowsFrom(value).map((row) => normalizeKnowledgeObject(requestedType, row, defaultApp));

const normalizedKnowledgeObjectQuery = (query: string | undefined): string | undefined => {
  const trimmedQuery = query?.trim();
  return trimmedQuery ? trimmedQuery.toLowerCase() : undefined;
};

const knowledgeObjectMatchesRequest = (
  object: KnowledgeObjectSummary,
  input: KnowledgeObjectRequest
): boolean => {
  const query = normalizedKnowledgeObjectQuery(input.query);
  const matchesApp = input.app ? object.app === input.app : true;
  const matchesQuery = query
    ? object.name.toLowerCase().includes(query) || object.description?.toLowerCase().includes(query) || object.id.toLowerCase().includes(query)
    : true;

  return matchesApp && matchesQuery;
};

const normalizeLiveQueryResult = (input: RunQueryRequest, value: unknown): QueryResult => {
  const rows = rowsFrom(value);

  return {
    queryRef: input.query,
    rows,
    resultCount: rows.length,
    evidenceRefs: rows
      .map((row) => stringValue(row.eventRef) ?? stringValue(row._cd) ?? stringValue(row._raw))
      .filter((ref): ref is string => Boolean(ref)),
    warnings: []
  };
};

const normalizeLiveSavedSearchResult = (input: RunSavedSearchRequest, value: unknown): SavedSearchResult => {
  const rows = rowsFrom(value);

  return {
    savedSearchRef: `${input.app}:${input.name}`,
    rows,
    resultCount: rows.length,
    evidenceRefs: rows
      .map((row) => stringValue(row.eventRef) ?? stringValue(row._cd) ?? stringValue(row._raw))
      .filter((ref): ref is string => Boolean(ref)),
    warnings: []
  };
};

const liveSavedSearchInput = (input: RunSavedSearchRequest): Record<string, unknown> => ({
  saved_search_name: input.name,
  ...(input.app ? { app: input.app } : {}),
  ...(input.tokens ? { tokens: input.tokens } : {}),
  ...(input.maxRows ? { maxRows: input.maxRows } : {})
});

const liveSplAssistanceInput = (input: ExplainSplRequest | OptimizeSplRequest): Record<string, unknown> => ({
  spl: input.query
});

const liveSplGenerationInput = (input: GenerateSplRequest): Record<string, unknown> => ({
  prompt: input.prompt
});

const liveSplunkQuestionInput = (input: AskSplunkQuestionRequest): Record<string, unknown> => ({
  prompt: input.question
});

const normalizeGenerateSplResult = (value: unknown): GenerateSplResult => {
  const row = firstRowFrom(value);
  const query =
    stringValue(row.query) ??
    stringValue(row.spl) ??
    stringValue(row.generated_spl) ??
    stringValue(row.generatedSpl) ??
    (typeof value === "string" ? value : "");
  const rationale = stringValue(row.rationale) ?? stringValue(row.explanation);

  return { query, rationale, warnings: query ? [] : ["Live SAIA generation returned no SPL text."] };
};

const normalizeExplainSplResult = (value: unknown): ExplainSplResult => {
  const row = firstRowFrom(value);
  const explanation =
    stringValue(row.explanation) ??
    stringValue(row.answer) ??
    stringValue(row.content) ??
    (typeof value === "string" ? value : "Live SAIA explanation returned no text.");

  return { explanation, warnings: [] };
};

const normalizeOptimizeSplResult = (value: unknown): OptimizeSplResult => {
  const row = firstRowFrom(value);
  const optimizedQuery =
    stringValue(row.optimizedQuery) ??
    stringValue(row.optimized_query) ??
    stringValue(row.query) ??
    stringValue(row.spl) ??
    (typeof value === "string" ? value : "");
  const rationale = stringValue(row.rationale) ?? stringValue(row.explanation) ?? "Live SAIA optimization returned.";

  return { optimizedQuery, rationale, warnings: optimizedQuery ? [] : ["Live SAIA optimization returned no query text."] };
};

const normalizeAskSplunkQuestionResult = (value: unknown): AskSplunkQuestionResult => {
  const row = firstRowFrom(value);
  const answer =
    stringValue(row.answer) ??
    stringValue(row.explanation) ??
    stringValue(row.content) ??
    (typeof value === "string" ? value : "Live SAIA question returned no answer text.");

  return { answer, warnings: [] };
};

const parseTextContent = (value: string): unknown => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

const extractMcpToolOutput = (payload: unknown): unknown => {
  if (!isRecord(payload)) {
    return payload;
  }

  if (isRecord(payload.error)) {
    const message = typeof payload.error.message === "string" ? payload.error.message : "Live MCP tool call failed.";
    throw new Error(message);
  }

  if ("output" in payload) {
    return payload.output;
  }

  const result = payload.result;
  if (!isRecord(result)) {
    return result ?? payload;
  }

  if (result.isError === true) {
    const text =
      Array.isArray(result.content) &&
      result.content.find(
        (item): item is { type: string; text: string } =>
          isRecord(item) && item.type === "text" && typeof item.text === "string"
      )?.text;

    throw new Error(text || "Live MCP tool call failed.");
  }

  if ("structuredContent" in result) {
    return result.structuredContent;
  }

  if ("output" in result) {
    return result.output;
  }

  if (Array.isArray(result.content)) {
    const textItem = result.content.find(
      (item): item is { type: string; text: string } =>
        isRecord(item) && item.type === "text" && typeof item.text === "string"
    );

    if (textItem) {
      return parseTextContent(textItem.text);
    }
  }

  return result;
};

export const createHttpLiveSplunkTransport = (options: HttpLiveSplunkTransportOptions = {}): LiveSplunkTransport => {
  const fetchImpl = options.fetch ?? globalThis.fetch;

  return {
    async call<TInput, TOutput>(request: LiveSplunkTransportRequest<TInput>): Promise<TOutput> {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), request.timeoutMs);

      try {
        const response = await fetchImpl(request.endpointUrl, {
          method: "POST",
          headers: {
            ...request.headers,
            authorization: `Bearer ${request.authToken}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: `${request.options.requestId}:${request.toolName}`,
            method: "tools/call",
            params: {
              name: request.toolName,
              arguments: request.input,
              defaultApp: request.defaultApp
            }
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Live MCP endpoint returned HTTP ${response.status}.`);
        }

        return extractMcpToolOutput((await response.json()) as unknown) as TOutput;
      } finally {
        clearTimeout(timeout);
      }
    }
  };
};

const createContext = (
  toolName: AdapterRequestContext["toolName"],
  options: AdapterCallOptions
): AdapterRequestContext => ({
  ...options,
  mode: "live",
  toolName
});

const missingConfigFields = (config: LiveSplunkAdapterConfig): string[] => {
  const missingFields: string[] = [];

  if (!config.endpointUrl) {
    missingFields.push("SPLUNKREADY_SPLUNK_MCP_URL");
  }

  if (!config.authToken) {
    missingFields.push("SPLUNKREADY_SPLUNK_MCP_TOKEN");
  }

  if (!config.transport) {
    missingFields.push("live transport");
  }

  return missingFields;
};

const assertLiveAdapterReady = (
  config: LiveSplunkAdapterConfig,
  context: AdapterRequestContext
): {
  endpointUrl: string;
  authToken: string;
  headers?: Record<string, string>;
  timeoutMs: number;
  transport: LiveSplunkTransport;
} => {
  if (!config.enabled) {
    throw createSplunkAdapterError({
      code: "LIVE_ADAPTER_DISABLED",
      message:
        "Live Splunk adapter is disabled by default. Set SPLUNKREADY_LIVE_ENABLED=true and provide live MCP configuration to use live mode.",
      context
    });
  }

  const missingFields = missingConfigFields(config);
  const endpointUrl = config.endpointUrl;
  const authToken = config.authToken;
  const transport = config.transport;

  if (missingFields.length > 0 || !endpointUrl || !authToken || !transport) {
    throw createSplunkAdapterError({
      code: "LIVE_ADAPTER_MISSING_CONFIG",
      message: `Live Splunk adapter is missing required configuration: ${missingFields.join(", ")}.`,
      context
    });
  }

  const capabilities = new Set(config.capabilities ?? readOnlySplunkToolNameSchema.options);
  if (!capabilities.has(context.toolName)) {
    throw createSplunkAdapterError({
      code: "LIVE_ADAPTER_CAPABILITY_UNAVAILABLE",
      message: `Live Splunk adapter capability ${context.toolName} is not enabled for this configuration.`,
      context
    });
  }

  const useHostedModelTarget =
    context.toolName.startsWith("saia_") && Boolean(config.hostedModelEndpointUrl && config.hostedModelAuthToken);
  return {
    endpointUrl: useHostedModelTarget ? config.hostedModelEndpointUrl ?? endpointUrl : endpointUrl,
    authToken: useHostedModelTarget ? config.hostedModelAuthToken ?? authToken : authToken,
    headers: useHostedModelTarget ? config.hostedModelHeaders : undefined,
    timeoutMs: config.timeoutMs ?? 30_000,
    transport
  };
};

const emitStart = async (traceHooks: AdapterTraceHooks | undefined, context: AdapterRequestContext, input: unknown) => {
  await traceHooks?.onToolStart?.({ context, input, startedAt: new Date(0).toISOString() });
};

const emitEnd = async (
  traceHooks: AdapterTraceHooks | undefined,
  context: AdapterRequestContext,
  outputSummary: string,
  resultCount?: number,
  evidenceRefs?: string[]
) => {
  await traceHooks?.onToolEnd?.({
    context,
    outputSummary,
    resultCount,
    evidenceRefs,
    finishedAt: new Date(0).toISOString()
  });
};

const emitError = async (
  traceHooks: AdapterTraceHooks | undefined,
  context: AdapterRequestContext,
  error: ReturnType<typeof createSplunkAdapterError>
) => {
  await traceHooks?.onToolError?.({ context, error, finishedAt: new Date(0).toISOString() });
};

const resultCountFrom = (output: unknown): number | undefined =>
  output && typeof output === "object" && "resultCount" in output && typeof output.resultCount === "number"
    ? output.resultCount
    : undefined;

const evidenceRefsFrom = (output: unknown): string[] | undefined =>
  output &&
  typeof output === "object" &&
  "evidenceRefs" in output &&
  Array.isArray(output.evidenceRefs) &&
  output.evidenceRefs.every((value) => typeof value === "string")
    ? output.evidenceRefs
    : undefined;

export const createLiveSplunkAccessAdapter = (
  config: LiveSplunkAdapterConfig = {},
  traceHooks?: AdapterTraceHooks
): SplunkAccessAdapter => {
  const callLiveTool = async <TInput, TOutput>(
    toolName: ReadOnlySplunkToolName,
    input: TInput,
    options: AdapterCallOptions,
    outputSummary: string
  ): Promise<TOutput> => {
    const context = createContext(toolName, options);
    await emitStart(traceHooks, context, input);

    try {
      const readyConfig = assertLiveAdapterReady(config, context);
      const output = await readyConfig.transport.call<TInput, TOutput>({
        toolName,
        input,
        endpointUrl: readyConfig.endpointUrl,
        authToken: readyConfig.authToken,
        headers: readyConfig.headers,
        defaultApp: config.defaultApp,
        timeoutMs: readyConfig.timeoutMs,
        options
      });
      await emitEnd(traceHooks, context, outputSummary, resultCountFrom(output), evidenceRefsFrom(output));
      return output;
    } catch (error) {
      const adapterError =
        error && typeof error === "object" && "name" in error && error.name === "SplunkAdapterError"
          ? (error as ReturnType<typeof createSplunkAdapterError>)
          : createSplunkAdapterError({
              code: "LIVE_ADAPTER_TRANSPORT_ERROR",
              message: `Live Splunk adapter transport failed for ${toolName}.`,
              retryable: true,
              context,
              cause: error
            });
      await emitError(traceHooks, context, adapterError);
      throw adapterError;
    }
  };

  return {
    mode: "live",
    traceHooks,
    getInfo: async (options) =>
      normalizeLiveInfo(
        await callLiveTool<Record<string, never>, unknown>("splunk_get_info", {}, options, "Live Splunk info loaded."),
        config.capabilities
      ),
    getUserInfo: (options) =>
      callLiveTool<Record<string, never>, unknown>("splunk_get_user_info", {}, options, "Live Splunk user info loaded.").then(
        normalizeLiveUserInfo
      ),
    getIndexes: (options) =>
      callLiveTool<Record<string, never>, unknown>("splunk_get_indexes", {}, options, "Live Splunk indexes loaded.").then(
        normalizeLiveIndexes
      ),
    getMetadata: (input: MetadataRequest, options) =>
      callLiveTool<Record<string, unknown>, unknown>(
        "splunk_get_metadata",
        liveMetadataInput(input),
        options,
        "Live Splunk metadata loaded."
      ).then((output) => normalizeLiveMetadata(input, output)),
    getKnowledgeObjects: async (input: KnowledgeObjectRequest, options) => {
      const perType = await Promise.all(
        input.types.map(async (requestedType) => ({
          requestedType,
          output: await callLiveTool<Record<string, unknown>, unknown>(
            "splunk_get_knowledge_objects",
            {
              type: liveKnowledgeTypeFor(requestedType),
              row_limit: 100,
              ...(input.app ? { app: input.app } : {}),
              ...(input.query ? { search: input.query } : {})
            },
            options,
            "Live Splunk knowledge objects loaded."
          )
        }))
      );
      const objects = perType
        .flatMap(({ requestedType, output }) => normalizeKnowledgeObjects(requestedType, output, config.defaultApp))
        .filter((object) => knowledgeObjectMatchesRequest(object, input));

      return {
        objects,
        resultCount: objects.length,
        warnings: input.types.includes("dashboards")
          ? ["Live MCP serves dashboards through the views knowledge-object type."]
          : []
      };
    },
    runQuery: (input: RunQueryRequest, options) =>
      callLiveTool<RunQueryRequest, unknown>("splunk_run_query", input, options, "Live Splunk query executed.").then(
        (output) => normalizeLiveQueryResult(input, output)
      ),
    runSavedSearch: (input: RunSavedSearchRequest, options) =>
      callLiveTool<Record<string, unknown>, unknown>(
        "splunk_run_saved_search",
        liveSavedSearchInput(input),
        options,
        "Live Splunk saved search executed."
      ).then((output) => normalizeLiveSavedSearchResult(input, output)),
    generateSpl: (input: GenerateSplRequest, options) =>
      callLiveTool<Record<string, unknown>, unknown>(
        "saia_generate_spl",
        liveSplGenerationInput(input),
        options,
        "Live SPL generation loaded."
      ).then(normalizeGenerateSplResult),
    explainSpl: (input: ExplainSplRequest, options) =>
      callLiveTool<Record<string, unknown>, unknown>(
        "saia_explain_spl",
        liveSplAssistanceInput(input),
        options,
        "Live SPL explanation loaded."
      ).then(normalizeExplainSplResult),
    optimizeSpl: (input: OptimizeSplRequest, options) =>
      callLiveTool<Record<string, unknown>, unknown>(
        "saia_optimize_spl",
        liveSplAssistanceInput(input),
        options,
        "Live SPL optimization loaded."
      ).then(normalizeOptimizeSplResult),
    askSplunkQuestion: (input: AskSplunkQuestionRequest, options) =>
      callLiveTool<Record<string, unknown>, unknown>(
        "saia_ask_splunk_question",
        liveSplunkQuestionInput(input),
        options,
        "Live Splunk question answer loaded."
      ).then(normalizeAskSplunkQuestionResult)
  };
};
