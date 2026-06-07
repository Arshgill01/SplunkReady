import {
  createSplunkAdapterError,
  type AdapterCallOptions,
  type AdapterRequestContext,
  type AskSplunkQuestionRequest,
  type AskSplunkQuestionResult,
  type ExplainSplRequest,
  type ExplainSplResult,
  type GenerateSplRequest,
  type GenerateSplResult,
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
} from "../adapters/splunk-access.js";
import type { AgentPolicy } from "../policy/compiler.js";
import type { EnvironmentContract } from "../schemas/core.js";

export const firewallBlockedCode = "FIREWALL_POLICY_BLOCKED";

interface FirewallViolation {
  ruleId: "SPL-001" | "SPL-003" | "SPL-005" | "SAF-003";
  reason: string;
}

const forbiddenCommandPatterns = [
  { pattern: /\|\s*delete\b/i, label: "| delete" },
  { pattern: /\|\s*collect\b/i, label: "| collect" },
  { pattern: /\|\s*outputlookup\b/i, label: "| outputlookup" }
];

const ignoredFieldTokens = new Set(["earliest", "index", "latest", "sourcetype"]);

const normalizeTokenValue = (value: string): string => value.replace(/^['"]|['"]$/g, "");

const extractAssignedValues = (query: string, key: "index" | "sourcetype"): string[] =>
  [...query.matchAll(new RegExp(`\\b${key}\\s*=\\s*([^\\s|]+)`, "gi"))].map((match) =>
    normalizeTokenValue(match[1])
  );

const extractFieldCandidates = (query: string): string[] => {
  const comparisonFields = [...query.matchAll(/\b([A-Za-z_][\w.]*)\s*(?:!?=|>=?|<=?)/g)].map((match) => match[1]);
  const byFields = [...query.matchAll(/\bby\s+([^|]+)/gi)].flatMap((match) =>
    match[1]
      .split(/[,\s]+/)
      .map((field) => field.trim())
      .filter(Boolean)
  );

  return [...new Set([...comparisonFields, ...byFields])].filter(
    (field) => !ignoredFieldTokens.has(field.toLocaleLowerCase())
  );
};

const queryContains = (query: string, pattern: string): boolean =>
  query.toLocaleLowerCase().includes(pattern.toLocaleLowerCase());

const blockRulesById = (policy: AgentPolicy, ruleId: FirewallViolation["ruleId"]): unknown[] =>
  [
    ...policy.resourceRules,
    ...policy.queryRules,
    ...policy.knowledgeRules,
    ...policy.evidenceRules,
    ...policy.safetyRules
  ]
    .filter((rule) => rule.ruleId === ruleId && rule.action === "block")
    .map((rule) => rule.value);

const inspectFirewallQuery = (
  query: string,
  contract: EnvironmentContract,
  policy: AgentPolicy
): FirewallViolation[] => {
  const knownIndexes = new Set(contract.indexes.map((index) => index.name));
  const sensitiveIndexes = new Set(contract.indexes.filter((index) => index.sensitive).map((index) => index.name));
  const restrictedIndexes = new Set(contract.restrictedIndexes);
  const knownSourcetypes = new Set(contract.sourcetypes.map((sourcetype) => sourcetype.name));
  const knownFields = new Set([
    ...contract.sourcetypes.flatMap((sourcetype) => sourcetype.fields),
    ...Object.values(contract.canonicalFields)
  ]);
  const blockPatternRules = blockRulesById(policy, "SPL-001").flatMap((value) => {
    if (value && typeof value === "object" && "pattern" in value && typeof value.pattern === "string") {
      return [value.pattern];
    }

    return [];
  });
  const forbiddenPatterns = [...new Set([...contract.forbiddenQueryPatterns, ...blockPatternRules])];
  const forbiddenPatternViolations: FirewallViolation[] = forbiddenPatterns
    .filter((pattern) => queryContains(query, pattern))
    .map(
      (pattern): FirewallViolation => ({
        ruleId: "SPL-001",
        reason: `Query contains forbidden SPL pattern ${pattern}.`
      })
    );
  const forbiddenCommandViolations: FirewallViolation[] = forbiddenCommandPatterns
    .filter((candidate) => candidate.pattern.test(query))
    .map(
      (candidate): FirewallViolation => ({
        ruleId: "SPL-001",
        reason: `Query contains forbidden SPL command ${candidate.label}.`
      })
    );
  const indexViolations: FirewallViolation[] = extractAssignedValues(query, "index").flatMap((index): FirewallViolation[] => {
    if (index === "*") {
      return [
        {
          ruleId: "SPL-001",
          reason: "Query uses index=* and would search every index."
        } satisfies FirewallViolation
      ];
    }

    if (!knownIndexes.has(index)) {
      return [
        {
          ruleId: "SPL-003",
          reason: `Query references index ${index}, which is not present in the environment contract.`
        } satisfies FirewallViolation
      ];
    }

    if (restrictedIndexes.has(index) || sensitiveIndexes.has(index)) {
      return [
        {
          ruleId: "SPL-005",
          reason: `Query references restricted or sensitive index ${index}.`
        } satisfies FirewallViolation
      ];
    }

    return [];
  });
  const sourcetypeViolations: FirewallViolation[] = extractAssignedValues(query, "sourcetype").flatMap((sourcetype): FirewallViolation[] =>
    knownSourcetypes.has(sourcetype)
      ? []
      : [
          {
            ruleId: "SPL-003",
            reason: `Query references sourcetype ${sourcetype}, which is not present in the environment contract.`
          } satisfies FirewallViolation
        ]
  );
  const fieldViolations: FirewallViolation[] = extractFieldCandidates(query).flatMap((field): FirewallViolation[] => {
    const canonicalField = contract.canonicalFields[field];

    if (canonicalField) {
      return [
        {
          ruleId: "SPL-003",
          reason: `Query uses non-canonical field ${field}; use ${canonicalField}.`
        } satisfies FirewallViolation
      ];
    }

    if (knownFields.has(field)) {
      return [];
    }

    return [
      {
        ruleId: "SPL-003",
        reason: `Query references field ${field}, which is not present in the environment contract.`
      } satisfies FirewallViolation
    ];
  });

  return [
    ...forbiddenPatternViolations,
    ...forbiddenCommandViolations,
    ...indexViolations,
    ...sourcetypeViolations,
    ...fieldViolations
  ];
};

const contextFor = (
  underlying: SplunkAccessAdapter,
  toolName: AdapterRequestContext["toolName"],
  options: AdapterCallOptions
): AdapterRequestContext => ({
  ...options,
  mode: underlying.mode,
  toolName
});

export class SplunkFirewallGateway implements SplunkAccessAdapter {
  readonly mode: SplunkAccessAdapter["mode"];
  readonly traceHooks: SplunkAccessAdapter["traceHooks"];
  readonly generateSpl: SplunkAccessAdapter["generateSpl"];
  readonly explainSpl: SplunkAccessAdapter["explainSpl"];
  readonly optimizeSpl: SplunkAccessAdapter["optimizeSpl"];
  readonly askSplunkQuestion: SplunkAccessAdapter["askSplunkQuestion"];

  constructor(
    private readonly underlying: SplunkAccessAdapter,
    private readonly contract: EnvironmentContract,
    private readonly policy: AgentPolicy
  ) {
    this.mode = underlying.mode;
    this.traceHooks = underlying.traceHooks;
    this.generateSpl = underlying.generateSpl?.bind(underlying) as
      | ((input: GenerateSplRequest, options: AdapterCallOptions) => Promise<GenerateSplResult>)
      | undefined;
    this.explainSpl = underlying.explainSpl?.bind(underlying) as
      | ((input: ExplainSplRequest, options: AdapterCallOptions) => Promise<ExplainSplResult>)
      | undefined;
    this.optimizeSpl = underlying.optimizeSpl?.bind(underlying) as
      | ((input: OptimizeSplRequest, options: AdapterCallOptions) => Promise<OptimizeSplResult>)
      | undefined;
    this.askSplunkQuestion = underlying.askSplunkQuestion?.bind(underlying) as
      | ((input: AskSplunkQuestionRequest, options: AdapterCallOptions) => Promise<AskSplunkQuestionResult>)
      | undefined;
  }

  getInfo(options: AdapterCallOptions): Promise<SplunkInfo> {
    return this.underlying.getInfo(options);
  }

  getUserInfo(options: AdapterCallOptions): Promise<SplunkUserInfo> {
    return this.underlying.getUserInfo(options);
  }

  getIndexes(options: AdapterCallOptions): Promise<IndexSummary[]> {
    return this.underlying.getIndexes(options);
  }

  getMetadata(input: MetadataRequest, options: AdapterCallOptions): Promise<MetadataResult> {
    return this.underlying.getMetadata(input, options);
  }

  getKnowledgeObjects(input: KnowledgeObjectRequest, options: AdapterCallOptions): Promise<KnowledgeObjectResult> {
    return this.underlying.getKnowledgeObjects(input, options);
  }

  async runQuery(input: RunQueryRequest, options: AdapterCallOptions): Promise<QueryResult> {
    const violations = this.policy.allowedTools.includes("splunk_run_query")
      ? inspectFirewallQuery(input.query, this.contract, this.policy)
      : [
          {
            ruleId: "SAF-003",
            reason: "Agent policy does not allow splunk_run_query."
          } satisfies FirewallViolation
        ];

    if (violations.length > 0) {
      throw createSplunkAdapterError({
        code: firewallBlockedCode,
        message: `SplunkReady firewall blocked splunk_run_query before Splunk execution: ${violations
          .map((violation) => `${violation.ruleId} ${violation.reason}`)
          .join("; ")}`,
        retryable: false,
        context: contextFor(this.underlying, "splunk_run_query", options),
        cause: { query: input.query, violations }
      });
    }

    return this.underlying.runQuery(input, options);
  }

  runSavedSearch(input: RunSavedSearchRequest, options: AdapterCallOptions): Promise<SavedSearchResult> {
    return this.underlying.runSavedSearch(input, options);
  }
}
