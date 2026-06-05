import {
  environmentContractSchema,
  type EnvironmentContract,
  type ReadOnlySplunkToolName
} from "../schemas/core.js";
import type {
  AdapterCallOptions,
  KnowledgeObjectSummary,
  KnowledgeObjectType,
  SplunkAccessAdapter,
  TimeWindow
} from "../adapters/splunk-access.js";

export interface CompileEnvironmentContractOptions {
  requestId: string;
  contractVersion: string;
  generatedAt: string;
  queryBudgets?: EnvironmentContract["queryBudgets"];
  metadataTimeWindow?: TimeWindow;
}

const knowledgeObjectTypes: KnowledgeObjectType[] = [
  "saved_searches",
  "macros",
  "lookups",
  "dashboards",
  "panels",
  "field_aliases",
  "data_models"
];

const optionalHelperTools: ReadOnlySplunkToolName[] = ["saia_explain_spl", "saia_optimize_spl"];

const defaultQueryBudgets: EnvironmentContract["queryBudgets"] = {
  maxToolCalls: 6,
  maxResultRows: 50,
  timeoutSeconds: 30
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const unique = (values: string[]): string[] => [...new Set(values.filter((value) => value.length > 0))].sort();

const projectKnowledgeObjects = (objects: KnowledgeObjectSummary[], type: KnowledgeObjectType) =>
  objects
    .filter((object) => object.type === type)
    .map((object) => ({ name: object.name, app: object.app }))
    .sort((left, right) => `${left.app}:${left.name}`.localeCompare(`${right.app}:${right.name}`));

const projectRichKnowledgeObjects = (objects: KnowledgeObjectSummary[], types: KnowledgeObjectType[]) =>
  objects
    .filter((object) => types.includes(object.type))
    .map((object) => ({
      id: object.id,
      type: object.type,
      name: object.name,
      app: object.app,
      dependsOn: object.dependsOn ?? [],
      metadata: object.metadata ?? {}
    }))
    .sort((left, right) => `${left.type}:${left.app}:${left.name}`.localeCompare(`${right.type}:${right.app}:${right.name}`));

const inferCanonicalFields = (fields: string[]): Record<string, string> => {
  const discoveredFields = new Set(fields);
  const canonicalFields: Record<string, string> = {};

  if (discoveredFields.has("src")) {
    canonicalFields.auth_source = "src";
  }

  if (discoveredFields.has("dest")) {
    canonicalFields.auth_destination = "dest";
  }

  if (discoveredFields.has("user")) {
    canonicalFields.auth_user = "user";
  }

  return canonicalFields;
};

export const compileEnvironmentContract = async (
  adapter: SplunkAccessAdapter,
  options: CompileEnvironmentContractOptions
): Promise<EnvironmentContract> => {
  const callOptions: AdapterCallOptions = { requestId: options.requestId };
  const info = await adapter.getInfo(callOptions);
  const userInfo = await adapter.getUserInfo(callOptions);
  const indexInventory = await adapter.getIndexes(callOptions);
  const metadata = await adapter.getMetadata(
    {
      indexes: indexInventory.map((index) => index.name),
      timeWindow: options.metadataTimeWindow
    },
    callOptions
  );
  const knowledgeObjects = await adapter.getKnowledgeObjects({ types: knowledgeObjectTypes }, callOptions);
  const allFields = unique(metadata.sourcetypes.flatMap((sourcetype) => sourcetype.fields));
  const canonicalFields = inferCanonicalFields(allFields);
  const warnings = [
    ...metadata.warnings,
    ...knowledgeObjects.warnings,
    `Canonical field map inferred only from discovered fields: ${Object.values(canonicalFields).join(", ") || "none"}.`,
    ...optionalHelperTools
      .filter((toolName) => !info.readOnlyTools.includes(toolName))
      .map((toolName) => `Optional helper tool ${toolName} is unavailable; compiler continuing without it.`)
  ];
  const appContexts = unique([
    userInfo.defaultApp ?? "",
    ...knowledgeObjects.objects.map((object) => object.app)
  ]);
  const contract = {
    id: `contract-${slugify(info.deploymentName)}`,
    name: info.deploymentName,
    version: options.contractVersion,
    generatedAt: options.generatedAt,
    mode: info.mode,
    indexes: metadata.indexes.map((index) => ({ name: index.name, sensitive: index.sensitive })),
    restrictedIndexes: metadata.indexes.filter((index) => index.sensitive).map((index) => index.name),
    sourcetypes: metadata.sourcetypes.map((sourcetype) => ({ name: sourcetype.name, fields: sourcetype.fields })),
    canonicalFields,
    macros: projectKnowledgeObjects(knowledgeObjects.objects, "macros"),
    lookups: projectKnowledgeObjects(knowledgeObjects.objects, "lookups"),
    savedSearches: projectKnowledgeObjects(knowledgeObjects.objects, "saved_searches"),
    knowledgeObjects: projectRichKnowledgeObjects(knowledgeObjects.objects, knowledgeObjectTypes),
    dashboardPanels: projectRichKnowledgeObjects(knowledgeObjects.objects, ["dashboards", "panels"]),
    dataModels: projectRichKnowledgeObjects(knowledgeObjects.objects, ["data_models"]),
    appContexts,
    mcpTools: info.readOnlyTools,
    queryBudgets: options.queryBudgets ?? defaultQueryBudgets,
    evidenceRules: [{ id: "security-evidence", requiresResultCount: true, requiresEvidenceRefs: true }],
    forbiddenQueryPatterns: ["index=*"],
    description: `Compiled SplunkReady environment contract for ${info.deploymentName}.`,
    sourceRefs: [
      "splunk_get_info",
      "splunk_get_user_info",
      "splunk_get_indexes",
      "splunk_get_metadata",
      "splunk_get_knowledge_objects"
    ],
    warnings: unique(warnings)
  } satisfies EnvironmentContract;

  return environmentContractSchema.parse(contract);
};
