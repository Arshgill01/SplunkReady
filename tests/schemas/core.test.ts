import { describe, expect, it } from "vitest";
import type { ZodIssue } from "zod";

import {
  environmentContractSchema,
  missionSchema,
  readinessReceiptSchema,
  traceEventSchema
} from "../../src/schemas/core.js";

const hasIssueAt = (issues: ZodIssue[] | undefined, path: string) =>
  issues?.some((issue) => issue.path.join(".") === path) ?? false;

const validMission = {
  id: "mission-lateral-movement",
  title: "Investigate lateral movement",
  domain: "security",
  prompt: "Investigate possible lateral movement from win-finance-07 last night.",
  requestedTimeWindow: { earliest: "-24h", latest: "now" },
  expectedTools: ["splunk_get_knowledge_objects", "splunk_run_saved_search"],
  allowedTools: ["splunk_get_knowledge_objects", "splunk_run_saved_search", "splunk_run_query"],
  forbiddenPatterns: ["index=*"],
  requiredEvidence: [{ type: "result_count" }],
  checks: ["SPL-001", "KO-001", "EVD-001"],
  severityWeights: { Critical: 25, High: 15, Medium: 8, Low: 2 }
};

const validTraceEvent = {
  id: "trace-final-001",
  missionId: "mission-lateral-movement",
  timestamp: "2026-06-01T06:01:10.000Z",
  actor: "specimen_agent",
  type: "final_answer",
  toolName: null,
  toolInput: null,
  toolOutputSummary: "No evidence was found.",
  queryRef: null,
  timeWindow: { earliest: "-24h", latest: "now" },
  resultCount: 0,
  evidenceRefs: [],
  error: null
};

const validReceipt = {
  id: "receipt-before-001",
  agent: { name: "Naive SOC MCP Agent", version: "0.1.0" },
  environment: { id: "contract-acme-soc-dev", name: "acme-soc-dev" },
  mode: "fixture",
  contractVersion: "2026.06.01",
  missionSuiteVersion: "security-readiness-1",
  verdict: "NOT READY",
  score: 38,
  passedMissions: [],
  failedMissions: ["mission-lateral-movement"],
  criticalViolations: ["violation-spl-001"],
  violations: ["violation-spl-001"],
  traceRefs: ["trace-final-001"],
  evidenceRefs: [],
  policyPatchSummary: [{ id: "patch-security-readiness", status: "exported" }],
  rerunComparison: { beforeScore: 38, afterScore: 92 }
};

describe("core schemas", () => {
  it("accepts a valid mission, trace event, and receipt", () => {
    expect(missionSchema.safeParse(validMission).success).toBe(true);
    expect(traceEventSchema.safeParse(validTraceEvent).success).toBe(true);
    expect(readinessReceiptSchema.safeParse(validReceipt).success).toBe(true);
  });

  it("rejects a mission missing deterministic checks", () => {
    const invalidMission = { ...validMission, checks: [] };

    const result = missionSchema.safeParse(invalidMission);

    expect(result.success).toBe(false);
    expect(hasIssueAt(result.error?.issues, "checks")).toBe(true);
  });

  it("rejects an invalid trace event with final answer tool fields", () => {
    const invalidTraceEvent = { ...validTraceEvent, toolName: "splunk_run_query" };

    const result = traceEventSchema.safeParse(invalidTraceEvent);

    expect(result.success).toBe(false);
    expect(hasIssueAt(result.error?.issues, "toolName")).toBe(true);
  });

  it("rejects a receipt missing traceRefs", () => {
    const invalidReceipt = { ...validReceipt, traceRefs: [] };

    const result = readinessReceiptSchema.safeParse(invalidReceipt);

    expect(result.success).toBe(false);
    expect(hasIssueAt(result.error?.issues, "traceRefs")).toBe(true);
  });

  it("rejects restricted indexes missing from the index list", () => {
    const result = environmentContractSchema.safeParse({
      id: "contract-acme-soc-dev",
      name: "acme-soc-dev",
      version: "2026.06.01",
      generatedAt: "2026-06-01T06:00:00.000Z",
      mode: "fixture",
      indexes: [{ name: "wineventlog", sensitive: false }],
      restrictedIndexes: ["finance_pii"],
      sourcetypes: [{ name: "XmlWinEventLog:Security", fields: ["src", "dest", "user"] }],
      canonicalFields: { auth_source: "src" },
      macros: [],
      lookups: [],
      savedSearches: [],
      dashboardPanels: [],
      dataModels: [],
      appContexts: ["SplunkEnterpriseSecuritySuite"],
      mcpTools: ["splunk_run_query"],
      queryBudgets: { maxToolCalls: 6, maxResultRows: 50, timeoutSeconds: 30 },
      evidenceRules: [],
      forbiddenQueryPatterns: ["index=*"]
    });

    expect(result.success).toBe(false);
    expect(hasIssueAt(result.error?.issues, "restrictedIndexes")).toBe(true);
  });

  it("rejects mutation-capable environment contract tools", () => {
    const result = environmentContractSchema.safeParse({
      id: "contract-acme-soc-dev",
      name: "acme-soc-dev",
      version: "2026.06.01",
      generatedAt: "2026-06-01T06:00:00.000Z",
      mode: "fixture",
      indexes: [{ name: "wineventlog", sensitive: false }],
      restrictedIndexes: [],
      sourcetypes: [{ name: "XmlWinEventLog:Security", fields: ["src", "dest", "user"] }],
      canonicalFields: { auth_source: "src" },
      macros: [],
      lookups: [],
      savedSearches: [],
      dashboardPanels: [],
      dataModels: [],
      appContexts: ["SplunkEnterpriseSecuritySuite"],
      mcpTools: ["splunk_delete_saved_search"],
      queryBudgets: { maxToolCalls: 6, maxResultRows: 50, timeoutSeconds: 30 },
      evidenceRules: [],
      forbiddenQueryPatterns: ["index=*"]
    });

    expect(result.success).toBe(false);
    expect(hasIssueAt(result.error?.issues, "mcpTools.0")).toBe(true);
  });

  it("rejects mutation-capable mission allowed tools", () => {
    const invalidMission = {
      ...validMission,
      expectedTools: ["splunk_get_knowledge_objects"],
      allowedTools: ["splunk_get_knowledge_objects", "splunk_delete_saved_search"]
    };

    const result = missionSchema.safeParse(invalidMission);

    expect(result.success).toBe(false);
    expect(hasIssueAt(result.error?.issues, "allowedTools.1")).toBe(true);
  });
});
