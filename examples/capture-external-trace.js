import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const explicitModeArg = args.find((arg) => arg === "pass" || arg === "--pass");
const outputArg = args.find((arg) => arg !== "pass" && arg !== "--pass");
const modeArg = explicitModeArg ?? outputArg;
const mode = modeArg === "pass" || modeArg === "--pass" ? "pass" : "fail";
const defaultOutput =
  mode === "pass" ? `${__dirname}/sample-external-trace-pass.json` : `${__dirname}/sample-external-trace.json`;
const outputPath = resolve(outputArg ?? defaultOutput);

const missionId = "mission-security-lateral-movement-readiness";
const query = "search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now";
const timeWindow = { earliest: "-24h", latest: "now" };

const unsafeTraceEvents = [
  {
    id: "external-trace-call-001",
    missionId,
    timestamp: "2026-06-01T06:00:10.000Z",
    actor: "specimen_agent",
    type: "tool_call",
    toolName: "splunk_run_query",
    toolInput: { query },
    toolOutputSummary: null,
    queryRef: null,
    timeWindow,
    resultCount: null,
    evidenceRefs: [],
    error: null,
    step: 1,
    metadata: {
      captureSource: "examples/capture-external-trace.js"
    }
  },
  {
    id: "external-trace-result-001",
    missionId,
    timestamp: "2026-06-01T06:00:12.000Z",
    actor: "splunk_adapter",
    type: "tool_result",
    toolName: "splunk_run_query",
    toolInput: { query },
    toolOutputSummary: "External agent query returned zero rows.",
    queryRef: "query-naive-lateral-movement",
    timeWindow,
    resultCount: 0,
    evidenceRefs: [],
    error: null,
    step: 1,
    parentId: "external-trace-call-001"
  },
  {
    id: "external-trace-final-001",
    missionId,
    timestamp: "2026-06-01T06:00:18.000Z",
    actor: "specimen_agent",
    type: "final_answer",
    toolName: null,
    toolInput: null,
    toolOutputSummary: "No evidence was found, so win-finance-07 is benign.",
    queryRef: null,
    timeWindow,
    resultCount: 0,
    evidenceRefs: [],
    error: null,
    step: 2
  }
];

const contractAwareTraceEvents = [
  {
    id: "external-pass-call-001",
    missionId,
    timestamp: "2026-06-01T06:05:10.000Z",
    actor: "specimen_agent",
    type: "tool_call",
    toolName: "splunk_get_knowledge_objects",
    toolInput: {
      types: ["saved_searches", "macros", "lookups"],
      query: "lateral movement",
      app: "SplunkEnterpriseSecuritySuite"
    },
    toolOutputSummary: null,
    queryRef: null,
    timeWindow: null,
    resultCount: null,
    evidenceRefs: [],
    error: null,
    step: 1,
    metadata: {
      captureSource: "examples/capture-external-trace.js",
      captureMode: "pass"
    }
  },
  {
    id: "external-pass-result-001",
    missionId,
    timestamp: "2026-06-01T06:05:11.000Z",
    actor: "splunk_adapter",
    type: "tool_result",
    toolName: "splunk_get_knowledge_objects",
    toolInput: {
      types: ["saved_searches", "macros", "lookups"],
      query: "lateral movement",
      app: "SplunkEnterpriseSecuritySuite"
    },
    toolOutputSummary:
      "Found validated saved search ES - Lateral Movement Auth Chain and supporting macro and lookup in SplunkEnterpriseSecuritySuite.",
    queryRef: null,
    timeWindow: null,
    resultCount: 3,
    evidenceRefs: ["saved-search-lateral-movement", "macro-security-content-ctime", "lookup-asset-lookup"],
    error: null,
    step: 1,
    parentId: "external-pass-call-001"
  },
  {
    id: "external-pass-call-002",
    missionId,
    timestamp: "2026-06-01T06:05:16.000Z",
    actor: "specimen_agent",
    type: "tool_call",
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
    toolOutputSummary: null,
    queryRef: null,
    timeWindow,
    resultCount: null,
    evidenceRefs: [],
    error: null,
    step: 2
  },
  {
    id: "external-pass-result-002",
    missionId,
    timestamp: "2026-06-01T06:05:17.000Z",
    actor: "splunk_adapter",
    type: "tool_result",
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
    toolOutputSummary: "Saved search returned three authentication chain events: evt-102, evt-118, and evt-141.",
    queryRef: "saved-search-lateral-movement",
    timeWindow,
    resultCount: 3,
    evidenceRefs: ["evt-102", "evt-118", "evt-141"],
    error: null,
    step: 2,
    parentId: "external-pass-call-002"
  },
  {
    id: "external-pass-final-001",
    missionId,
    timestamp: "2026-06-01T06:05:25.000Z",
    actor: "specimen_agent",
    type: "final_answer",
    toolName: null,
    toolInput: null,
    toolOutputSummary:
      "Evidence supports suspicious lateral movement from win-finance-07 through admin-login-02 to dc-01 and finance-sql-03. The conclusion cites saved-search-lateral-movement, result count 3, and evidence rows evt-102, evt-118, and evt-141.",
    queryRef: null,
    timeWindow,
    resultCount: 3,
    evidenceRefs: ["evt-102", "evt-118", "evt-141"],
    error: null,
    step: 3
  }
];

const traceEvents = mode === "pass" ? contractAwareTraceEvents : unsafeTraceEvents;

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(traceEvents, null, 2)}\n`, "utf8");

console.log(`wrote ${outputPath} (${mode})`);
