import { z } from "zod";

import { missionSchema, type Mission } from "../schemas/core.js";

const safetyConstraintSchema = z
  .object({
    id: z.string().min(1),
    ruleId: z.enum(["SAF-001", "SAF-002", "SAF-003"]),
    description: z.string().min(1)
  })
  .strict();

const missionDslFieldsSchema = z
  .object({
    requiresSavedSearchDiscovery: z.boolean().optional(),
    safetyConstraints: z.array(safetyConstraintSchema).optional()
  })
  .strict();

export type MissionSafetyConstraint = z.infer<typeof safetyConstraintSchema>;

export interface MissionDefinition extends Mission {
  requiresSavedSearchDiscovery?: boolean;
  safetyConstraints?: MissionSafetyConstraint[];
}

export interface MissionDefinitionValidationSuccess {
  success: true;
  data: MissionDefinition;
}

export interface MissionDefinitionValidationFailure {
  success: false;
  issues: string[];
}

export type MissionDefinitionValidationResult =
  | MissionDefinitionValidationSuccess
  | MissionDefinitionValidationFailure;

const dslFieldNames = new Set(["requiresSavedSearchDiscovery", "safetyConstraints"]);

const missionInputFields = (input: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(input).filter(([key]) => !dslFieldNames.has(key)));

const sortedIssueMessages = (issues: string[]): string[] => [...new Set(issues)].sort();

const validateMissionInvariants = (mission: MissionDefinition): string[] => {
  const issues: string[] = [];

  if (mission.forbiddenPatterns.length > 0 && !mission.checks.includes("SPL-001")) {
    issues.push("missions with forbiddenPatterns must include SPL-001");
  }

  if (mission.checks.every((ruleId) => ruleId.startsWith("ANS-"))) {
    issues.push("mission checks must include deterministic trace/tool/evidence rules, not only answer rules");
  }

  if (mission.requiresSavedSearchDiscovery) {
    if (!mission.checks.includes("KO-001")) {
      issues.push("requiresSavedSearchDiscovery missions must include KO-001");
    }

    if (!mission.expectedTools.includes("splunk_get_knowledge_objects")) {
      issues.push("requiresSavedSearchDiscovery missions must expect splunk_get_knowledge_objects");
    }

    if ((mission.preferredSavedSearchRefs ?? []).length === 0) {
      issues.push("requiresSavedSearchDiscovery missions must declare preferredSavedSearchRefs");
    }
  }

  for (const safetyConstraint of mission.safetyConstraints ?? []) {
    if (!mission.checks.includes(safetyConstraint.ruleId)) {
      issues.push(`safety constraint ${safetyConstraint.id} must reference a rule in checks`);
    }
  }

  return sortedIssueMessages(issues);
};

export const validateMissionDefinition = (input: unknown): MissionDefinitionValidationResult => {
  const envelopeResult = z.record(z.unknown()).safeParse(input);
  if (!envelopeResult.success) {
    return { success: false, issues: envelopeResult.error.issues.map((issue) => issue.message) };
  }

  const dslFieldsResult = missionDslFieldsSchema.safeParse(
    Object.fromEntries(Object.entries(envelopeResult.data).filter(([key]) => dslFieldNames.has(key)))
  );
  const missionResult = missionSchema.safeParse(missionInputFields(envelopeResult.data));

  if (!missionResult.success || !dslFieldsResult.success) {
    return {
      success: false,
      issues: sortedIssueMessages([
        ...(missionResult.success ? [] : missionResult.error.issues.map((issue) => issue.message)),
        ...(dslFieldsResult.success ? [] : dslFieldsResult.error.issues.map((issue) => issue.message))
      ])
    };
  }

  const mission: MissionDefinition = {
    ...missionResult.data,
    ...dslFieldsResult.data
  };
  const invariantIssues = validateMissionInvariants(mission);

  return invariantIssues.length > 0
    ? { success: false, issues: invariantIssues }
    : { success: true, data: mission };
};

export const parseMissionDefinition = (input: unknown): MissionDefinition => {
  const result = validateMissionDefinition(input);
  if (!result.success) {
    throw new Error(`Invalid mission definition: ${result.issues.join("; ")}`);
  }

  return result.data;
};

export const exportMissionDefinition = (mission: MissionDefinition): string =>
  `${JSON.stringify(mission, null, 2)}\n`;
