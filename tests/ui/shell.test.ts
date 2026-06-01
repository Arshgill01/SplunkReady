import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadUiArtifacts, renderUiShell, writeUiShell, type UiArtifactPaths } from "../../src/ui/shell.js";
import type { ReadinessReceipt, TraceEvent, Violation } from "../../src/schemas/core.js";

const artifactPaths = (outDir = "/tmp/splunkready-ui"): UiArtifactPaths => ({
  receipt: join(outDir, "receipt-after-001.json"),
  trace: join(outDir, "trace-after.json"),
  violations: join(outDir, "violations-after.json")
});

const receipt = (overrides: Partial<ReadinessReceipt> = {}): ReadinessReceipt => ({
  id: "receipt-after-001",
  agent: { name: "Naive SOC MCP Agent", version: "0.1.0" },
  environment: { id: "contract-acme-soc-dev", name: "ACME SOC Dev" },
  mode: "fixture",
  contractVersion: "2026.06.01",
  missionSuiteVersion: "security-readiness-1",
  verdict: "READY",
  score: 100,
  passedMissions: ["mission-security-lateral-movement-readiness"],
  failedMissions: [],
  criticalViolations: [],
  violations: [],
  traceRefs: ["trace-saved-search-call", "trace-saved-search-result", "trace-final-answer"],
  evidenceRefs: ["evt-auth-001"],
  policyPatchSummary: [],
  rerunComparison: {
    beforeScore: 60,
    afterScore: 100,
    beforeVerdict: "NOT READY",
    afterVerdict: "READY",
    resolvedViolations: ["violation-evd-001"]
  },
  generatedBy: "Agent Readiness Compiler",
  ...overrides
});

const traceEvent = (id: string): TraceEvent => ({
  id,
  missionId: "mission-security-lateral-movement-readiness",
  timestamp: "2026-06-01T06:45:00.000Z",
  actor: "specimen_agent",
  type: "tool_call",
  toolName: "splunk_run_saved_search",
  toolInput: { name: "ES - Lateral Movement Auth Chain" },
  toolOutputSummary: null,
  queryRef: null,
  timeWindow: { earliest: "-24h", latest: "now" },
  resultCount: null,
  evidenceRefs: ["evt-auth-001"],
  error: null
});

const violation = (): Violation => ({
  id: "violation-evd-001",
  missionId: "mission-security-lateral-movement-readiness",
  traceEventId: "trace-final-answer",
  ruleId: "EVD-001",
  severity: "Critical",
  reason: "Final answer lacks saved-search provenance.",
  evidence: { finalAnswerId: "trace-final-answer" },
  suggestedPolicyPatch: "Carry saved-search provenance into the final answer.",
  evidenceRefs: ["evt-auth-001"]
});

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

describe("SplunkReady UI shell", () => {
  it("renders an operational first screen from receipt and provenance artifacts", () => {
    const html = renderUiShell({
      phase: "after",
      outDir: "/tmp/splunkready-ui",
      receipt: receipt(),
      traceEvents: [traceEvent("trace-saved-search-call")],
      violations: [],
      paths: artifactPaths()
    });

    expect(html).toContain("SplunkReady");
    expect(html).toContain("Certify AI agents before they touch production Splunk.");
    expect(html).toContain("fixture mode / after run");
    expect(html).toContain("Current verdict");
    expect(html).toContain("READY");
    expect(html).toContain("Naive SOC MCP Agent 0.1.0");
    expect(html).toContain("receipt-after-001");
    expect(html).toContain("trace-saved-search-call");
    expect(html).toContain("evt-auth-001");
    expect(html).toContain("Loaded artifacts");
    expect(html).not.toContain("hero");
    expect(html).not.toContain("chat");
    expect(html).not.toContain("copilot");
  });

  it("loads the after receipt as the current artifact when before and after receipts exist", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-ui-"));

    await writeJson(join(outDir, "receipt-before-001.json"), receipt({ id: "receipt-before-001", verdict: "NOT READY", score: 60 }));
    await writeJson(join(outDir, "receipt-after-001.json"), receipt());
    await writeJson(join(outDir, "trace-after.json"), [traceEvent("trace-saved-search-call")]);
    await writeJson(join(outDir, "violations-after.json"), []);

    const artifacts = await loadUiArtifacts(outDir);

    expect(artifacts.phase).toBe("after");
    expect(artifacts.receipt.verdict).toBe("READY");
    expect(artifacts.traceEvents).toHaveLength(1);
    expect(artifacts.violations).toEqual([]);
    expect(artifacts.paths.receipt).toBe(join(outDir, "receipt-after-001.json"));
  });

  it("renders deterministic violations when the current receipt is not ready", () => {
    const html = renderUiShell({
      phase: "before",
      outDir: "/tmp/splunkready-ui",
      receipt: receipt({
        id: "receipt-before-001",
        verdict: "NOT READY",
        score: 60,
        passedMissions: [],
        failedMissions: ["mission-security-lateral-movement-readiness"],
        criticalViolations: ["violation-evd-001"],
        violations: ["violation-evd-001"],
        rerunComparison: {}
      }),
      traceEvents: [traceEvent("trace-final-answer")],
      violations: [violation()],
      paths: {
        receipt: "/tmp/splunkready-ui/receipt-before-001.json",
        trace: "/tmp/splunkready-ui/trace-before.json",
        violations: "/tmp/splunkready-ui/violations-before.json"
      }
    });

    expect(html).toContain("NOT READY");
    expect(html).toContain("violation-evd-001");
    expect(html).toContain("EVD-001");
    expect(html).toContain("Final answer lacks saved-search provenance.");
  });

  it("writes a static shell HTML artifact for browser inspection", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-ui-write-"));

    await writeJson(join(outDir, "receipt-after-001.json"), receipt());
    await writeJson(join(outDir, "trace-after.json"), [traceEvent("trace-saved-search-call")]);
    await writeJson(join(outDir, "violations-after.json"), []);

    const shellPath = await writeUiShell(outDir);
    const html = await readFile(shellPath, "utf8");

    expect(shellPath).toBe(join(outDir, "splunkready-shell.html"));
    expect(html).toContain("Readiness Receipt");
    expect(html).toContain("receipt-after-001.json");
  });

  it("returns an actionable loading error when no receipt artifact exists", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-ui-missing-"));

    await expect(loadUiArtifacts(outDir)).rejects.toThrow("Run the SplunkReady CLI receipt or rerun command first");
  });
});
