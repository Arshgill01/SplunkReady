import type { KnowledgeObjectType } from "../adapters/splunk-access.js";
import { normalizeKnowledgeObjects, type NormalizedKnowledgeObject } from "./normalizer.js";

export type KnowledgeGraphNodeKind = "knowledge_object" | "field" | "sourcetype" | "app_context";

export type KnowledgeGraphEdgeType =
  | "app_context"
  | "dashboard_panel"
  | "data_model_field_alias"
  | "field_alias_field"
  | "knowledge_dependency"
  | "panel_saved_search"
  | "saved_search_macro"
  | "search_field"
  | "search_lookup"
  | "search_sourcetype";

export interface KnowledgeGraphNode {
  id: string;
  kind: KnowledgeGraphNodeKind;
  label: string;
  app?: string;
  objectType?: KnowledgeObjectType;
}

export interface KnowledgeGraphEdgeProvenance {
  sourceObjectId: string;
  source: "dependsOn" | "metadata" | "metadata.search" | "metadata.fieldTrap" | "app";
  detail: string;
}

export interface KnowledgeGraphEdge {
  id: string;
  from: string;
  to: string;
  type: KnowledgeGraphEdgeType;
  provenance: KnowledgeGraphEdgeProvenance;
}

export interface KnowledgeGraphWarning {
  code: "MISSING_DEPENDENCY";
  objectId: string;
  dependencyId: string;
  message: string;
}

export interface KnowledgeGraph {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  warnings: KnowledgeGraphWarning[];
}

const fieldNodeId = (field: string): string => `field:${field}`;
const sourcetypeNodeId = (sourcetype: string): string => `sourcetype:${sourcetype}`;
const appNodeId = (app: string): string => `app:${app}`;

const unique = (values: string[]): string[] => [...new Set(values.filter((value) => value.length > 0))].sort();

const stringListFromMetadata = (metadata: Record<string, unknown>, key: string): string[] =>
  Array.isArray(metadata[key]) ? metadata[key].filter((value): value is string => typeof value === "string") : [];

const stringFromMetadata = (metadata: Record<string, unknown>, key: string): string | undefined =>
  typeof metadata[key] === "string" ? metadata[key] : undefined;

const objectEdgeType = (
  source: NormalizedKnowledgeObject,
  target: NormalizedKnowledgeObject
): KnowledgeGraphEdgeType => {
  if (source.type === "dashboards" && target.type === "panels") {
    return "dashboard_panel";
  }

  if (source.type === "panels" && target.type === "saved_searches") {
    return "panel_saved_search";
  }

  if (source.type === "saved_searches" && target.type === "macros") {
    return "saved_search_macro";
  }

  if (source.type === "saved_searches" && target.type === "lookups") {
    return "search_lookup";
  }

  if (source.type === "data_models" && target.type === "field_aliases") {
    return "data_model_field_alias";
  }

  return "knowledge_dependency";
};

const edgeId = (from: string, to: string, type: KnowledgeGraphEdgeType, detail: string): string =>
  `${from}->${to}:${type}:${detail}`;

const searchString = (object: NormalizedKnowledgeObject): string | undefined =>
  stringFromMetadata(object.metadata, "search");

const hasFieldEdges = (object: NormalizedKnowledgeObject): boolean =>
  ["data_models", "field_aliases", "lookups", "saved_searches"].includes(object.type);

const hasSourcetypeEdges = (object: NormalizedKnowledgeObject): boolean =>
  ["field_aliases", "saved_searches"].includes(object.type);

const fieldsFromSearch = (search: string): string[] => {
  const fields = new Set<string>();
  const assignmentPattern = /(?:^|\s)([A-Za-z_][A-Za-z0-9_:.]*)\s*=/g;
  let match = assignmentPattern.exec(search);

  while (match) {
    const field = match[1] ?? "";
    if (!["earliest", "index", "latest", "sourcetype"].includes(field)) {
      fields.add(field);
    }
    match = assignmentPattern.exec(search);
  }

  const byMatch = /\|\s*stats\b.*?\sby\s+([^|]+)/.exec(search);
  if (byMatch) {
    byMatch[1]
      ?.trim()
      .split(/\s+/)
      .filter(Boolean)
      .forEach((field) => fields.add(field));
  }

  return [...fields];
};

const sourcetypesFromSearch = (search: string): string[] => {
  const sourcetypes = new Set<string>();
  const sourcetypePattern = /(?:^|\s)sourcetype\s*=\s*([^\s|]+)/g;
  let match = sourcetypePattern.exec(search);

  while (match) {
    const value = match[1];
    if (value) {
      sourcetypes.add(value);
    }
    match = sourcetypePattern.exec(search);
  }

  return [...sourcetypes];
};

const objectFields = (object: NormalizedKnowledgeObject): Array<{ field: string; source: KnowledgeGraphEdgeProvenance["source"]; detail: string }> => {
  if (!hasFieldEdges(object)) {
    return [];
  }

  const fields: Array<{ field: string; source: KnowledgeGraphEdgeProvenance["source"]; detail: string }> = [
    ...stringListFromMetadata(object.metadata, "canonicalFields").map((field) => ({
      field,
      source: "metadata" as const,
      detail: "metadata.canonicalFields"
    })),
    ...stringListFromMetadata(object.metadata, "keyFields").map((field) => ({
      field,
      source: "metadata" as const,
      detail: "metadata.keyFields"
    })),
    ...stringListFromMetadata(object.metadata, "fields").map((field) => ({
      field,
      source: "metadata" as const,
      detail: "metadata.fields"
    }))
  ];

  const fieldTrap = object.metadata["fieldTrap"];
  if (fieldTrap && typeof fieldTrap === "object" && !Array.isArray(fieldTrap)) {
    const trap = fieldTrap as Record<string, unknown>;
    for (const key of ["staleField", "canonicalField"]) {
      if (typeof trap[key] === "string") {
        fields.push({ field: trap[key], source: "metadata.fieldTrap", detail: `metadata.fieldTrap.${key}` });
      }
    }
  }

  const search = searchString(object);
  if (search) {
    fields.push(
      ...fieldsFromSearch(search).map((field) => ({
        field,
        source: "metadata.search" as const,
        detail: "metadata.search"
      }))
    );
  }

  return unique(fields.map(({ field }) => field)).map((field) => {
    const first = fields.find((candidate) => candidate.field === field);
    return first ?? { field, source: "metadata", detail: "metadata" };
  });
};

const objectSourcetypes = (
  object: NormalizedKnowledgeObject
): Array<{ sourcetype: string; source: KnowledgeGraphEdgeProvenance["source"]; detail: string }> => {
  if (!hasSourcetypeEdges(object)) {
    return [];
  }

  const sourcetypes: Array<{ sourcetype: string; source: KnowledgeGraphEdgeProvenance["source"]; detail: string }> = [];
  const fieldTrap = object.metadata["fieldTrap"];

  if (fieldTrap && typeof fieldTrap === "object" && !Array.isArray(fieldTrap)) {
    const trap = fieldTrap as Record<string, unknown>;
    if (typeof trap["sourcetype"] === "string") {
      sourcetypes.push({
        sourcetype: trap["sourcetype"],
        source: "metadata.fieldTrap",
        detail: "metadata.fieldTrap.sourcetype"
      });
    }
  }

  const search = searchString(object);
  if (search) {
    sourcetypes.push(
      ...sourcetypesFromSearch(search).map((sourcetype) => ({
        sourcetype,
        source: "metadata.search" as const,
        detail: "metadata.search"
      }))
    );
  }

  return unique(sourcetypes.map(({ sourcetype }) => sourcetype)).map((sourcetype) => {
    const first = sourcetypes.find((candidate) => candidate.sourcetype === sourcetype);
    return first ?? { sourcetype, source: "metadata", detail: "metadata" };
  });
};

export const buildKnowledgeGraph = (objects: NormalizedKnowledgeObject[]): KnowledgeGraph => {
  const nodesById = new Map<string, KnowledgeGraphNode>();
  const edgesById = new Map<string, KnowledgeGraphEdge>();
  const warnings: KnowledgeGraphWarning[] = [];
  const objectsById = new Map(objects.map((object) => [object.id, object]));

  const addNode = (node: KnowledgeGraphNode): void => {
    nodesById.set(node.id, node);
  };
  const addEdge = (edge: Omit<KnowledgeGraphEdge, "id">): void => {
    edgesById.set(edgeId(edge.from, edge.to, edge.type, edge.provenance.detail), {
      ...edge,
      id: edgeId(edge.from, edge.to, edge.type, edge.provenance.detail)
    });
  };

  for (const object of objects) {
    addNode({
      id: object.id,
      kind: "knowledge_object",
      label: object.name,
      app: object.app,
      objectType: object.type
    });
    addNode({ id: appNodeId(object.app), kind: "app_context", label: object.app });
    addEdge({
      from: object.id,
      to: appNodeId(object.app),
      type: "app_context",
      provenance: { sourceObjectId: object.id, source: "app", detail: object.app }
    });
  }

  for (const object of objects) {
    for (const dependencyId of object.dependsOn) {
      const target = objectsById.get(dependencyId);

      if (!target) {
        warnings.push({
          code: "MISSING_DEPENDENCY",
          objectId: object.id,
          dependencyId,
          message: `${object.id} references missing knowledge object ${dependencyId}.`
        });
        continue;
      }

      addEdge({
        from: object.id,
        to: target.id,
        type: objectEdgeType(object, target),
        provenance: { sourceObjectId: object.id, source: "dependsOn", detail: dependencyId }
      });
    }

    for (const { field, source, detail } of objectFields(object)) {
      addNode({ id: fieldNodeId(field), kind: "field", label: field });
      addEdge({
        from: object.id,
        to: fieldNodeId(field),
        type: object.type === "field_aliases" ? "field_alias_field" : "search_field",
        provenance: { sourceObjectId: object.id, source, detail }
      });
    }

    for (const { sourcetype, source, detail } of objectSourcetypes(object)) {
      addNode({ id: sourcetypeNodeId(sourcetype), kind: "sourcetype", label: sourcetype });
      addEdge({
        from: object.id,
        to: sourcetypeNodeId(sourcetype),
        type: "search_sourcetype",
        provenance: { sourceObjectId: object.id, source, detail }
      });
    }
  }

  return {
    nodes: [...nodesById.values()].sort((left, right) => left.id.localeCompare(right.id)),
    edges: [...edgesById.values()].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)),
    warnings: warnings.sort((left, right) => `${left.objectId}:${left.dependencyId}`.localeCompare(`${right.objectId}:${right.dependencyId}`))
  };
};

export const buildKnowledgeGraphFromRawObjects = (
  objects: Parameters<typeof normalizeKnowledgeObjects>[0]
): KnowledgeGraph => buildKnowledgeGraph(normalizeKnowledgeObjects(objects));

export const explainDependencyPath = (
  graph: KnowledgeGraph,
  fromNodeId: string,
  toNodeId: string
): KnowledgeGraphEdge[] => {
  const edgesBySource = new Map<string, KnowledgeGraphEdge[]>();
  for (const edge of graph.edges) {
    edgesBySource.set(edge.from, [...(edgesBySource.get(edge.from) ?? []), edge]);
  }

  const queue: Array<{ nodeId: string; path: KnowledgeGraphEdge[] }> = [{ nodeId: fromNodeId, path: [] }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const next = queue.shift();
    if (!next || visited.has(next.nodeId)) {
      continue;
    }

    if (next.nodeId === toNodeId) {
      return next.path;
    }

    visited.add(next.nodeId);
    for (const edge of edgesBySource.get(next.nodeId) ?? []) {
      queue.push({ nodeId: edge.to, path: [...next.path, edge] });
    }
  }

  return [];
};
