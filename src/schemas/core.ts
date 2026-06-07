import { z } from "zod";

export const modeSchema = z.enum(["fixture", "live"]);
export const severitySchema = z.enum(["Critical", "High", "Medium", "Low"]);

export const graderRuleIdSchema = z.enum([
  "SPL-001",
  "SPL-002",
  "SPL-003",
  "SPL-004",
  "SPL-005",
  "KO-001",
  "KO-002",
  "KO-003",
  "KO-004",
  "EVD-001",
  "EVD-002",
  "EVD-003",
  "EVD-004",
  "ANS-001",
  "ANS-002",
  "ANS-003",
  "SAF-001",
  "SAF-002",
  "SAF-003"
]);

export const readOnlySplunkToolNameSchema = z.enum([
  "splunk_get_info",
  "splunk_get_user_info",
  "splunk_get_indexes",
  "splunk_get_metadata",
  "splunk_get_knowledge_objects",
  "splunk_run_query",
  "splunk_run_saved_search",
  "saia_generate_spl",
  "saia_explain_spl",
  "saia_optimize_spl",
  "saia_ask_splunk_question"
]);

const idSchema = z.string().min(1);
const isoTimestampSchema = z.string().datetime();
const stringListSchema = z.array(z.string().min(1));
const sha256HexSchema = z.string().regex(/^[a-f0-9]{64}$/, "must be a lowercase SHA-256 hex digest");
const readOnlyToolListSchema = z.array(readOnlySplunkToolNameSchema).min(1);
const looseObjectSchema = z.record(z.unknown());

const nullableLooseObjectSchema = looseObjectSchema.nullable();
const nullableStringSchema = z.string().min(1).nullable();

export const environmentContractSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1),
    version: z.string().min(1),
    generatedAt: isoTimestampSchema,
    mode: modeSchema,
    indexes: z.array(z.object({ name: z.string().min(1), sensitive: z.boolean() }).strict()).min(1),
    restrictedIndexes: stringListSchema,
    sourcetypes: z.array(z.object({ name: z.string().min(1), fields: stringListSchema }).strict()),
    canonicalFields: z.record(z.string().min(1)),
    macros: z.array(z.object({ name: z.string().min(1), app: z.string().min(1) }).strict()),
    lookups: z.array(z.object({ name: z.string().min(1), app: z.string().min(1) }).strict()),
    savedSearches: z.array(z.object({ name: z.string().min(1), app: z.string().min(1) }).strict()),
    knowledgeObjects: z
      .array(
        z
          .object({
            id: idSchema,
            type: z.enum(["saved_searches", "macros", "lookups", "dashboards", "panels", "field_aliases", "data_models"]),
            name: z.string().min(1),
            app: z.string().min(1),
            dependsOn: stringListSchema.optional(),
            metadata: looseObjectSchema.optional()
          })
          .strict()
      )
      .optional(),
    dashboardPanels: z.array(looseObjectSchema),
    dataModels: z.array(looseObjectSchema),
    appContexts: stringListSchema,
    mcpTools: readOnlyToolListSchema,
    queryBudgets: z
      .object({
        maxToolCalls: z.number().int().positive(),
        maxResultRows: z.number().int().positive(),
        timeoutSeconds: z.number().int().positive()
      })
      .strict(),
    evidenceRules: z.array(looseObjectSchema),
    forbiddenQueryPatterns: stringListSchema,
    description: z.string().optional(),
    sourceRefs: stringListSchema.optional(),
    warnings: stringListSchema.optional()
  })
  .strict()
  .superRefine((contract, ctx) => {
    const indexNames = new Set(contract.indexes.map((index) => index.name));

    for (const restrictedIndex of contract.restrictedIndexes) {
      if (!indexNames.has(restrictedIndex)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["restrictedIndexes"],
          message: `restricted index ${restrictedIndex} is not declared in indexes`
        });
      }
    }
  });

export const missionSchema = z
  .object({
    id: idSchema,
    title: z.string().min(1),
    domain: z.string().min(1),
    prompt: z.string().min(1),
    requestedTimeWindow: z.object({ earliest: z.string().min(1), latest: z.string().min(1) }).strict(),
    expectedTools: readOnlyToolListSchema,
    allowedTools: readOnlyToolListSchema,
    forbiddenPatterns: stringListSchema,
    requiredEvidence: z.array(looseObjectSchema).min(1),
    checks: z.array(graderRuleIdSchema).min(1, "mission must include at least one deterministic check"),
    severityWeights: z.record(severitySchema, z.number().positive()),
    description: z.string().optional(),
    authorizedIndexes: stringListSchema.optional(),
    preferredSavedSearchRefs: stringListSchema.optional(),
    fixtures: stringListSchema.optional()
  })
  .strict()
  .superRefine((mission, ctx) => {
    const allowedTools = new Set(mission.allowedTools);

    for (const expectedTool of mission.expectedTools) {
      if (!allowedTools.has(expectedTool)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["expectedTools"],
          message: `expected tool ${expectedTool} is not listed in allowedTools`
        });
      }
    }
  });

export const traceEventSchema = z
  .object({
    id: idSchema,
    missionId: idSchema,
    timestamp: isoTimestampSchema,
    actor: z.enum(["specimen_agent", "splunk_adapter", "runner"]),
    type: z.enum(["tool_call", "tool_result", "final_answer", "error"]),
    toolName: nullableStringSchema,
    toolInput: nullableLooseObjectSchema,
    toolOutputSummary: z.string().nullable(),
    queryRef: nullableStringSchema,
    timeWindow: z.object({ earliest: z.string().min(1), latest: z.string().min(1) }).strict().nullable(),
    resultCount: z.number().int().nonnegative().nullable(),
    evidenceRefs: stringListSchema,
    error: nullableLooseObjectSchema,
    step: z.number().int().positive().optional(),
    parentId: idSchema.optional(),
    rawRef: z.string().optional(),
    metadata: looseObjectSchema.optional()
  })
  .strict()
  .superRefine((event, ctx) => {
    if (event.type === "final_answer") {
      const finalAnswerNullFields = ["toolName", "toolInput", "queryRef"] as const;

      for (const field of finalAnswerNullFields) {
        if (event[field] !== null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: `final_answer trace events must keep ${field} null`
          });
        }
      }
    }

    if (event.type === "tool_result" && !event.parentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parentId"],
        message: "tool_result trace events must reference the tool_call parentId"
      });
    }
  });

export const violationSchema = z
  .object({
    id: idSchema,
    missionId: idSchema,
    traceEventId: idSchema,
    ruleId: graderRuleIdSchema,
    severity: severitySchema,
    reason: z.string().min(1),
    evidence: looseObjectSchema,
    suggestedPolicyPatch: z.string().min(1),
    contractRef: z.string().optional(),
    evidenceRefs: stringListSchema.optional(),
    waiver: looseObjectSchema.optional()
  })
  .strict();

export const readinessReceiptSchema = z
  .object({
    id: idSchema,
    agent: z.object({ name: z.string().min(1), version: z.string().min(1) }).strict(),
    environment: z.object({ id: idSchema, name: z.string().min(1) }).strict(),
    mode: modeSchema,
    contractVersion: z.string().min(1),
    missionSuiteVersion: z.string().min(1),
    verdict: z.string().min(1),
    score: z.number().min(0).max(100),
    passedMissions: stringListSchema,
    failedMissions: stringListSchema,
    criticalViolations: stringListSchema,
    violations: stringListSchema,
    traceRefs: stringListSchema.min(1, "receipt must include traceRefs"),
    evidenceRefs: z.array(z.string().min(1)),
    policyPatchSummary: z.array(z.object({ id: idSchema, status: z.string().min(1) }).strict()),
    rerunComparison: looseObjectSchema,
    receiptHash: sha256HexSchema.optional(),
    previousReceiptHash: sha256HexSchema.nullable().optional(),
    operatorWaivers: z.array(looseObjectSchema).optional(),
    generatedBy: z.string().optional(),
    notes: z.string().optional()
  })
  .strict()
  .superRefine((receipt, ctx) => {
    const violationIds = new Set(receipt.violations);

    for (const criticalViolation of receipt.criticalViolations) {
      if (!violationIds.has(criticalViolation)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["criticalViolations"],
          message: `critical violation ${criticalViolation} is missing from violations`
        });
      }
    }
  });

export const policyPatchSchema = z
  .object({
    id: idSchema,
    createdAt: isoTimestampSchema,
    sourceReceiptId: idSchema,
    targetAgent: z.object({ name: z.string().min(1), version: z.string().min(1) }).strict(),
    rules: z.array(z.object({ id: idSchema, text: z.string().min(1) }).strict()).min(1),
    violationRefs: stringListSchema.min(1),
    splAssistance: z
      .array(
        z
          .object({
            violationRef: idSchema,
            ruleId: graderRuleIdSchema,
            query: z.string().min(1),
            explanation: z.string().min(1),
            optimizedQuery: z.string().min(1),
            rationale: z.string().optional(),
            warnings: stringListSchema.optional()
          })
          .strict()
      )
      .optional(),
    status: z.enum(["draft", "exported", "accepted"]),
    summary: z.string().optional(),
    diff: z.string().optional(),
    reviewer: looseObjectSchema.optional()
  })
  .strict();

export const readinessProfileSchema = z
  .object({
    id: idSchema,
    generatedAt: isoTimestampSchema,
    compiler: z.literal("Agent Readiness Compiler"),
    contractRef: z
      .object({
        id: idSchema,
        name: z.string().min(1),
        version: z.string().min(1),
        mode: modeSchema
      })
      .strict(),
    missionRefs: stringListSchema,
    sourceRefs: stringListSchema,
    deploymentSignals: z
      .object({
        mode: modeSchema,
        indexCount: z.number().int().nonnegative(),
        restrictedIndexCount: z.number().int().nonnegative(),
        sourcetypeCount: z.number().int().nonnegative(),
        savedSearchCount: z.number().int().nonnegative(),
        appContextCount: z.number().int().nonnegative(),
        dataModelCount: z.number().int().nonnegative(),
        allowedTools: readOnlyToolListSchema,
        queryBudgets: z
          .object({
            maxToolCalls: z.number().int().positive(),
            maxResultRows: z.number().int().positive(),
            timeoutSeconds: z.number().int().positive()
          })
          .strict()
      })
      .strict(),
    ruleBindings: z
      .array(
        z
          .object({
            ruleId: graderRuleIdSchema,
            severity: severitySchema,
            source: z.enum(["splunk_contract", "mission", "rule_catalog"]),
            contractRefs: stringListSchema,
            missionRefs: stringListSchema,
            evidence: z
              .array(
                z
                  .object({
                    ref: z.string().min(1),
                    value: z.unknown()
                  })
                  .strict()
              )
              .min(1),
            rationale: z.string().min(1)
          })
          .strict()
      )
      .min(1),
    llmUsage: z
      .object({
        passFailAuthority: z.literal("deterministic-rule-engine"),
        allowedRoles: stringListSchema,
        prohibitedRoles: stringListSchema
      })
      .strict(),
    warnings: stringListSchema.optional()
  })
  .strict()
  .superRefine((profile, ctx) => {
    const declaredMissionRefs = new Set(profile.missionRefs);

    for (const [index, binding] of profile.ruleBindings.entries()) {
      for (const missionRef of binding.missionRefs) {
        if (!declaredMissionRefs.has(missionRef)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["ruleBindings", index, "missionRefs"],
            message: `rule binding references undeclared mission ${missionRef}`
          });
        }
      }
    }
  });

export type EnvironmentContract = z.infer<typeof environmentContractSchema>;
export type Mission = z.infer<typeof missionSchema>;
export type TraceEvent = z.infer<typeof traceEventSchema>;
export type Violation = z.infer<typeof violationSchema>;
export type ReadinessReceipt = z.infer<typeof readinessReceiptSchema>;
export type PolicyPatch = z.infer<typeof policyPatchSchema>;
export type ReadinessProfile = z.infer<typeof readinessProfileSchema>;
export type ReadOnlySplunkToolName = z.infer<typeof readOnlySplunkToolNameSchema>;
