import { readOnlySplunkToolNameSchema, type ReadOnlySplunkToolName } from "../schemas/core.js";
import {
  createSplunkAdapterError,
  type AdapterCallOptions,
  type AdapterRequestContext,
  type AdapterTraceHooks,
  type ExplainSplRequest,
  type ExplainSplResult,
  type IndexSummary,
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
  defaultApp?: string;
  timeoutMs?: number;
  capabilities?: ReadOnlySplunkToolName[];
  transport?: LiveSplunkTransport;
}

export const createLiveSplunkAdapterConfigFromEnv = (
  env: NodeJS.ProcessEnv = process.env
): LiveSplunkAdapterConfig => ({
  enabled: env.SPLUNKREADY_LIVE_ENABLED === "true",
  endpointUrl: env.SPLUNKREADY_SPLUNK_MCP_URL,
  authToken: env.SPLUNKREADY_SPLUNK_MCP_TOKEN,
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

  return {
    endpointUrl,
    authToken,
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
    getInfo: (options) => callLiveTool<Record<string, never>, SplunkInfo>("splunk_get_info", {}, options, "Live Splunk info loaded."),
    getUserInfo: (options) =>
      callLiveTool<Record<string, never>, SplunkUserInfo>("splunk_get_user_info", {}, options, "Live Splunk user info loaded."),
    getIndexes: (options) =>
      callLiveTool<Record<string, never>, IndexSummary[]>("splunk_get_indexes", {}, options, "Live Splunk indexes loaded."),
    getMetadata: (input: MetadataRequest, options) =>
      callLiveTool<MetadataRequest, MetadataResult>("splunk_get_metadata", input, options, "Live Splunk metadata loaded."),
    getKnowledgeObjects: (input: KnowledgeObjectRequest, options) =>
      callLiveTool<KnowledgeObjectRequest, KnowledgeObjectResult>(
        "splunk_get_knowledge_objects",
        input,
        options,
        "Live Splunk knowledge objects loaded."
      ),
    runQuery: (input: RunQueryRequest, options) =>
      callLiveTool<RunQueryRequest, QueryResult>("splunk_run_query", input, options, "Live Splunk query executed."),
    runSavedSearch: (input: RunSavedSearchRequest, options) =>
      callLiveTool<RunSavedSearchRequest, SavedSearchResult>(
        "splunk_run_saved_search",
        input,
        options,
        "Live Splunk saved search executed."
      ),
    explainSpl: (input: ExplainSplRequest, options) =>
      callLiveTool<ExplainSplRequest, ExplainSplResult>("saia_explain_spl", input, options, "Live SPL explanation loaded."),
    optimizeSpl: (input: OptimizeSplRequest, options) =>
      callLiveTool<OptimizeSplRequest, OptimizeSplResult>("saia_optimize_spl", input, options, "Live SPL optimization loaded.")
  };
};
