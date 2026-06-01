import type { KnowledgeObjectSummary, KnowledgeObjectType } from "../adapters/splunk-access.js";

export interface NormalizedKnowledgeObject {
  id: string;
  type: KnowledgeObjectType;
  name: string;
  app: string;
  owner?: string;
  source?: string;
  dependsOn: string[];
  metadata: Record<string, unknown>;
  raw: KnowledgeObjectSummary;
}

const stringFromMetadata = (metadata: Record<string, unknown>, key: string): string | undefined =>
  typeof metadata[key] === "string" ? metadata[key] : undefined;

const stringListFromMetadata = (metadata: Record<string, unknown>, key: string): string[] =>
  Array.isArray(metadata[key]) ? metadata[key].filter((value): value is string => typeof value === "string") : [];

const metadataDependencyRefs = (metadata: Record<string, unknown>): string[] => [
  ...stringListFromMetadata(metadata, "dependsOn"),
  ...stringListFromMetadata(metadata, "panelIds"),
  ...stringListFromMetadata(metadata, "savedSearchRefs"),
  ...stringListFromMetadata(metadata, "lookupRefs"),
  ...stringListFromMetadata(metadata, "macroRefs"),
  ...[
    "dashboardId",
    "savedSearchRef",
    "lookupRef",
    "macroRef",
    "fieldAliasRef",
    "dataModelRef"
  ]
    .map((key) => stringFromMetadata(metadata, key))
    .filter((value): value is string => Boolean(value))
];

const unique = (values: string[]): string[] => [...new Set(values.filter((value) => value.length > 0))].sort();

export const normalizeKnowledgeObject = (object: KnowledgeObjectSummary): NormalizedKnowledgeObject => {
  const metadata = object.metadata ?? {};

  return {
    id: object.id,
    type: object.type,
    name: object.name,
    app: object.app,
    owner: stringFromMetadata(metadata, "owner"),
    source: stringFromMetadata(metadata, "source"),
    dependsOn: unique([...(object.dependsOn ?? []), ...metadataDependencyRefs(metadata)]),
    metadata,
    raw: object
  };
};

export const normalizeKnowledgeObjects = (objects: KnowledgeObjectSummary[]): NormalizedKnowledgeObject[] =>
  objects.map(normalizeKnowledgeObject).sort((left, right) => left.id.localeCompare(right.id));

export const appContextsFromKnowledgeObjects = (objects: NormalizedKnowledgeObject[]): string[] =>
  unique(objects.map((object) => object.app));
