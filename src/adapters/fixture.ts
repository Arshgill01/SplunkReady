import { readFile } from "node:fs/promises";

import { z } from "zod";

import { readOnlySplunkToolNameSchema } from "../schemas/core.js";
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
  type KnowledgeObjectRequest,
  type KnowledgeObjectResult,
  type KnowledgeObjectSummary,
  type MetadataRequest,
  type MetadataResult,
  type OptimizeSplRequest,
  type OptimizeSplResult,
  type QueryResult,
  type RunQueryRequest,
  type RunSavedSearchRequest,
  type SavedSearchResult,
  type SourcetypeSummary,
  type SplunkAccessAdapter,
  type SplunkInfo,
  type SplunkUserInfo
} from "./splunk-access.js";

const looseRowSchema = z.record(z.unknown());
const queryResultSchema = z
  .object({
    queryRef: z.string().min(1),
    rows: z.array(looseRowSchema),
    resultCount: z.number().int().nonnegative(),
    evidenceRefs: z.array(z.string().min(1)),
    warnings: z.array(z.string())
  })
  .strict();

const savedSearchResultSchema = z
  .object({
    savedSearchRef: z.string().min(1),
    rows: z.array(looseRowSchema),
    resultCount: z.number().int().nonnegative(),
    evidenceRefs: z.array(z.string().min(1)),
    warnings: z.array(z.string())
  })
  .strict();

export const fixtureSplunkDatasetSchema = z
  .object({
    fixtureVersion: z.string().min(1),
    mode: z.literal("fixture"),
    deploymentName: z.string().min(1),
    serverVersion: z.string().min(1),
    readOnlyTools: z.array(readOnlySplunkToolNameSchema).min(1),
    user: z
      .object({
        username: z.string().min(1),
        roles: z.array(z.string().min(1)),
        defaultApp: z.string().optional(),
        capabilities: z.array(z.string().min(1))
      })
      .strict(),
    indexes: z.array(z.object({ name: z.string().min(1), sensitive: z.boolean(), description: z.string().optional() }).strict()),
    sourcetypes: z.array(
      z.object({ name: z.string().min(1), indexes: z.array(z.string().min(1)), fields: z.array(z.string().min(1)) }).strict()
    ),
    knowledgeObjects: z.array(
      z
        .object({
          id: z.string().min(1),
          type: z.enum(["saved_searches", "macros", "lookups", "dashboards", "panels", "field_aliases", "data_models"]),
          name: z.string().min(1),
          app: z.string().min(1),
          description: z.string().optional(),
          dependsOn: z.array(z.string().min(1)).optional(),
          metadata: z.record(z.unknown()).optional()
        })
        .strict()
    ),
    queryResults: z.record(queryResultSchema),
    savedSearchResults: z.record(savedSearchResultSchema),
    splExplanations: z.record(z.object({ explanation: z.string().min(1), warnings: z.array(z.string()) }).strict()),
    splOptimizations: z.record(
      z.object({ optimizedQuery: z.string().min(1), rationale: z.string().min(1), warnings: z.array(z.string()) }).strict()
    )
  })
  .strict();

export type FixtureSplunkDataset = z.infer<typeof fixtureSplunkDatasetSchema>;

export const loadFixtureSplunkDatasetFromFile = async (filePath: string | URL): Promise<FixtureSplunkDataset> => {
  const rawFixture = await readFile(filePath, "utf8");
  return fixtureSplunkDatasetSchema.parse(JSON.parse(rawFixture));
};

const savedSearchKey = (input: RunSavedSearchRequest) => `${input.app}::${input.name}`;

interface NormalizedKnowledgeObjectQuery {
  app?: string;
  term?: string;
}

const queryFilterPattern = (field: "app" | "name") =>
  new RegExp(`(?:^|\\s)${field}\\s*=\\s*(?:"([^"]+)"|'([^']+)'|(.+?))(?=\\s+\\w+\\s*=|$)`, "i");

const normalizeKnowledgeObjectQuery = (rawQuery: string | undefined): NormalizedKnowledgeObjectQuery => {
  const trimmedQuery = rawQuery?.trim();
  if (!trimmedQuery) {
    return {};
  }

  const nameFilter = trimmedQuery.match(queryFilterPattern("name"));
  const appFilter = trimmedQuery.match(queryFilterPattern("app"));
  const rawTerm = nameFilter?.[1] ?? nameFilter?.[2] ?? nameFilter?.[3] ?? trimmedQuery.replace(/["']/g, "");
  const rawApp = appFilter?.[1] ?? appFilter?.[2] ?? appFilter?.[3];

  return {
    app: rawApp?.trim(),
    term: rawTerm.trim().toLowerCase()
  };
};

const createContext = (
  toolName: AdapterRequestContext["toolName"],
  options: AdapterCallOptions
): AdapterRequestContext => ({
  ...options,
  mode: "fixture",
  toolName
});

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

export const createFixtureSplunkAccessAdapter = (
  fixture: FixtureSplunkDataset,
  traceHooks?: AdapterTraceHooks
): SplunkAccessAdapter => ({
  mode: "fixture",
  traceHooks,
  async getInfo(options): Promise<SplunkInfo> {
    const context = createContext("splunk_get_info", options);
    await emitStart(traceHooks, context, {});
    const result = {
      mode: "fixture",
      deploymentName: fixture.deploymentName,
      serverVersion: fixture.serverVersion,
      readOnlyTools: fixture.readOnlyTools
    } satisfies SplunkInfo;
    await emitEnd(traceHooks, context, "Fixture Splunk info loaded.");
    return result;
  },
  async getUserInfo(options): Promise<SplunkUserInfo> {
    const context = createContext("splunk_get_user_info", options);
    await emitStart(traceHooks, context, {});
    await emitEnd(traceHooks, context, "Fixture user info loaded.");
    return fixture.user;
  },
  async getIndexes(options): Promise<IndexSummary[]> {
    const context = createContext("splunk_get_indexes", options);
    await emitStart(traceHooks, context, {});
    await emitEnd(traceHooks, context, "Fixture indexes loaded.", fixture.indexes.length);
    return fixture.indexes;
  },
  async getMetadata(input: MetadataRequest, options): Promise<MetadataResult> {
    const context = createContext("splunk_get_metadata", options);
    await emitStart(traceHooks, context, input);
    const indexFilter = new Set(input.indexes ?? fixture.indexes.map((index) => index.name));
    const sourcetypeFilter = new Set(input.sourcetypes ?? fixture.sourcetypes.map((sourcetype) => sourcetype.name));
    const indexes = fixture.indexes.filter((index) => indexFilter.has(index.name));
    const sourcetypes = fixture.sourcetypes.filter((sourcetype) => sourcetypeFilter.has(sourcetype.name));
    await emitEnd(traceHooks, context, "Fixture metadata loaded.", sourcetypes.length);
    return { indexes, sourcetypes, source: "fixture", warnings: [] };
  },
  async getKnowledgeObjects(input: KnowledgeObjectRequest, options): Promise<KnowledgeObjectResult> {
    const context = createContext("splunk_get_knowledge_objects", options);
    await emitStart(traceHooks, context, input);
    const query = normalizeKnowledgeObjectQuery(input.query);
    const appFilter = input.app ?? query.app;
    const objects = fixture.knowledgeObjects.filter((object) => {
      const matchesType = input.types.includes(object.type);
      const matchesApp = appFilter ? object.app === appFilter : true;
      const matchesQuery = query.term
        ? object.name.toLowerCase().includes(query.term) || object.description?.toLowerCase().includes(query.term)
        : true;
      return matchesType && matchesApp && matchesQuery;
    });
    await emitEnd(traceHooks, context, "Fixture knowledge objects loaded.", objects.length);
    return { objects, resultCount: objects.length, warnings: [] };
  },
  async runQuery(input: RunQueryRequest, options): Promise<QueryResult> {
    const context = createContext("splunk_run_query", options);
    await emitStart(traceHooks, context, input);
    const result =
      fixture.queryResults[input.query] ?? ({
        queryRef: `fixture-query-miss:${Buffer.from(input.query).toString("base64url")}`,
        rows: [],
        resultCount: 0,
        evidenceRefs: [],
        warnings: ["No fixture query result matched the exact SPL input."]
      } satisfies QueryResult);
    await emitEnd(traceHooks, context, "Fixture query result loaded.", result.resultCount, result.evidenceRefs);
    return result;
  },
  async runSavedSearch(input: RunSavedSearchRequest, options): Promise<SavedSearchResult> {
    const context = createContext("splunk_run_saved_search", options);
    await emitStart(traceHooks, context, input);
    const result = fixture.savedSearchResults[savedSearchKey(input)];
    if (!result) {
      throw createSplunkAdapterError({
        code: "FIXTURE_SAVED_SEARCH_NOT_FOUND",
        message: `No fixture saved search result for ${savedSearchKey(input)}`,
        context
      });
    }
    await emitEnd(traceHooks, context, "Fixture saved search result loaded.", result.resultCount, result.evidenceRefs);
    return result;
  },
  async generateSpl(input: GenerateSplRequest, options): Promise<GenerateSplResult> {
    const context = createContext("saia_generate_spl", options);
    await emitStart(traceHooks, context, input);
    const result = {
      query: "search index=wineventlog host=win-finance-07 src=* earliest=-24h latest=now",
      rationale: `Fixture SAIA generated SPL from prompt: ${input.prompt}`,
      warnings: []
    };
    await emitEnd(traceHooks, context, "Fixture SPL generation loaded.");
    return result;
  },
  async explainSpl(input: ExplainSplRequest, options): Promise<ExplainSplResult> {
    const context = createContext("saia_explain_spl", options);
    await emitStart(traceHooks, context, input);
    const result = fixture.splExplanations[input.query] ?? { explanation: "No fixture SPL explanation matched.", warnings: [] };
    await emitEnd(traceHooks, context, "Fixture SPL explanation loaded.");
    return result;
  },
  async optimizeSpl(input: OptimizeSplRequest, options): Promise<OptimizeSplResult> {
    const context = createContext("saia_optimize_spl", options);
    await emitStart(traceHooks, context, input);
    const result =
      fixture.splOptimizations[input.query] ?? {
        optimizedQuery: input.query,
        rationale: "No fixture SPL optimization matched.",
        warnings: []
      };
    await emitEnd(traceHooks, context, "Fixture SPL optimization loaded.");
    return result;
  },
  async askSplunkQuestion(input: AskSplunkQuestionRequest, options): Promise<AskSplunkQuestionResult> {
    const context = createContext("saia_ask_splunk_question", options);
    await emitStart(traceHooks, context, input);
    const result = {
      answer: `Fixture SAIA guidance for question: ${input.question}`,
      warnings: []
    };
    await emitEnd(traceHooks, context, "Fixture Splunk question answer loaded.");
    return result;
  }
});
