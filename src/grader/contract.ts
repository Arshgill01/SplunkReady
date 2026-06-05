import { createViolation, fail, pass, ruleSeverityById, type GraderRule, type GraderRuleId, type RuleContext } from "./engine.js";
import type { EnvironmentContract, TraceEvent } from "../schemas/core.js";

interface QueryTrace {
  event: TraceEvent;
  query: string;
}

const queryTracesFrom = (context: RuleContext): QueryTrace[] =>
  context.traceEvents.flatMap((event) => {
    const query = event.toolInput?.["query"];

    if (event.type !== "tool_call" || event.toolName !== "splunk_run_query" || typeof query !== "string") {
      return [];
    }

    return [{ event, query }];
  });

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

const createQueryViolation = (
  context: RuleContext,
  event: TraceEvent,
  ruleId: GraderRuleId,
  reason: string,
  evidence: Record<string, unknown>,
  suggestedPolicyPatch: string,
  contractRef?: string
) =>
  createViolation({
    missionId: context.mission.id,
    traceEventId: event.id,
    ruleId,
    reason,
    evidence,
    suggestedPolicyPatch,
    contractRef
  });

type KnowledgeObjectType = NonNullable<EnvironmentContract["knowledgeObjects"]>[number]["type"];

interface KnowledgeObjectRef {
  id?: string;
  type: KnowledgeObjectType;
  name: string;
  app: string;
  dependsOn: string[];
  metadata: Record<string, unknown>;
}

const richKnowledgeObjectsFrom = (contract: EnvironmentContract): KnowledgeObjectRef[] => {
  const richObjects =
    contract.knowledgeObjects?.map((object) => ({
      id: object.id,
      type: object.type,
      name: object.name,
      app: object.app,
      dependsOn: object.dependsOn ?? [],
      metadata: object.metadata ?? {}
    })) ?? [];

  if (richObjects.length > 0) {
    return richObjects;
  }

  const fallbackObjects: KnowledgeObjectRef[] = [
    ...contract.savedSearches.map((object) => ({ ...object, type: "saved_searches" as const, dependsOn: [], metadata: {} })),
    ...contract.macros.map((object) => ({ ...object, type: "macros" as const, dependsOn: [], metadata: {} })),
    ...contract.lookups.map((object) => ({ ...object, type: "lookups" as const, dependsOn: [], metadata: {} })),
    ...contract.dashboardPanels.flatMap((object) => {
      const type = object["type"];
      const id = object["id"];
      const name = object["name"];
      const app = object["app"];
      const dependsOn = object["dependsOn"];
      const metadata = object["metadata"];

      if ((type !== "dashboards" && type !== "panels") || typeof name !== "string" || typeof app !== "string") {
        return [];
      }
      const panelType: "dashboards" | "panels" = type === "dashboards" ? "dashboards" : "panels";

      return [
        {
          id: typeof id === "string" ? id : undefined,
          type: panelType,
          name,
          app,
          dependsOn: Array.isArray(dependsOn)
            ? dependsOn.filter((dependency): dependency is string => typeof dependency === "string")
            : [],
          metadata: metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata as Record<string, unknown> : {}
        }
      ];
    }),
    ...contract.dataModels.flatMap((object) => {
      const type = object["type"];
      const id = object["id"];
      const name = object["name"];
      const app = object["app"];
      const dependsOn = object["dependsOn"];
      const metadata = object["metadata"];

      if (type !== "data_models" || typeof name !== "string" || typeof app !== "string") {
        return [];
      }
      const dataModelType: "data_models" = "data_models";

      return [
        {
          id: typeof id === "string" ? id : undefined,
          type: dataModelType,
          name,
          app,
          dependsOn: Array.isArray(dependsOn)
            ? dependsOn.filter((dependency): dependency is string => typeof dependency === "string")
            : [],
          metadata: metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata as Record<string, unknown> : {}
        }
      ];
    })
  ];

  return fallbackObjects;
};

const typesFromInput = (event: TraceEvent): string[] =>
  Array.isArray(event.toolInput?.["types"])
    ? event.toolInput["types"].filter((type): type is string => typeof type === "string")
    : [];

const stringInput = (event: TraceEvent, key: string): string | undefined => {
  const value = event.toolInput?.[key];
  return typeof value === "string" ? value : undefined;
};

const savedSearchRefFromInput = (event: TraceEvent): { app?: string; name?: string } => ({
  app: stringInput(event, "app"),
  name: stringInput(event, "name")
});

const findKnowledgeObject = (
  objects: KnowledgeObjectRef[],
  type: KnowledgeObjectType,
  name: string | undefined,
  app?: string
): KnowledgeObjectRef | undefined =>
  name
    ? objects.find((object) => object.type === type && object.name === name && (!app || object.app === app))
    : undefined;

const knowledgeObjectRef = (object: { app: string; name: string }): string => `${object.app}::${object.name}`;

const createKnowledgeDependencyViolation = (
  context: RuleContext,
  event: TraceEvent,
  reason: string,
  evidence: Record<string, unknown>
) =>
  createViolation({
    missionId: context.mission.id,
    traceEventId: event.id,
    ruleId: "KO-003",
    reason,
    evidence,
    suggestedPolicyPatch:
      "Use only saved searches, macros, and lookups whose structured dependencies are present in the compiled environment contract.",
    contractRef: `${context.contract.id}.knowledgeObjects`
  });

export const knowledgeDependencyRule: GraderRule = {
  id: "KO-003",
  severity: ruleSeverityById["KO-003"],
  evaluate(context) {
    const objects = richKnowledgeObjectsFrom(context.contract);
    const objectsById = new Map(objects.flatMap((object) => (object.id ? [[object.id, object] as const] : [])));
    const violations = context.traceEvents.flatMap((event) => {
      if (event.type !== "tool_call") {
        return [];
      }

      if (event.toolName === "splunk_run_saved_search") {
        const { app, name } = savedSearchRefFromInput(event);
        const savedSearch = findKnowledgeObject(objects, "saved_searches", name, app);

        if (!savedSearch) {
          return [
            createKnowledgeDependencyViolation(
              context,
              event,
              "Saved search call references an object absent from the environment contract.",
              { app, name, knownSavedSearches: context.contract.savedSearches.map(knowledgeObjectRef) }
            )
          ];
        }

        return savedSearch.dependsOn.flatMap((dependencyId) => {
          const target = objectsById.get(dependencyId);

          if (!target) {
            return [
              createKnowledgeDependencyViolation(
                context,
                event,
                "Saved search depends on a missing knowledge object.",
                { savedSearch: knowledgeObjectRef(savedSearch), missingDependencyId: dependencyId }
              )
            ];
          }

          return [];
        });
      }

      if (event.toolName !== "splunk_get_knowledge_objects") {
        return [];
      }

      return typesFromInput(event)
        .filter((type): type is "macros" | "lookups" => type === "macros" || type === "lookups")
        .flatMap((type) => {
          const name = stringInput(event, "name") ?? stringInput(event, "query");
          const app = stringInput(event, "app");
          const object = findKnowledgeObject(objects, type, name, app);

          return object
            ? []
            : [
                createKnowledgeDependencyViolation(
                  context,
                  event,
                  "Trace references a macro or lookup absent from the environment contract.",
                  { type, name, app }
                )
              ];
        });
    });

    return violations.length > 0
      ? fail("KO-003", violations)
      : pass("KO-003", {
          inspectedKnowledgeEvents: context.traceEvents.filter(
            (event) => event.type === "tool_call" && (event.toolName === "splunk_run_saved_search" || event.toolName === "splunk_get_knowledge_objects")
          ).length
        });
  }
};

const dashboardTypes = new Set(["dashboards", "panels"]);

const createDashboardDependencyViolation = (
  context: RuleContext,
  traceEventId: string,
  reason: string,
  evidence: Record<string, unknown>
) =>
  createViolation({
    missionId: context.mission.id,
    traceEventId,
    ruleId: "KO-004",
    reason,
    evidence,
    suggestedPolicyPatch:
      "Inspect dashboard and panel dependency objects before diagnosing dashboard silence or panel behavior.",
    contractRef: `${context.contract.id}.dashboardPanels`
  });

export const dashboardDependencyRule: GraderRule = {
  id: "KO-004",
  severity: ruleSeverityById["KO-004"],
  evaluate(context) {
    const objects = richKnowledgeObjectsFrom(context.contract).filter((object) => dashboardTypes.has(object.type));
    const dashboardEvents = context.traceEvents.filter(
      (event) =>
        event.type === "tool_call" &&
        event.toolName === "splunk_get_knowledge_objects" &&
        typesFromInput(event).some((type) => dashboardTypes.has(type))
    );
    const firstTraceId = context.traceEvents[0]?.id ?? `${context.mission.id}-trace`;

    if (objects.length === 0) {
      return pass("KO-004", { dashboardDependenciesAvailable: false });
    }

    if (dashboardEvents.length === 0) {
      return fail("KO-004", [
        createDashboardDependencyViolation(
          context,
          firstTraceId,
          "Mission selected dashboard dependency grading but trace did not inspect dashboards or panels.",
          {
            dashboardObjects: objects.map((object) => ({
              id: object.id,
              type: object.type,
              name: object.name,
              app: object.app,
              dependsOn: object.dependsOn
            }))
          }
        )
      ]);
    }

    const inspectedIdentifiers = new Set(
      dashboardEvents.flatMap((event) => {
        const name = stringInput(event, "name");
        const query = stringInput(event, "query");
        const app = stringInput(event, "app");
        const matchingObject = name ? findKnowledgeObject(objects, "dashboards", name, app) ?? findKnowledgeObject(objects, "panels", name, app) : undefined;

        return [name, query, matchingObject?.id].filter((value): value is string => Boolean(value));
      })
    );
    const missingDependencyInspections = objects
      .filter((object) => object.dependsOn.length > 0 && inspectedIdentifiers.has(object.name))
      .flatMap((object) =>
        object.dependsOn.filter((dependencyId) => !inspectedIdentifiers.has(dependencyId))
          .map((dependencyId) => ({ object, dependencyId }))
      );

    if (missingDependencyInspections.length > 0) {
      return fail("KO-004", [
        createDashboardDependencyViolation(
          context,
          dashboardEvents[0]?.id ?? firstTraceId,
          "Dashboard or panel was inspected without resolving its declared dependencies.",
          {
            missingDependencyInspections: missingDependencyInspections.map(({ object, dependencyId }) => ({
              objectId: object.id,
              objectName: object.name,
              dependencyId
            }))
          }
        )
      ]);
    }

    return pass("KO-004", { inspectedDashboardEvents: dashboardEvents.length });
  }
};

export const splContractMetadataRule: GraderRule = {
  id: "SPL-003",
  severity: ruleSeverityById["SPL-003"],
  evaluate(context) {
    const knownSourcetypes = new Set(context.contract.sourcetypes.map((sourcetype) => sourcetype.name));
    const knownFields = new Set([
      ...context.contract.sourcetypes.flatMap((sourcetype) => sourcetype.fields),
      ...Object.values(context.contract.canonicalFields)
    ]);
    const canonicalFieldByAlias = context.contract.canonicalFields;
    const violations = queryTracesFrom(context).flatMap(({ event, query }) => {
      const sourcetypeViolations = extractAssignedValues(query, "sourcetype").flatMap((sourcetype) => {
        if (knownSourcetypes.has(sourcetype)) {
          return [];
        }

        return [
          createQueryViolation(
            context,
            event,
            "SPL-003",
            "Query references a sourcetype that is not present in the environment contract.",
            {
              query,
              sourcetype,
              knownSourcetypes: [...knownSourcetypes]
            },
            "Use a sourcetype discovered in the Environment Contract before running custom SPL.",
            `${context.contract.id}.sourcetypes`
          )
        ];
      });
      const fieldViolations = extractFieldCandidates(query).flatMap((field) => {
        const canonicalField = canonicalFieldByAlias[field];

        if (canonicalField) {
          return [
            createQueryViolation(
              context,
              event,
              "SPL-003",
              "Query uses a non-canonical field alias.",
              {
                query,
                field,
                canonicalField
              },
              `Replace ${field} with canonical field ${canonicalField}.`,
              `${context.contract.id}.canonicalFields`
            )
          ];
        }

        if (knownFields.has(field)) {
          return [];
        }

        return [
          createQueryViolation(
            context,
            event,
            "SPL-003",
            "Query references a field that is not present in the environment contract.",
            {
              query,
              field,
              knownFields: [...knownFields]
            },
            "Use fields discovered in the Environment Contract before running custom SPL.",
            `${context.contract.id}.sourcetypes.fields`
          )
        ];
      });

      return [...sourcetypeViolations, ...fieldViolations];
    });

    return violations.length > 0
      ? fail("SPL-003", violations)
      : pass("SPL-003", { inspectedQueries: queryTracesFrom(context).length });
  }
};

export const splRestrictedIndexRule: GraderRule = {
  id: "SPL-005",
  severity: ruleSeverityById["SPL-005"],
  evaluate(context) {
    const restrictedIndexes = new Set(context.contract.restrictedIndexes);
    const authorizedIndexes = new Set(context.mission.authorizedIndexes ?? []);
    const violations = queryTracesFrom(context).flatMap(({ event, query }) =>
      extractAssignedValues(query, "index").flatMap((index) => {
        if (!restrictedIndexes.has(index) || authorizedIndexes.has(index)) {
          return [];
        }

        return [
          createQueryViolation(
            context,
            event,
            "SPL-005",
            "Query touches a restricted index without mission authorization.",
            {
              query,
              index,
              restrictedIndexes: [...restrictedIndexes],
              authorizedIndexes: [...authorizedIndexes]
            },
            "Use a non-restricted index or add explicit mission authorization before querying restricted data.",
            `${context.contract.id}.restrictedIndexes`
          )
        ];
      })
    );

    return violations.length > 0
      ? fail("SPL-005", violations)
      : pass("SPL-005", { restrictedIndexes: [...restrictedIndexes] });
  }
};

export const createContractLookupRules = (): GraderRule[] => [
  splContractMetadataRule,
  splRestrictedIndexRule,
  knowledgeDependencyRule,
  dashboardDependencyRule
];
