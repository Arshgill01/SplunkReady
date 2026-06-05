import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createSplunkReadyTraceBridge } from "../../src/integrations/agent-trace-bridge.js";
import { readinessReceiptSchema, traceEventSchema } from "../../src/schemas/core.js";
import {
  parseExternalTraceCertificationPayload,
  runExternalTraceCertificationWorkflow
} from "../../src/workflows/external-certification.js";

describe("SplunkReady agent trace bridge", () => {
  it("builds schema-valid external trace payloads from framework callback events", async () => {
    const bridge = createSplunkReadyTraceBridge({
      missionId: "mission-security-lateral-movement-readiness",
      timestamp: "2026-06-01T06:05:10.000Z"
    });

    const knowledgeCallId = bridge.recordToolCall({
      toolName: "splunk_get_knowledge_objects",
      toolInput: {
        types: ["saved_searches", "macros", "lookups"],
        query: "lateral movement",
        app: "SplunkEnterpriseSecuritySuite"
      }
    });

    bridge.recordToolResult({
      parentId: knowledgeCallId,
      toolName: "splunk_get_knowledge_objects",
      outputSummary:
        "Found validated saved search ES - Lateral Movement Auth Chain and supporting macro and lookup in SplunkEnterpriseSecuritySuite.",
      resultCount: 3,
      evidenceRefs: ["saved-search-lateral-movement", "macro-security-content-ctime", "lookup-asset-lookup"]
    });

    const savedSearchCallId = bridge.recordToolCall({
      toolName: "splunk_run_saved_search",
      toolInput: {
        name: "ES - Lateral Movement Auth Chain",
        app: "SplunkEnterpriseSecuritySuite",
        tokens: {
          host: "win-finance-07",
          earliest: "-24h",
          latest: "now"
        }
      },
      timeWindow: { earliest: "-24h", latest: "now" }
    });

    bridge.recordToolResult({
      parentId: savedSearchCallId,
      toolName: "splunk_run_saved_search",
      outputSummary: "Saved search returned three authentication chain events: evt-102, evt-118, and evt-141.",
      queryRef: "saved-search-lateral-movement",
      timeWindow: { earliest: "-24h", latest: "now" },
      resultCount: 3,
      evidenceRefs: ["evt-102", "evt-118", "evt-141"]
    });

    bridge.recordFinalAnswer({
      outputSummary:
        "Evidence supports suspicious lateral movement from win-finance-07 through admin-login-02 to dc-01 and finance-sql-03. The conclusion cites saved-search-lateral-movement, result count 3, and evidence rows evt-102, evt-118, and evt-141.",
      timeWindow: { earliest: "-24h", latest: "now" },
      resultCount: 3,
      evidenceRefs: ["evt-102", "evt-118", "evt-141"]
    });

    const payload = bridge.externalTracePayload({
      requirePass: true,
      agentName: "LangChain Security Agent",
      agentVersion: "callback-bridge-test"
    });

    const parsedPayload = parseExternalTraceCertificationPayload(payload);
    expect(parsedPayload).toEqual(payload);
    expect(traceEventSchema.array().parse(payload.trace).map((event) => event.id)).toEqual([
      "mission-security-lateral-movement-readiness-trace-001",
      "mission-security-lateral-movement-readiness-trace-002",
      "mission-security-lateral-movement-readiness-trace-003",
      "mission-security-lateral-movement-readiness-trace-004",
      "mission-security-lateral-movement-readiness-trace-005"
    ]);

    const outDir = await mkdtemp(join(tmpdir(), "splunkready-bridge-certification-"));
    await runExternalTraceCertificationWorkflow({ outDir, payload });

    const receipt = readinessReceiptSchema.parse(
      JSON.parse(await readFile(join(outDir, "receipt-external-001.json"), "utf8"))
    );

    expect(receipt.agent).toEqual({ name: "LangChain Security Agent", version: "callback-bridge-test" });
    expect(receipt.verdict).toBe("READY");
    expect(receipt.score).toBe(100);
    expect(receipt.evidenceRefs).toEqual([
      "saved-search-lateral-movement",
      "macro-security-content-ctime",
      "lookup-asset-lookup",
      "evt-102",
      "evt-118",
      "evt-141"
    ]);
  });
});
