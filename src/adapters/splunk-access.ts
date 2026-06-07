import type { ReadOnlySplunkToolName } from "../schemas/core.js";

export type AdapterMode = "fixture" | "live";

export interface AdapterCallOptions {
  requestId: string;
  missionId?: string;
  traceEventId?: string;
}

export interface AdapterRequestContext extends AdapterCallOptions {
  mode: AdapterMode;
  toolName: ReadOnlySplunkToolName;
}

export interface AdapterTraceStartEvent {
  context: AdapterRequestContext;
  input: unknown;
  startedAt: string;
}

export interface AdapterTraceEndEvent {
  context: AdapterRequestContext;
  outputSummary: string;
  resultCount?: number;
  evidenceRefs?: string[];
  finishedAt: string;
}

export interface AdapterTraceErrorEvent {
  context: AdapterRequestContext;
  error: SplunkAdapterError;
  finishedAt: string;
}

export interface AdapterTraceHooks {
  onToolStart?(event: AdapterTraceStartEvent): void | Promise<void>;
  onToolEnd?(event: AdapterTraceEndEvent): void | Promise<void>;
  onToolError?(event: AdapterTraceErrorEvent): void | Promise<void>;
}

export interface SplunkAdapterError {
  name: "SplunkAdapterError";
  code: string;
  message: string;
  retryable: boolean;
  context: AdapterRequestContext;
  cause?: unknown;
}

export const createSplunkAdapterError = (input: {
  code: string;
  message: string;
  retryable?: boolean;
  context: AdapterRequestContext;
  cause?: unknown;
}): SplunkAdapterError => ({
  name: "SplunkAdapterError",
  code: input.code,
  message: input.message,
  retryable: input.retryable ?? false,
  context: input.context,
  cause: input.cause
});

export interface SplunkInfo {
  mode: AdapterMode;
  deploymentName: string;
  serverVersion?: string;
  readOnlyTools: ReadOnlySplunkToolName[];
}

export interface SplunkUserInfo {
  username: string;
  roles: string[];
  defaultApp?: string;
  capabilities: string[];
}

export interface IndexSummary {
  name: string;
  sensitive: boolean;
  description?: string;
}

export interface SourcetypeSummary {
  name: string;
  indexes: string[];
  fields: string[];
}

export interface TimeWindow {
  earliest: string;
  latest: string;
}

export interface MetadataRequest {
  indexes?: string[];
  sourcetypes?: string[];
  timeWindow?: TimeWindow;
}

export interface MetadataResult {
  indexes: IndexSummary[];
  sourcetypes: SourcetypeSummary[];
  source: AdapterMode;
  warnings: string[];
}

export type KnowledgeObjectType =
  | "saved_searches"
  | "macros"
  | "lookups"
  | "dashboards"
  | "panels"
  | "field_aliases"
  | "data_models";

export interface KnowledgeObjectRequest {
  types: KnowledgeObjectType[];
  query?: string;
  app?: string;
}

export interface KnowledgeObjectSummary {
  id: string;
  type: KnowledgeObjectType;
  name: string;
  app: string;
  description?: string;
  dependsOn?: string[];
  metadata?: Record<string, unknown>;
}

export interface KnowledgeObjectResult {
  objects: KnowledgeObjectSummary[];
  resultCount: number;
  warnings: string[];
}

export interface RunQueryRequest {
  query: string;
  timeWindow?: TimeWindow;
  maxRows?: number;
  app?: string;
}

export interface QueryResult {
  queryRef: string;
  rows: Array<Record<string, unknown>>;
  resultCount: number;
  evidenceRefs: string[];
  warnings: string[];
}

export interface RunSavedSearchRequest {
  name: string;
  app: string;
  tokens?: Record<string, string>;
  maxRows?: number;
}

export interface SavedSearchResult {
  savedSearchRef: string;
  rows: Array<Record<string, unknown>>;
  resultCount: number;
  evidenceRefs: string[];
  warnings: string[];
}

export interface ExplainSplRequest {
  query: string;
  app?: string;
}

export interface GenerateSplRequest {
  prompt: string;
  app?: string;
}

export interface GenerateSplResult {
  query: string;
  rationale?: string;
  warnings: string[];
}

export interface ExplainSplResult {
  explanation: string;
  warnings: string[];
}

export interface OptimizeSplRequest {
  query: string;
  app?: string;
}

export interface OptimizeSplResult {
  optimizedQuery: string;
  rationale: string;
  warnings: string[];
}

export interface AskSplunkQuestionRequest {
  question: string;
  app?: string;
}

export interface AskSplunkQuestionResult {
  answer: string;
  warnings: string[];
}

export interface SplunkAccessAdapter {
  mode: AdapterMode;
  traceHooks?: AdapterTraceHooks;
  getInfo(options: AdapterCallOptions): Promise<SplunkInfo>;
  getUserInfo(options: AdapterCallOptions): Promise<SplunkUserInfo>;
  getIndexes(options: AdapterCallOptions): Promise<IndexSummary[]>;
  getMetadata(input: MetadataRequest, options: AdapterCallOptions): Promise<MetadataResult>;
  getKnowledgeObjects(
    input: KnowledgeObjectRequest,
    options: AdapterCallOptions
  ): Promise<KnowledgeObjectResult>;
  runQuery(input: RunQueryRequest, options: AdapterCallOptions): Promise<QueryResult>;
  runSavedSearch(input: RunSavedSearchRequest, options: AdapterCallOptions): Promise<SavedSearchResult>;
  generateSpl?(input: GenerateSplRequest, options: AdapterCallOptions): Promise<GenerateSplResult>;
  explainSpl?(input: ExplainSplRequest, options: AdapterCallOptions): Promise<ExplainSplResult>;
  optimizeSpl?(input: OptimizeSplRequest, options: AdapterCallOptions): Promise<OptimizeSplResult>;
  askSplunkQuestion?(input: AskSplunkQuestionRequest, options: AdapterCallOptions): Promise<AskSplunkQuestionResult>;
}
