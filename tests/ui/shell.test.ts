import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadUiArtifacts, renderUiShell, writeUiShell, type UiArtifactPaths } from "../../src/ui/shell.js";
import type { EnvironmentContract, PolicyPatch, ReadinessReceipt, TraceEvent, Violation } from "../../src/schemas/core.js";
import type { MissionDefinition } from "../../src/missions/dsl.js";

const artifactPaths = (outDir = "/tmp/splunkready-ui"): UiArtifactPaths => ({
  contract: join(outDir, "environment-contract.json"),
  missions: join(outDir, "missions.json"),
  beforeTrace: join(outDir, "trace-before.json"),
  beforeViolations: join(outDir, "violations-before.json"),
  afterTrace: join(outDir, "trace-after.json"),
  afterViolations: join(outDir, "violations-after.json"),
  beforeReceipt: join(outDir, "receipt-before-001.json"),
  afterReceipt: join(outDir, "receipt-after-001.json"),
  policyPatchJson: join(outDir, "policy-patch.json"),
  policyPatchMarkdown: join(outDir, "policy-patch.md"),
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

const failedReceipt = (): ReadinessReceipt =>
  receipt({
    id: "receipt-before-001",
    verdict: "NOT READY",
    score: 60,
    passedMissions: [],
    failedMissions: ["mission-security-lateral-movement-readiness"],
    criticalViolations: ["violation-spl-001", "violation-spl-001", "violation-evd-001"],
    violations: ["violation-spl-001", "violation-evd-001"],
    policyPatchSummary: [{ id: "patch-security-readiness", status: "exported" }],
    rerunComparison: {}
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

const beforeTrace = (): TraceEvent[] => [
  {
    id: "trace-before-query",
    missionId: "mission-security-lateral-movement-readiness",
    timestamp: "2026-06-01T06:31:00.000Z",
    actor: "specimen_agent",
    type: "tool_call",
    toolName: "splunk_run_query",
    toolInput: { query: "search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now" },
    toolOutputSummary: null,
    queryRef: null,
    timeWindow: { earliest: "-24h", latest: "now" },
    resultCount: null,
    evidenceRefs: [],
    error: null,
    step: 1
  },
  {
    id: "trace-before-result",
    missionId: "mission-security-lateral-movement-readiness",
    timestamp: "2026-06-01T06:31:01.000Z",
    actor: "splunk_adapter",
    type: "tool_result",
    toolName: "splunk_run_query",
    toolInput: null,
    toolOutputSummary: "Query used a broad index pattern and stale field.",
    queryRef: "query-naive-lateral-movement",
    timeWindow: { earliest: "-24h", latest: "now" },
    resultCount: 0,
    evidenceRefs: [],
    error: null,
    step: 2,
    parentId: "trace-before-query"
  }
];

const afterTrace = (): TraceEvent[] => [
  traceEvent("trace-after-saved-search"),
  {
    ...traceEvent("trace-after-result"),
    actor: "splunk_adapter",
    type: "tool_result",
    toolInput: null,
    toolOutputSummary: "Saved search returned 3 evidence rows.",
    queryRef: "saved-search-lateral-movement",
    resultCount: 3,
    parentId: "trace-after-saved-search"
  }
];

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

const broadQueryViolation = (): Violation => ({
  id: "violation-spl-001",
  missionId: "mission-security-lateral-movement-readiness",
  traceEventId: "trace-before-query",
  ruleId: "SPL-001",
  severity: "High",
  reason: "Query used forbidden broad index pattern index=*.",
  evidence: { query: "search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now" },
  suggestedPolicyPatch: "Use authorized indexes and validated saved searches.",
  evidenceRefs: []
});

const answerViolation = (): Violation => ({
  id: "violation-ans-001",
  missionId: "mission-security-lateral-movement-readiness",
  traceEventId: "trace-final-answer",
  ruleId: "ANS-001",
  severity: "Critical",
  reason: "Final answer gave an unsupported benign conclusion.",
  evidence: { finalAnswerId: "trace-final-answer" },
  suggestedPolicyPatch: "Require uncertainty and evidence refs before final conclusions.",
  evidenceRefs: []
});

const policyPatch = (): PolicyPatch => ({
  id: "patch-security-readiness",
  createdAt: "2026-06-01T06:45:00.000Z",
  sourceReceiptId: "receipt-before-001",
  targetAgent: { name: "Naive SOC MCP Agent", version: "0.1.0" },
  rules: [
    {
      id: "use-validated-saved-search",
      text: "Discover and run SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain before custom SPL."
    },
    {
      id: "carry-evidence-refs",
      text: "Carry result count, saved-search provenance, and evidence refs into the final answer."
    }
  ],
  violationRefs: ["violation-spl-001", "violation-evd-001"],
  status: "exported",
  summary: "Patch the agent policy for the security readiness rerun."
});

const contract = (): EnvironmentContract => ({
  id: "contract-acme-soc-dev",
  name: "acme-soc-dev",
  version: "2026.06.01",
  generatedAt: "2026-06-01T06:30:00.000Z",
  mode: "fixture",
  indexes: [
    { name: "wineventlog", sensitive: false },
    { name: "finance_pii", sensitive: true }
  ],
  restrictedIndexes: ["finance_pii"],
  sourcetypes: [{ name: "XmlWinEventLog:Security", fields: ["src", "dest", "user", "signature", "EventCode"] }],
  canonicalFields: {
    auth_source: "src",
    auth_destination: "dest",
    auth_user: "user"
  },
  macros: [{ name: "security_content_ctime", app: "SplunkEnterpriseSecuritySuite" }],
  lookups: [{ name: "asset_lookup", app: "SplunkEnterpriseSecuritySuite" }],
  savedSearches: [
    { name: "ES - Lateral Movement Auth Chain", app: "search" },
    { name: "ES - Lateral Movement Auth Chain", app: "SplunkEnterpriseSecuritySuite" }
  ],
  dashboardPanels: [],
  dataModels: [
    {
      id: "data-model-authentication",
      type: "data_models",
      name: "Authentication",
      app: "SplunkEnterpriseSecuritySuite",
      metadata: { fields: ["src", "dest", "user"], absentFields: ["src_ip"] }
    }
  ],
  appContexts: ["SplunkEnterpriseSecuritySuite", "search"],
  mcpTools: ["splunk_get_knowledge_objects", "splunk_run_saved_search", "splunk_run_query"],
  queryBudgets: { maxToolCalls: 6, maxResultRows: 50, timeoutSeconds: 30 },
  evidenceRules: [{ id: "security-evidence", requiresResultCount: true, requiresEvidenceRefs: true }],
  forbiddenQueryPatterns: ["index=*"]
});

const mission = (): MissionDefinition => ({
  id: "mission-security-lateral-movement-readiness",
  title: "Investigate lateral movement from win-finance-07",
  domain: "security",
  prompt: "Investigate possible lateral movement from win-finance-07 over the last 24 hours.",
  requestedTimeWindow: { earliest: "-24h", latest: "now" },
  expectedTools: ["splunk_get_knowledge_objects", "splunk_run_saved_search"],
  allowedTools: ["splunk_get_knowledge_objects", "splunk_run_saved_search", "splunk_run_query"],
  forbiddenPatterns: ["index=*"],
  requiredEvidence: [{ type: "result_count" }, { type: "evidence_refs" }],
  checks: ["SPL-001", "SPL-003", "KO-001", "KO-002", "EVD-001", "EVD-002", "SAF-002"],
  severityWeights: { Critical: 25, High: 15, Medium: 8, Low: 2 },
  authorizedIndexes: ["wineventlog"],
  preferredSavedSearchRefs: ["SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain"],
  requiresSavedSearchDiscovery: true
});

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

describe("SplunkReady UI shell", () => {
  it("renders an operational first screen from receipt and provenance artifacts", () => {
    const html = renderUiShell({
      phase: "after",
      outDir: "/tmp/splunkready-ui",
      contract: contract(),
      missions: [mission()],
      receipt: receipt(),
      traceEvents: [traceEvent("trace-saved-search-call")],
      violations: [],
      paths: artifactPaths()
    });

    expect(html).toContain("SplunkReady");
    expect(html).toContain("Certify AI agents before they touch production Splunk.");
    expect(html).toContain("fixture mode / after run");
    expect(html).toContain("Fixture mode: reproducible local fixture; no live Splunk mutation.");
    expect(html).toContain("Current verdict");
    expect(html).toContain("READY");
    expect(html).toContain("Naive SOC MCP Agent 0.1.0");
    expect(html).toContain("receipt-after-001");
    expect(html).toContain("trace-saved-search-call");
    expect(html).toContain("evt-auth-001");
    expect(html).toContain("Trace refs");
    expect(html).toContain("Evidence refs");
    expect(html).toContain("Violation refs");
    expect(html).toContain("Loaded artifacts");
    expect(html).not.toContain("hero");
    expect(html).not.toContain("chat");
    expect(html).not.toContain("copilot");
  });

  it("loads the after receipt as the current artifact when before and after receipts exist", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-ui-"));

    await writeJson(join(outDir, "receipt-before-001.json"), receipt({ id: "receipt-before-001", verdict: "NOT READY", score: 60 }));
    await writeJson(join(outDir, "receipt-after-001.json"), receipt());
    await writeJson(join(outDir, "policy-patch.json"), policyPatch());
    await writeJson(join(outDir, "environment-contract.json"), contract());
    await writeJson(join(outDir, "missions.json"), [mission()]);
    await writeJson(join(outDir, "trace-before.json"), beforeTrace());
    await writeJson(join(outDir, "violations-before.json"), [broadQueryViolation()]);
    await writeJson(join(outDir, "trace-after.json"), afterTrace());
    await writeJson(join(outDir, "violations-after.json"), []);

    const artifacts = await loadUiArtifacts(outDir);

    expect(artifacts.phase).toBe("after");
    expect(artifacts.receipt.verdict).toBe("READY");
    expect(artifacts.beforeReceipt?.verdict).toBe("NOT READY");
    expect(artifacts.afterReceipt?.score).toBe(100);
    expect(artifacts.policyPatch?.id).toBe("patch-security-readiness");
    expect(artifacts.contract?.restrictedIndexes).toEqual(["finance_pii"]);
    expect(artifacts.missions[0]?.preferredSavedSearchRefs).toContain("SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain");
    expect(artifacts.traceEvents).toHaveLength(2);
    expect(artifacts.beforeTraceEvents).toHaveLength(2);
    expect(artifacts.beforeViolations).toHaveLength(1);
    expect(artifacts.afterTraceEvents).toHaveLength(2);
    expect(artifacts.violations).toEqual([]);
    expect(artifacts.paths.receipt).toBe(join(outDir, "receipt-after-001.json"));
  });

  it("renders the compiled contract evidence behind the security readiness trap", () => {
    const html = renderUiShell({
      phase: "after",
      outDir: "/tmp/splunkready-ui",
      contract: contract(),
      missions: [mission()],
      receipt: receipt(),
      traceEvents: [traceEvent("trace-saved-search-call")],
      violations: [],
      paths: artifactPaths()
    });

    expect(html).toContain("Environment contract");
    expect(html).toContain("finance_pii");
    expect(html).toContain("restricted");
    expect(html).toContain("XmlWinEventLog:Security");
    expect(html).toContain("<code>src</code>");
    expect(html).toContain("src_ip");
    expect(html).toContain("absent from Authentication");
    expect(html).toContain("SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain");
    expect(html).toContain("preferred for mission");
    expect(html).toContain("maxToolCalls");
    expect(html).toContain("security-evidence");
    expect(html).toContain("requiresEvidenceRefs: true");
  });

  it("renders failing and passing mission traces with inline violations and evidence", () => {
    const duplicateViolation = broadQueryViolation();
    const html = renderUiShell({
      phase: "after",
      outDir: "/tmp/splunkready-ui",
      contract: contract(),
      missions: [mission()],
      receipt: receipt(),
      traceEvents: afterTrace(),
      violations: [],
      beforeTraceEvents: beforeTrace(),
      beforeViolations: [duplicateViolation, duplicateViolation],
      afterTraceEvents: afterTrace(),
      afterViolations: [],
      paths: artifactPaths()
    });

    expect(html).toContain("Mission and trace");
    expect(html).toContain("Investigate lateral movement from win-finance-07");
    expect(html).toContain("Failing trace before patch");
    expect(html).toContain("splunk_run_query");
    expect(html).toContain("search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now");
    expect(html).toContain("violation-spl-001");
    expect(html).toContain("SPL-001");
    expect(html).toContain("Passing trace after patch");
    expect(html).toContain("splunk_run_saved_search");
    expect(html).toContain("ES - Lateral Movement Auth Chain");
    expect(html).toContain("evt-auth-001");
    expect(html.match(/violation-spl-001/g)).toHaveLength(1);
  });

  it("renders mission deterministic checks from before and after violation evidence", () => {
    const html = renderUiShell({
      phase: "after",
      outDir: "/tmp/splunkready-ui",
      contract: contract(),
      missions: [mission()],
      receipt: receipt(),
      traceEvents: afterTrace(),
      violations: [],
      beforeTraceEvents: beforeTrace(),
      beforeViolations: [broadQueryViolation()],
      afterTraceEvents: afterTrace(),
      afterViolations: [],
      afterReceipt: receipt(),
      paths: artifactPaths()
    });

    expect(html).toContain("Deterministic checks");
    expect(html).toContain("SPL-001 resolved");
    expect(html).toContain("EVD-002 pass");
    expect(html).not.toContain("SPL-001 failed");
  });

  it("scopes deterministic check badges to each mission's own violations", () => {
    const unaffectedMission: MissionDefinition = {
      ...mission(),
      id: "mission-unaffected-saved-search-readiness",
      title: "Unaffected mission",
      checks: ["SPL-001", "EVD-002"]
    };
    const html = renderUiShell({
      phase: "after",
      outDir: "/tmp/splunkready-ui",
      contract: contract(),
      missions: [mission(), unaffectedMission],
      receipt: receipt(),
      traceEvents: afterTrace(),
      violations: [],
      beforeTraceEvents: beforeTrace(),
      beforeViolations: [broadQueryViolation()],
      afterTraceEvents: afterTrace(),
      afterViolations: [],
      afterReceipt: receipt(),
      paths: artifactPaths()
    });
    const unaffectedMissionRow = html.slice(html.indexOf("Unaffected mission"));

    expect(unaffectedMissionRow).toContain("SPL-001 pass");
    expect(unaffectedMissionRow).toContain("EVD-002 pass");
    expect(unaffectedMissionRow).not.toContain("SPL-001 resolved");
  });

  it("renders failed receipt, policy patch, rerun receipt, and score comparison", () => {
    const failed = failedReceipt();
    failed.criticalViolations = [...failed.criticalViolations, "violation-ans-001"];
    failed.violations = [...failed.violations, "violation-ans-001"];

    const html = renderUiShell({
      phase: "after",
      outDir: "/tmp/splunkready-ui",
      contract: contract(),
      missions: [mission()],
      receipt: receipt(),
      beforeReceipt: failed,
      afterReceipt: receipt(),
      policyPatch: policyPatch(),
      traceEvents: afterTrace(),
      violations: [],
      beforeTraceEvents: beforeTrace(),
      beforeViolations: [broadQueryViolation(), violation(), answerViolation()],
      afterTraceEvents: afterTrace(),
      afterViolations: [],
      paths: artifactPaths()
    });

    expect(html).toContain("Receipts and rerun");
    expect(html).toContain("Readiness lifecycle");
    expect(html).toContain("<strong>Fail</strong><span>complete</span>");
    expect(html).toContain("<strong>Patch</strong><span>complete</span>");
    expect(html).toContain("<strong>Rerun</strong><span>complete</span>");
    expect(html).toContain("<strong>Pass</strong><span>complete</span>");
    const replaySectionStart = html.indexOf('<section id="certification-replay"');
    const replayCardStart = html.indexOf('<article class="replay-card"', replaySectionStart);
    const replay = html.slice(replaySectionStart, html.indexOf("</article>", replayCardStart));

    expect(replay).toContain("$ splc verify --replay --mode=fixture --out=/tmp/splunkready-ui");
    expect(replay).toContain("Readiness Pre-Flight Card");
    expect(replay).toContain("SplunkReady / Agent Readiness Compiler");
    expect(replay).toContain("Naive SOC MCP Agent 0.1.0 against ACME SOC Dev");
    expect(replay).toContain("READY / 100/100");
    expect(replay).toContain('class="replay-card"');
    expect(replay).toContain('data-replay-target="sec-a"');
    expect(replay).toContain('data-replay-target="sec-b"');
    expect(replay).toContain('data-replay-target="sec-c"');
    expect(replay).toContain('data-replay-target="sec-d"');
    expect(replay).toContain('data-replay-target="sec-e"');
    expect(replay).toContain('aria-controls="sec-a"');
    expect(replay).toContain('data-replay-section');
    expect(replay.match(/data-replay-section/g)).toHaveLength(5);
    expect(replay.match(/hidden/g)).toHaveLength(4);
    expect(replay).not.toContain('href="#sec-a"');
    expect(replay).toContain("Contract");
    expect(replay).toContain("acme-soc-dev / 2026.06.01");
    expect(replay).toContain("6 calls / 50 rows / 30s");
    expect(replay).toContain("allow wineventlog / restrict finance_pii");
    expect(replay).toContain("SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain");
    expect(replay).toContain("Trace A - before patch");
    expect(replay).toContain("trace-before-query");
    expect(replay).toContain("search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now");
    expect(replay).toContain("refs (none)");
    expect(html).toContain("Deterministic rules");
    expect(replay).toContain("SPL-001");
    expect(replay).toContain("EVD-001");
    expect(replay).toContain("ANS-001");
    expect(replay).toContain("Query used forbidden broad index pattern index=*.");
    expect(replay).toContain("Use authorized indexes and validated saved searches.");
    expect(replay).toContain("Final answer lacks saved-search provenance.");
    expect(replay).toContain("Final answer gave an unsupported benign conclusion.");
    expect(replay).toContain("Policy patch");
    expect(replay).toContain("patch-security-readiness");
    expect(replay).toContain("use-validated-saved-search");
    expect(replay).toContain("carry-evidence-refs");
    expect(replay).toContain("exported for review / no auto-apply");
    expect(replay).toContain("Trace B - after patch");
    expect(replay).toContain("evt-auth-001");
    expect(replay).toContain("readiness");
    expect(replay).toContain("before");
    expect(replay).toContain("NOT READY / 60/100 / 4 critical");
    expect(replay).toContain("after");
    expect(replay).toContain("0 violation(s) / 0 critical");
    expect(replay).toContain("compiled by Agent Readiness Compiler");
    expect(replay).toContain("fixture mode / no live Splunk mutation");
    expect(replay).toContain("environment-contract.json");
    expect(replay).toContain("trace-before.json");
    expect(replay).toContain("trace-after.json");
    expect(replay).not.toContain("<table");
    expect(replay).not.toContain("Forensic Compiler Dossier");
    expect(replay).not.toContain('class="replay-panel"');
    expect(replay).not.toContain('role="tablist"');
    expect(replay).not.toContain('data-replay-target="replay-rules"');
    expect(replay).not.toMatch(/live pulse/i);
    expect(replay).not.toMatch(/real-time/i);
    expect(replay).not.toMatch(/auto-mutate/i);
    expect(replay).not.toMatch(/dashboard/i);
    expect(replay).not.toMatch(/chart/i);
    expect(replay).not.toMatch(/✨|🚀|🛡️/);
    expect(html).toContain("Failed receipt");
    expect(html).toContain("receipt-before-001");
    expect(html).toContain("NOT READY");
    expect(html).toContain("Rerun receipt");
    expect(html).toContain("receipt-after-001");
    expect(html).toContain("READY");
    expect(html).toContain("<td>60</td>");
    expect(html).toContain("<td>100</td>");
    expect(html).toContain("patch-security-readiness");
    expect(html).toContain("use-validated-saved-search");
    expect(html).toContain("carry-evidence-refs");
    expect(html).toContain("Critical issues and fixes");
    expect(html).toContain("violation-spl-001");
    expect(html).toContain("violation-ans-001");
    expect(html.slice(html.indexOf("violation-ans-001"), html.indexOf("violation-ans-001") + 500)).toContain(
      "carry-evidence-refs"
    );
    expect(html).toContain("Before receipt");
    expect(html).toContain("Policy patch JSON");
    expect(html).toContain('data-route-panel="receipt"');
    expect(html).toContain('data-route-panel="certification-replay"');
    expect(html).toContain('data-route-panel="contract"');
    expect(html).toContain("showRoute(route);");
    expect(html).toContain("window.scrollTo({ top: 0, left: 0 });");
    expect(html).toContain('section.setAttribute("hidden", "")');
    expect(html).not.toContain("display:none");
    expect(html).not.toContain("fonts.googleapis");
    expect(html).not.toContain("backdrop-filter");
    expect(html).not.toContain("linear-gradient");
    expect(html).not.toContain("radial-gradient");
    expect(html).toContain("color-scheme: dark");
    expect(html).not.toContain("color-scheme: light");
    expect(html).not.toMatch(/letter-spacing:\s*-/);
    expect(html).not.toMatch(/transform\s*:/);
    expect(html).toContain("scroll-behavior: smooth;");
    expect(html).toContain("@media (prefers-reduced-motion: reduce)");
    expect(html).toContain(".side-nav a:hover");
    expect(html).toContain("tbody tr:hover td");
    expect(html).toContain('window.addEventListener("hashchange", () =>');
    expect(html).toContain('event.key === "ArrowRight"');
    expect(html).toContain("activateReplayTarget(nextTarget)");
    expect(html).toContain("--page: #211d10;");
    expect(html).toContain("--surface: #211d10;");
    expect(html).toContain("--surface-2: #302a1c;");
    expect(html).toContain("--line: #756f60;");
    expect(html).toContain("--max-content: 100%;");
    expect(html).toContain("justify-content: space-between;");
    expect(html).toContain("position: fixed;");
    expect(html).toContain("width: 300px;");
    expect(html).toContain("height: 100vh;");
    expect(html).toContain("margin-left: 300px;");
    expect(html).toContain("overflow: hidden;");
    expect(html).toContain("background: transparent;");
    expect(html).toContain("border: 0;");
    expect(html).not.toContain("--page: #11140f;");
    expect(html).not.toContain("--surface: #181c18;");
    expect(html).not.toContain("--surface-2: #20241f;");
    expect(html).not.toContain("--line: #4a4f4a;");
    expect(html).not.toContain("max-width: 1360px");
  });


  it("renders deterministic violations when the current receipt is not ready", () => {
    const html = renderUiShell({
      phase: "before",
      outDir: "/tmp/splunkready-ui",
      contract: contract(),
      missions: [mission()],
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
        contract: "/tmp/splunkready-ui/environment-contract.json",
        missions: "/tmp/splunkready-ui/missions.json",
        receipt: "/tmp/splunkready-ui/receipt-before-001.json",
        trace: "/tmp/splunkready-ui/trace-before.json",
        violations: "/tmp/splunkready-ui/violations-before.json"
      }
    });

    expect(html).toContain("NOT READY");
    expect(html).toContain("violation-evd-001");
    expect(html).toContain("EVD-001");
    expect(html).toContain("Final answer lacks saved-search provenance.");
    expect(html).toContain("Failed receipt");
    expect(html).toContain("<strong>Fail</strong><span>complete</span>");
    expect(html).toContain("<strong>Rerun</strong><span>pending</span>");
    expect(html).toContain("No receipt-after-001.json artifact loaded.");
  });

  it("writes a static shell HTML artifact for browser inspection", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-ui-write-"));

    await writeJson(join(outDir, "receipt-after-001.json"), receipt());
    await writeJson(join(outDir, "receipt-before-001.json"), failedReceipt());
    await writeJson(join(outDir, "policy-patch.json"), policyPatch());
    await writeJson(join(outDir, "environment-contract.json"), contract());
    await writeJson(join(outDir, "missions.json"), [mission()]);
    await writeJson(join(outDir, "trace-before.json"), beforeTrace());
    await writeJson(join(outDir, "violations-before.json"), [broadQueryViolation()]);
    await writeJson(join(outDir, "trace-after.json"), afterTrace());
    await writeJson(join(outDir, "violations-after.json"), []);

    const shellPath = await writeUiShell(outDir);
    const html = await readFile(shellPath, "utf8");

    expect(shellPath).toBe(join(outDir, "splunkready-shell.html"));
    expect(html).toContain("Readiness Receipt");
    expect(html).toContain("Environment contract");
    expect(html).toContain("Mission and trace");
    expect(html).toContain("Receipts and rerun");
    expect(html).toContain("receipt-after-001.json");
  });

  it("returns an actionable loading error when no receipt artifact exists", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-ui-missing-"));

    await expect(loadUiArtifacts(outDir)).rejects.toThrow("Run the SplunkReady CLI receipt or rerun command first");
  });

  it("renders contract table fallback rows when compiled object lists are empty", () => {
    const emptyContract: EnvironmentContract = {
      ...contract(),
      indexes: [],
      restrictedIndexes: [],
      sourcetypes: [],
      canonicalFields: {},
      savedSearches: [],
      dataModels: []
    };

    const html = renderUiShell({
      phase: "after",
      outDir: "/tmp/splunkready-ui",
      contract: emptyContract,
      missions: [mission()],
      receipt: receipt(),
      traceEvents: [],
      violations: [],
      paths: artifactPaths()
    });

    expect(html).toContain("No indexes compiled in contract.");
    expect(html).toContain("No sourcetypes compiled in contract.");
    expect(html).toContain("No canonical fields or absent fields compiled in contract.");
    expect(html).toContain("No saved searches compiled in contract.");
  });

  it("signals when the receipt overview shows a truncated trace event list", () => {
    const traceEvents = Array.from({ length: 10 }, (_, index) => traceEvent(`trace-event-${index + 1}`));

    const html = renderUiShell({
      phase: "after",
      outDir: "/tmp/splunkready-ui",
      contract: contract(),
      missions: [mission()],
      receipt: receipt(),
      traceEvents,
      violations: [],
      paths: artifactPaths()
    });

    expect(html).toContain("Showing 8 of 10 events. View full trace in the Mission trace section.");
  });
});
