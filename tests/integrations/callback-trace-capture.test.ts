import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createSplunkReadyCallbackTraceCapture } from "../../src/integrations/callback-trace-capture.js";
import { readinessReceiptSchema, traceEventSchema } from "../../src/schemas/core.js";
import { runExternalTraceCertificationWorkflow } from "../../src/workflows/external-certification.js";

describe("SplunkReady callback trace capture", () => {
  it("maps framework callback run IDs to schema-valid parent trace events", async () => {
    const capture = createSplunkReadyCallbackTraceCapture({
      missionId: "mission-security-lateral-movement-readiness",
      timestamp: "2026-06-01T06:06:00.000Z"
    });

    const knowledgeCallId = capture.onToolStart({
      runId: "lc-run-knowledge-001",
      toolName: "splunk_get_knowledge_objects",
      toolInput: {
        types: ["saved_searches", "macros", "lookups"],
        query: "lateral movement",
        app: "SplunkEnterpriseSecuritySuite"
      }
    });

    capture.onToolEnd({
      runId: "lc-run-knowledge-001",
      outputSummary:
        "Found validated saved search ES - Lateral Movement Auth Chain and supporting macro and lookup in SplunkEnterpriseSecuritySuite.",
      resultCount: 3,
      evidenceRefs: ["saved-search-lateral-movement", "macro-security-content-ctime", "lookup-asset-lookup"]
    });

    const searchCallId = capture.onToolStart({
      runId: "lc-run-search-001",
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

    capture.onToolEnd({
      runId: "lc-run-search-001",
      outputSummary: "Saved search returned three authentication chain events: evt-102, evt-118, and evt-141.",
      queryRef: "saved-search-lateral-movement",
      timeWindow: { earliest: "-24h", latest: "now" },
      resultCount: 3,
      evidenceRefs: ["evt-102", "evt-118", "evt-141"]
    });

    capture.onFinalAnswer({
      parentRunId: "lc-run-search-001",
      outputSummary:
        "Evidence supports suspicious lateral movement from win-finance-07 through admin-login-02 to dc-01 and finance-sql-03. The conclusion cites saved-search-lateral-movement, result count 3, and evidence rows evt-102, evt-118, and evt-141.",
      timeWindow: { earliest: "-24h", latest: "now" },
      resultCount: 3,
      evidenceRefs: ["evt-102", "evt-118", "evt-141"]
    });

    const trace = traceEventSchema.array().parse(capture.events());

    expect(trace.map((event) => event.parentId ?? null)).toEqual([
      null,
      knowledgeCallId,
      null,
      searchCallId,
      searchCallId
    ]);

    const payload = capture.externalTracePayload({
      requirePass: true,
      agentName: "LangChain Callback Agent",
      agentVersion: "run-id-capture-test"
    });
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-callback-capture-"));

    await runExternalTraceCertificationWorkflow({ outDir, payload });

    const receipt = readinessReceiptSchema.parse(
      JSON.parse(await readFile(join(outDir, "receipt-external-001.json"), "utf8"))
    );

    expect(receipt.agent).toEqual({ name: "LangChain Callback Agent", version: "run-id-capture-test" });
    expect(receipt.verdict).toBe("READY");
    expect(receipt.score).toBe(100);
  });

  it("rejects callback end events with no matching open tool run", () => {
    const capture = createSplunkReadyCallbackTraceCapture({
      missionId: "mission-security-lateral-movement-readiness",
      timestamp: "2026-06-01T06:06:00.000Z"
    });

    expect(() =>
      capture.onToolEnd({
        runId: "missing-run",
        outputSummary: "No matching tool start event.",
        resultCount: 0
      })
    ).toThrow("missing-run has no open SplunkReady tool call");

    capture.onToolStart({
      runId: "duplicate-end-run",
      toolName: "splunk_run_saved_search",
      toolInput: { name: "ES - Lateral Movement Auth Chain" }
    });
    capture.onToolEnd({
      runId: "duplicate-end-run",
      outputSummary: "Saved search returned rows.",
      queryRef: "saved-search-lateral-movement",
      resultCount: 3,
      evidenceRefs: ["evt-102", "evt-118", "evt-141"]
    });

    expect(() =>
      capture.onToolError({
        runId: "duplicate-end-run",
        error: { message: "late duplicate error" }
      })
    ).toThrow("duplicate-end-run has no open SplunkReady tool call");
  });
});
