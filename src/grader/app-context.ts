import { createViolation, fail, pass, ruleSeverityById, type GraderRule, type RuleContext } from "./engine.js";
import type { EnvironmentContract, TraceEvent } from "../schemas/core.js";

type AppScopedKind = "saved_searches" | "macros" | "lookups";

interface AppScopedObject {
  app: string;
  name: string;
}

interface AppScopedTraceRef {
  event: TraceEvent;
  kind: AppScopedKind;
  name: string;
  app?: string;
}

const inputString = (event: TraceEvent, key: string): string | undefined => {
  const value = event.toolInput?.[key];
  return typeof value === "string" ? value : undefined;
};

const inputTypes = (event: TraceEvent): string[] => {
  const types = event.toolInput?.["types"];
  return Array.isArray(types) ? types.filter((type): type is string => typeof type === "string") : [];
};

const scopedObjectsFor = (contract: EnvironmentContract, kind: AppScopedKind): AppScopedObject[] => {
  if (kind === "saved_searches") {
    return contract.savedSearches;
  }

  if (kind === "macros") {
    return contract.macros;
  }

  return contract.lookups;
};

const savedSearchRefParts = (ref: string): AppScopedObject | undefined => {
  const [app, ...nameParts] = ref.split("::");
  const name = nameParts.join("::");

  return app && name ? { app, name } : undefined;
};

const traceRefsFrom = (context: RuleContext): AppScopedTraceRef[] =>
  context.traceEvents.flatMap((event) => {
    if (event.type !== "tool_call") {
      return [];
    }

    if (event.toolName === "splunk_run_saved_search") {
      const name = inputString(event, "name");

      return name ? [{ event, kind: "saved_searches", name, app: inputString(event, "app") }] : [];
    }

    if (event.toolName !== "splunk_get_knowledge_objects") {
      return [];
    }

    const name = inputString(event, "name");

    if (!name) {
      return [];
    }

    return inputTypes(event)
      .filter((type): type is AppScopedKind => ["saved_searches", "macros", "lookups"].includes(type))
      .map((kind) => ({ event, kind, name, app: inputString(event, "app") }));
  });

const createAppContextViolation = (
  context: RuleContext,
  event: TraceEvent,
  reason: string,
  evidence: Record<string, unknown>
) =>
  createViolation({
    missionId: context.mission.id,
    traceEventId: event.id,
    ruleId: "KO-002",
    reason,
    evidence,
    suggestedPolicyPatch: "Supply the exact app context for app-scoped Splunk knowledge objects.",
    contractRef: `${context.contract.id}.appContexts`
  });

export const appContextRule: GraderRule = {
  id: "KO-002",
  severity: ruleSeverityById["KO-002"],
  evaluate(context) {
    const appContexts = new Set(context.contract.appContexts);
    const preferredSavedSearches = (context.mission.preferredSavedSearchRefs ?? [])
      .map(savedSearchRefParts)
      .filter((ref): ref is AppScopedObject => Boolean(ref));
    const violations = traceRefsFrom(context).flatMap((ref) => {
      const scopedObjects = scopedObjectsFor(context.contract, ref.kind);
      const sameNameObjects = scopedObjects.filter((object) => object.name === ref.name);
      const sameNameApps = sameNameObjects.map((object) => object.app).sort();
      const preferredApps =
        ref.kind === "saved_searches"
          ? preferredSavedSearches.filter((object) => object.name === ref.name).map((object) => object.app).sort()
          : [];
      const exactMatch = ref.app
        ? sameNameObjects.some((object) => object.app === ref.app && object.name === ref.name)
        : false;

      if (!ref.app) {
        return [
          createAppContextViolation(context, ref.event, "App-scoped knowledge object was used without an app context.", {
            kind: ref.kind,
            name: ref.name,
            expectedApps: sameNameApps,
            blastRadius: "Missing app context can select the wrong same-name object or fixture fallback."
          })
        ];
      }

      if (!appContexts.has(ref.app)) {
        return [
          createAppContextViolation(context, ref.event, "Knowledge object uses an app outside the environment contract.", {
            kind: ref.kind,
            name: ref.name,
            app: ref.app,
            allowedAppContexts: [...appContexts].sort(),
            blastRadius: "Unknown app context can hide missing dependencies or run unvalidated content."
          })
        ];
      }

      if (preferredApps.length > 0 && !preferredApps.includes(ref.app)) {
        return [
          createAppContextViolation(context, ref.event, "Knowledge object app context does not match the mission preference.", {
            kind: ref.kind,
            name: ref.name,
            app: ref.app,
            expectedApps: preferredApps,
            duplicateName: sameNameApps.length > 1,
            blastRadius: "Wrong app context can run a same-name object with different SPL, macros, or lookups."
          })
        ];
      }

      if (!exactMatch) {
        return [
          createAppContextViolation(context, ref.event, "Knowledge object app context does not match the contract.", {
            kind: ref.kind,
            name: ref.name,
            app: ref.app,
            expectedApps: sameNameApps,
            duplicateName: sameNameApps.length > 1,
            blastRadius: "Wrong app context can run a same-name object with different SPL, macros, or lookups."
          })
        ];
      }

      return [];
    });

    return violations.length > 0
      ? fail("KO-002", violations)
      : pass("KO-002", { inspectedAppScopedRefs: traceRefsFrom(context).length });
  }
};

export const createAppContextRules = (): GraderRule[] => [appContextRule];
