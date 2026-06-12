import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  environmentContractSchema,
  policyPatchSchema,
  readinessProfileSchema,
  readinessReceiptSchema,
  traceEventSchema,
  violationSchema,
  type EnvironmentContract,
  type PolicyPatch,
  type ReadinessProfile,
  type ReadinessReceipt,
  type TraceEvent,
  type Violation
} from "../schemas/core.js";
import { parseMissionDefinition, type MissionDefinition } from "../missions/dsl.js";

import {
  escapeHtml,
  escapeValue,
  renderRefGroup,
  renderTraceEvents,
  renderViolations,
  verdictClass
} from "./shell/helpers.js";
import { renderContractView } from "./shell/contractView.js";
import { renderMissionTraceView } from "./shell/traceView.js";
import { renderCertificationReplay } from "./shell/replayView.js";
import { renderReceiptRerunView, renderArtifactPaths } from "./shell/rerunView.js";

export interface UiArtifactPaths {
  contract?: string;
  missions?: string;
  beforeTrace?: string;
  beforeViolations?: string;
  afterTrace?: string;
  afterViolations?: string;
  beforeReceipt?: string;
  afterReceipt?: string;
  policyPatchJson?: string;
  policyPatchMarkdown?: string;
  readinessProfile?: string;
  receipt: string;
  trace: string;
  violations: string;
}

export interface UiArtifacts {
  phase: "before" | "after";
  outDir: string;
  contract?: EnvironmentContract;
  missions: MissionDefinition[];
  receipt: ReadinessReceipt;
  beforeReceipt?: ReadinessReceipt;
  afterReceipt?: ReadinessReceipt;
  policyPatch?: PolicyPatch;
  readinessProfile?: ReadinessProfile;
  traceEvents: TraceEvent[];
  violations: Violation[];
  beforeTraceEvents?: TraceEvent[];
  beforeViolations?: Violation[];
  afterTraceEvents?: TraceEvent[];
  afterViolations?: Violation[];
  paths: UiArtifactPaths;
}

const exists = async (path: string): Promise<boolean> =>
  stat(path)
    .then(() => true)
    .catch(() => false);

const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8"));

const readOptionalTrace = async (path: string): Promise<TraceEvent[]> => {
  if (!(await exists(path))) {
    return [];
  }

  return traceEventSchema.array().parse(await readJson(path));
};

const readOptionalViolations = async (path: string): Promise<Violation[]> => {
  if (!(await exists(path))) {
    return [];
  }

  return violationSchema.array().parse(await readJson(path));
};

const readOptionalReceipt = async (path: string): Promise<ReadinessReceipt | undefined> => {
  if (!(await exists(path))) {
    return undefined;
  }

  return readinessReceiptSchema.parse(await readJson(path));
};

const readOptionalPolicyPatch = async (path: string): Promise<PolicyPatch | undefined> => {
  if (!(await exists(path))) {
    return undefined;
  }

  return policyPatchSchema.parse(await readJson(path));
};

const readOptionalContract = async (path: string): Promise<EnvironmentContract | undefined> => {
  if (!(await exists(path))) {
    return undefined;
  }

  return environmentContractSchema.parse(await readJson(path));
};

const readOptionalReadinessProfile = async (path: string): Promise<ReadinessProfile | undefined> => {
  if (!(await exists(path))) {
    return undefined;
  }

  return readinessProfileSchema.parse(await readJson(path));
};

const readOptionalMissions = async (path: string): Promise<MissionDefinition[]> => {
  if (!(await exists(path))) {
    return [];
  }

  const input = await readJson(path);

  if (!Array.isArray(input)) {
    throw new Error(`Expected missions artifact at ${path} to be an array.`);
  }

  return input.map((mission) => parseMissionDefinition(mission));
};

const currentReceiptPath = async (outDir: string): Promise<{ phase: "before" | "after"; path: string }> => {
  const afterPath = join(outDir, "receipt-after-001.json");

  if (await exists(afterPath)) {
    return { phase: "after", path: afterPath };
  }

  const beforePath = join(outDir, "receipt-before-001.json");

  if (await exists(beforePath)) {
    return { phase: "before", path: beforePath };
  }

  throw new Error(
    `Unable to load a Readiness Receipt from ${outDir}. Run the SplunkReady CLI receipt or rerun command first.`
  );
};

export const loadUiArtifacts = async (outDir: string): Promise<UiArtifacts> => {
  const current = await currentReceiptPath(outDir);
  const receipt = readinessReceiptSchema.parse(await readJson(current.path));
  const contractPath = join(outDir, "environment-contract.json");
  const missionsPath = join(outDir, "missions.json");
  const beforeTracePath = join(outDir, "trace-before.json");
  const beforeViolationsPath = join(outDir, "violations-before.json");
  const afterTracePath = join(outDir, "trace-after.json");
  const afterViolationsPath = join(outDir, "violations-after.json");
  const beforeReceiptPath = join(outDir, "receipt-before-001.json");
  const afterReceiptPath = join(outDir, "receipt-after-001.json");
  const policyPatchPath = join(outDir, "policy-patch.json");
  const policyPatchMarkdownPath = join(outDir, "policy-patch.md");
  const readinessProfilePath = join(outDir, "readiness-profile.json");
  const tracePath = join(outDir, `trace-${current.phase}.json`);
  const violationPath = join(outDir, `violations-${current.phase}.json`);
  const beforeTraceEvents = await readOptionalTrace(beforeTracePath);
  const beforeViolations = await readOptionalViolations(beforeViolationsPath);
  const afterTraceEvents = await readOptionalTrace(afterTracePath);
  const afterViolations = await readOptionalViolations(afterViolationsPath);

  return {
    phase: current.phase,
    outDir,
    contract: await readOptionalContract(contractPath),
    missions: await readOptionalMissions(missionsPath),
    receipt,
    beforeReceipt: await readOptionalReceipt(beforeReceiptPath),
    afterReceipt: await readOptionalReceipt(afterReceiptPath),
    policyPatch: await readOptionalPolicyPatch(policyPatchPath),
    readinessProfile: await readOptionalReadinessProfile(readinessProfilePath),
    traceEvents: current.phase === "after" ? afterTraceEvents : beforeTraceEvents,
    violations: current.phase === "after" ? afterViolations : beforeViolations,
    beforeTraceEvents,
    beforeViolations,
    afterTraceEvents,
    afterViolations,
    paths: {
      contract: contractPath,
      missions: missionsPath,
      beforeTrace: beforeTracePath,
      beforeViolations: beforeViolationsPath,
      afterTrace: afterTracePath,
      afterViolations: afterViolationsPath,
      beforeReceipt: beforeReceiptPath,
      afterReceipt: afterReceiptPath,
      policyPatchJson: policyPatchPath,
      policyPatchMarkdown: policyPatchMarkdownPath,
      readinessProfile: readinessProfilePath,
      receipt: current.path,
      trace: tracePath,
      violations: violationPath
    }
  };
};

export const renderUiShell = (artifacts: UiArtifacts): string => {
  const { receipt } = artifacts;
  const criticalCount = receipt.criticalViolations.length;
  const violationCount = receipt.violations.length;
  const evidenceCount = receipt.evidenceRefs.length;
  const traceCount = receipt.traceRefs.length;
  const resolvedViolations = Array.isArray(artifacts.receipt.rerunComparison.resolvedViolations)
    ? artifacts.receipt.rerunComparison.resolvedViolations.map((value) => String(value))
    : [];
  const modeDetail =
    receipt.mode === "fixture"
      ? "Fixture mode: reproducible local fixture; no live Splunk mutation."
      : "Live mode: operator-supplied Splunk MCP context; no automatic Splunk mutation.";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="data:,">
  <title>SplunkReady - Readiness Receipt</title>
  <style>
    html {
      scroll-behavior: smooth;
    }

    :root {
      color-scheme: dark;
      --page: #211d10;
      --ink: #ebe7db;
      --muted: #b8b0a1;
      --line: #756f60;
      --surface: #211d10;
      --surface-2: #302a1c;
      --paper: #211d10;
      --paper-cell: #2a2300;
      --paper-line: #756f60;
      --rail: #211d10;
      --rail-muted: #c9c2b5;
      --accent: #b45224;
      --ready: #76e0bd;
      --review: #d9aa4f;
      --blocked: #ff8175;
      --max-content: 100%;
    }

    * {
      box-sizing: border-box;
    }

    [hidden] {
      display: none !important;
    }

    body {
      margin: 0;
      background: var(--page);
      color: var(--ink);
      font-family: "Aptos", "Helvetica Neue", sans-serif;
      font-size: 14px;
      line-height: 1.45;
    }

    code {
      font-family: "SF Mono", "Menlo", monospace;
      font-size: 12px;
      overflow-wrap: anywhere;
    }

    .app-shell {
      min-height: 100vh;
    }

    .side-nav {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 22px;
      position: fixed;
      top: 0;
      bottom: 0;
      left: 0;
      width: 300px;
      height: 100vh;
      overflow: hidden;
      background: var(--rail);
      color: var(--ink);
      border-right: 1px solid var(--paper-line);
      padding: 26px 24px 20px;
    }

    .side-nav > div:first-child {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
    }

    .brand {
      font-size: 19px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .tagline {
      color: var(--rail-muted);
      margin: 0;
    }

    .side-nav nav {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      margin-top: 28px;
      padding: 18px 0;
      border-top: 1px solid var(--paper-line);
      border-bottom: 1px solid var(--paper-line);
      justify-content: space-between;
    }

    .side-nav a {
      display: flex;
      align-items: center;
      color: var(--ink);
      text-decoration: none;
      min-height: 36px;
      padding: 0 0 0 16px;
      border-left: 1px solid rgba(117, 111, 96, 0.55);
      transition: background-color 0.15s ease;
    }

    .side-nav a:last-child {
      border-left: 1px solid rgba(117, 111, 96, 0.55);
    }

    .side-nav a:hover {
      background: transparent;
      color: #fffaf0;
    }

    .side-nav a[aria-current="page"] {
      background: transparent;
      color: #fffaf0;
      border-left-color: var(--ink);
      font-weight: 700;
    }

    .side-nav a[aria-current="page"]:hover {
      background: transparent;
    }

    .side-status {
      border: 1px solid var(--paper-line);
      border-left: 0;
      border-right: 0;
      padding: 10px 0 0;
      background: transparent;
      color: var(--rail-muted);
    }

    .side-status span {
      display: block;
      color: var(--ready);
      font-weight: 700;
      margin-bottom: 6px;
    }

    .side-status code {
      color: var(--ink);
    }

    .side-status p {
      margin: 8px 0 0;
      color: var(--muted);
      font-size: 12px;
    }

    .content {
      min-width: 0;
      min-height: 100vh;
      margin-left: 300px;
      padding: 28px 34px;
      background: var(--page);
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      max-width: var(--max-content);
      margin: 0 auto;
      padding: 0 0 24px;
      background: transparent;
      border-bottom: 1px solid var(--line);
    }

    h1,
    h2,
    h3 {
      margin: 0;
      font-weight: 680;
    }

    h1 {
      font-size: 22px;
    }

    h2 {
      font-size: 16px;
      margin-bottom: 14px;
    }

    h3 {
      font-size: 14px;
      margin-bottom: 10px;
    }

    .subtle {
      color: var(--muted);
      margin: 4px 0 0;
    }

    .mode-indicator {
      border: 1px solid var(--line);
      padding: 7px 10px;
      background: var(--paper-cell);
      color: var(--ink);
      max-width: 360px;
    }

    .mode-label {
      white-space: nowrap;
      font-weight: 650;
    }

    .mode-detail {
      display: block;
      color: var(--muted);
      font-size: 12px;
      margin-top: 2px;
    }

    .readiness-flow {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 18px;
    }

    .readiness-step {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      padding: 10px 12px;
      background: transparent;
      border: 1px solid var(--line);
      color: var(--muted);
    }

    .readiness-step-complete {
      border-color: #d7a48d;
      color: var(--ink);
    }

    .step-index {
      display: grid;
      place-items: center;
      width: 24px;
      height: 24px;
      flex: 0 0 auto;
      border-radius: 999px;
      background: #343020;
      color: var(--ink);
      font-weight: 700;
      font-size: 12px;
    }

    .readiness-step-complete .step-index {
      background: var(--paper-line);
      color: var(--ink);
    }

    .readiness-step strong {
      display: block;
    }

    .readiness-step span {
      display: block;
      font-size: 12px;
      color: var(--muted);
    }

    .replay-invocation {
      max-width: var(--max-content);
      margin: 0 auto 10px;
      color: var(--muted);
    }

    .replay-card {
      display: flex;
      flex-direction: column;
      background: var(--paper);
      color: var(--ink);
      border: 1px solid var(--paper-line);
      max-width: var(--max-content);
      margin: 0 auto;
    }

    .replay-card-header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(180px, max-content);
      gap: 18px;
      align-items: start;
      padding: 18px 20px 16px;
      border-bottom: 1px solid var(--paper-line);
      background: var(--paper);
      color: var(--ink);
    }

    .replay-card-header p,
    .replay-card-header span {
      display: block;
      margin: 0;
      color: var(--muted);
      font-size: 12px;
    }

    .replay-card-header h2 {
      margin: 3px 0 5px;
      font-size: 20px;
    }

    .replay-card-header strong {
      justify-self: end;
      padding: 7px 9px;
      border: 1px solid var(--paper-line);
      background: var(--paper-cell);
      color: var(--ink);
      font-size: 13px;
    }

    .replay-card-rail {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      background: #302a1c;
      border-bottom: 1px solid var(--paper-line);
    }

    .replay-card-rail button {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      padding: 9px 10px;
      border-right: 1px solid var(--paper-line);
      border-top: 0;
      border-bottom: 0;
      border-left: 0;
      background: transparent;
      color: var(--ink);
      font: inherit;
      font-size: 13px;
      font-weight: 650;
      text-align: left;
      cursor: pointer;
      transition: background-color 0.15s ease;
    }

    .replay-card-rail button:last-child {
      border-right: 0;
    }

    .replay-card-rail button:hover,
    .replay-card-rail button[aria-current="true"] {
      background: var(--paper);
    }

    .replay-card-rail span,
    .replay-section-title span {
      display: grid;
      place-items: center;
      width: 22px;
      height: 22px;
      flex: 0 0 auto;
      border: 1px solid currentColor;
      font-size: 12px;
      font-weight: 700;
    }

    .replay-card-body {
      flex: 1;
      background: var(--paper);
      color: var(--ink);
    }

    .replay-card-section {
      padding: 18px 20px 20px;
      border-bottom: 1px solid var(--paper-line);
    }

    .replay-section-title {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }

    .replay-section-title h3 {
      margin: 0;
      font-size: 15px;
    }

    .tbl {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      border-top: 1px solid var(--paper-line);
      border-left: 1px solid var(--paper-line);
      background: var(--paper-cell);
    }

    .tbl.col-3 {
      grid-template-columns: minmax(92px, 0.55fr) minmax(0, 1.55fr) minmax(160px, 0.9fr);
    }

    .tbl.col-patch {
      grid-template-columns: 180px minmax(0, 1.4fr) minmax(180px, 0.8fr);
    }

    .cell {
      min-width: 0;
      padding: 9px 10px;
      border-right: 1px solid var(--paper-line);
      border-bottom: 1px solid var(--paper-line);
      overflow-wrap: anywhere;
    }

    .cell b {
      display: block;
      margin-bottom: 4px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 650;
    }

    .cell span {
      display: block;
    }

    .cell.step {
      background: #2f2a18;
    }

    .replay-card-section .empty {
      background: var(--paper-cell);
      color: var(--muted);
      border-color: var(--paper-line);
      padding: 12px;
    }

    .replay-compile {
      display: grid;
      grid-template-columns: minmax(0, 0.8fr) minmax(0, 0.8fr) minmax(0, 1.6fr);
      gap: 0;
      background: #17130a;
      color: var(--ink);
      border-top: 1px solid var(--paper-line);
    }

    .replay-compile span,
    .replay-compile code {
      padding: 10px 12px;
      border-right: 1px solid var(--paper-line);
    }

    .replay-compile code {
      color: var(--ink);
    }

    .receipt-strip {
      display: grid;
      grid-template-columns: 240px repeat(4, minmax(120px, 1fr));
      gap: 0;
      max-width: var(--max-content);
      margin: 0 auto;
      background: transparent;
      border-bottom: 1px solid var(--line);
    }

    .verdict-cell,
    .metric-cell {
      padding: 18px 22px;
      border-right: 1px solid var(--line);
    }

    .metric-cell:last-child {
      border-right: 0;
    }

    .cell-label {
      color: var(--muted);
      margin-bottom: 5px;
    }

    .cell-value {
      font-size: 22px;
      font-weight: 700;
    }

    .verdict-ready .cell-value {
      color: var(--ready);
    }

    .verdict-review .cell-value {
      color: var(--review);
    }

    .verdict-blocked .cell-value {
      color: var(--blocked);
    }

    .shell-section {
      padding: 32px 0 0;
      max-width: var(--max-content);
      margin: 0 auto;
      border: 0;
      background: transparent;
    }

    #certification-replay {
      padding: 0;
      border: 0;
      background: transparent;
    }

    .section-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.8fr);
      gap: 24px;
    }

    .contract-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 24px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--paper);
      border: 1px solid var(--line);
    }

    th,
    td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }

    th {
      background: var(--surface-2);
      font-weight: 650;
    }

    tr:last-child td {
      border-bottom: 0;
    }

    tbody tr {
      transition: background-color 0.1s ease;
    }

    tbody tr:hover td {
      background: #292515;
    }

    .trace-limit-row td {
      color: var(--muted);
      text-align: center;
      background: var(--surface-2);
      font-size: 12px;
    }

    .stacked-table {
      margin-top: 12px;
    }

    .trace-phases {
      display: grid;
      gap: 24px;
      margin-top: 24px;
    }

    .receipt-comparison {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 24px;
    }

    .timeline-table th:nth-child(4),
    .timeline-table td:nth-child(4) {
      width: 34%;
    }

    .check-badge {
      display: inline-block;
      margin: 0 4px 4px 0;
      padding: 2px 6px;
      border: 1px solid var(--line);
      border-radius: 4px;
      font-size: 12px;
      white-space: nowrap;
    }

    .check-badge-pass {
      color: var(--ready);
      background: #193126;
    }

    .check-badge-resolved {
      color: var(--muted);
      background: var(--surface-2);
    }

    .check-badge-failed {
      color: var(--blocked);
      background: #3a201b;
    }

    .inline-violations {
      margin-top: 8px;
      padding-left: 16px;
      color: var(--blocked);
    }

    ul {
      margin: 0;
      padding-left: 18px;
    }

    li {
      margin-bottom: 7px;
    }

    .artifact-paths {
      margin: 0;
      background: var(--paper);
      border: 1px solid var(--line);
    }

    .artifact-paths div {
      display: grid;
      grid-template-columns: 96px minmax(0, 1fr);
      gap: 12px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
    }

    .artifact-paths div:last-child {
      border-bottom: 0;
    }

    dt {
      color: var(--muted);
    }

    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }

    .empty {
      margin: 0;
      color: var(--muted);
      background: var(--paper-cell);
      border: 1px solid var(--line);
      padding: 12px;
    }

    .provenance-columns {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 24px;
    }

    .ref-groups {
      display: grid;
      gap: 16px;
    }

    @media (max-width: 920px) {
      .app-shell {
        display: block;
      }

      .side-nav {
        position: static;
        width: auto;
        height: auto;
        border-right: 0;
        border-bottom: 1px solid var(--paper-line);
        min-height: auto;
      }

      .content {
        margin-left: 0;
      }

      .receipt-strip,
      .section-grid,
      .contract-grid,
      .receipt-comparison,
      .provenance-columns,
      .replay-card-header,
      .replay-card-rail,
      .tbl,
      .tbl.col-3,
      .tbl.col-patch,
      .replay-compile {
        grid-template-columns: 1fr;
      }

      .verdict-cell,
      .metric-cell {
        border-right: 0;
        border-bottom: 1px solid var(--line);
      }

      .topbar {
        align-items: flex-start;
        flex-direction: column;
      }

      .readiness-flow {
        grid-template-columns: 1fr;
      }

      .replay-card-header strong {
        justify-self: start;
      }

      .replay-card-rail button,
      .replay-compile span,
      .replay-compile code {
        border-right: 0;
        border-bottom: 1px solid var(--paper-line);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      html {
        scroll-behavior: auto;
      }

      .side-nav a,
      .replay-card-rail button,
      tbody tr {
        transition: none;
      }
    }
  </style>
</head>
<body>
  <div class="app-shell">
    <aside class="side-nav" aria-label="SplunkReady sections">
      <div>
        <div class="brand">SplunkReady</div>
        <p class="tagline">Certify AI agents before they touch production Splunk.</p>
        <nav>
          <a aria-current="page" href="#receipt">Readiness Receipt</a>
          <a href="#certification-replay">Replay</a>
          <a href="#contract">Contract</a>
          <a href="#mission-trace">Mission trace</a>
          <a href="#rerun-receipts">Rerun receipts</a>
          <a href="#provenance">Provenance</a>
          <a href="#violations">Violations</a>
          <a href="#artifacts">Artifacts</a>
        </nav>
      </div>
      <div class="side-status">
        <span>${escapeHtml(receipt.verdict)} / ${escapeValue(receipt.score)}/100</span>
        <code>${escapeHtml(receipt.mode)} · ${escapeHtml(artifacts.phase)}</code>
        <p>${escapeHtml(receipt.generatedBy ?? "Agent Readiness Compiler")}</p>
      </div>
    </aside>
    <main class="content">
      <header class="topbar" data-route-panel="receipt">
        <div>
          <h1>Readiness Receipt</h1>
          <p class="subtle">Agent Readiness Compiler output for ${escapeHtml(receipt.agent.name)} ${escapeHtml(receipt.agent.version)}</p>
        </div>
        <div class="mode-indicator">
          <span class="mode-label">${escapeHtml(receipt.mode)} mode / ${escapeHtml(artifacts.phase)} run</span>
          <span class="mode-detail">${escapeHtml(modeDetail)}</span>
        </div>
      </header>

      <section id="receipt" class="receipt-strip" data-route-panel="receipt" aria-label="Current agent verdict">
        <div class="verdict-cell ${verdictClass(receipt.verdict)}">
          <div class="cell-label">Current verdict</div>
          <div class="cell-value">${escapeHtml(receipt.verdict)}</div>
        </div>
        <div class="metric-cell">
          <div class="cell-label">Score</div>
          <div class="cell-value">${escapeValue(receipt.score)}</div>
        </div>
        <div class="metric-cell">
          <div class="cell-label">Violations</div>
          <div class="cell-value">${escapeValue(violationCount)}</div>
        </div>
        <div class="metric-cell">
          <div class="cell-label">Trace refs</div>
          <div class="cell-value">${escapeValue(traceCount)}</div>
        </div>
        <div class="metric-cell">
          <div class="cell-label">Evidence refs</div>
          <div class="cell-value">${escapeValue(evidenceCount)}</div>
        </div>
      </section>

      ${renderCertificationReplay(artifacts)}

      <section class="shell-section" data-route-panel="receipt" aria-label="Receipt identity">
        <div class="section-grid">
          <div>
            <h2>${escapeHtml(receipt.id)}</h2>
            <table>
              <tbody>
                <tr><th>Environment</th><td>${escapeHtml(receipt.environment.name)} <code>${escapeHtml(receipt.environment.id)}</code></td></tr>
                ${
                  receipt.policy
                    ? `<tr><th>Policy</th><td>${escapeHtml(receipt.policy.name)} ${escapeHtml(receipt.policy.version)} <code>${escapeHtml(receipt.policy.id)}</code></td></tr>`
                    : ""
                }
                <tr><th>Contract</th><td>${escapeHtml(receipt.contractVersion)}</td></tr>
                <tr><th>Mission suite</th><td>${escapeHtml(receipt.missionSuiteVersion)}</td></tr>
                <tr><th>Generated by</th><td>${escapeHtml(receipt.generatedBy ?? "Agent Readiness Compiler")}</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <h2>Rerun comparison</h2>
            <table>
              <tbody>
                <tr><th>Critical violations</th><td>${escapeValue(criticalCount)}</td></tr>
                <tr><th>Resolved violations</th><td>${escapeValue(resolvedViolations.length)}</td></tr>
                <tr><th>Passed missions</th><td>${escapeValue(receipt.passedMissions.length)}</td></tr>
                <tr><th>Failed missions</th><td>${escapeValue(receipt.failedMissions.length)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      ${renderReceiptRerunView(artifacts)}

      ${renderContractView(artifacts)}

      ${renderMissionTraceView(artifacts)}

      <section id="provenance" class="shell-section" data-route-panel="provenance" aria-label="Trace and evidence provenance">
        <div class="section-grid">
          <div>
            <h2>Trace events</h2>
            ${renderTraceEvents(artifacts.traceEvents)}
          </div>
          <div>
            <h2>Receipt refs</h2>
            <div class="ref-groups">
              ${renderRefGroup("Trace refs", receipt.traceRefs, "No trace refs.")}
              ${renderRefGroup("Evidence refs", receipt.evidenceRefs, "No evidence refs.")}
              ${renderRefGroup("Violation refs", receipt.violations, "No violation refs.")}
            </div>
          </div>
        </div>
      </section>

      <section id="violations" class="shell-section" data-route-panel="violations" aria-label="Deterministic violations">
        <h2>Deterministic violations</h2>
        ${renderViolations(artifacts.violations)}
      </section>

      <section id="artifacts" class="shell-section" data-route-panel="artifacts" aria-label="Loaded artifact paths">
        <h2>Loaded artifacts</h2>
        ${renderArtifactPaths(artifacts.paths)}
      </section>
    </main>
  </div>
  <script>
    window.addEventListener("DOMContentLoaded", () => {
      const links = Array.from(document.querySelectorAll(".side-nav a"));
      const routePanels = Array.from(document.querySelectorAll("[data-route-panel]"));
      const validRoutes = new Set(links.map((link) => link.getAttribute("href")?.slice(1)).filter(Boolean));
      const normalizeRoute = (hash) => {
        const route = (hash || "#receipt").replace(/^#/, "");
        return validRoutes.has(route) ? route : "receipt";
      };
      const showRoute = (route, shouldScroll = true) => {
        const activeHash = "#" + route;

        links.forEach((link) => {
          if (link.getAttribute("href") === activeHash) {
            link.setAttribute("aria-current", "page");
          } else {
            link.removeAttribute("aria-current");
          }
        });

        routePanels.forEach((panel) => {
          if (panel.getAttribute("data-route-panel") === route) {
            panel.removeAttribute("hidden");
          } else {
            panel.setAttribute("hidden", "");
          }
        });

        if (shouldScroll) {
          window.scrollTo({ top: 0, left: 0 });
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
        }
      };

      links.forEach((link) => {
        link.addEventListener("click", (event) => {
          const route = normalizeRoute(link.getAttribute("href") || "#receipt");

          event.preventDefault();
          history.pushState(null, "", "#" + route);
          showRoute(route);
        });
      });

      window.addEventListener("popstate", () => {
        showRoute(normalizeRoute(window.location.hash));
      });
      window.addEventListener("hashchange", () => {
        showRoute(normalizeRoute(window.location.hash));
      });
      showRoute(normalizeRoute(window.location.hash), false);

      const replayTargets = Array.from(document.querySelectorAll("[data-replay-target]"));
      const replaySections = Array.from(document.querySelectorAll("[data-replay-section]"));
      const activateReplayTarget = (target) => {
        const targetId = target.getAttribute("data-replay-target");

        replayTargets.forEach((candidate) => {
          if (candidate === target) {
            candidate.setAttribute("aria-current", "true");
            candidate.setAttribute("aria-selected", "true");
          } else {
            candidate.removeAttribute("aria-current");
            candidate.setAttribute("aria-selected", "false");
          }
        });

        replaySections.forEach((section) => {
          if (section.id === targetId) {
            section.removeAttribute("hidden");
          } else {
            section.setAttribute("hidden", "");
          }
        });
      };

      replayTargets.forEach((target) => {
        target.addEventListener("click", () => {
          activateReplayTarget(target);
        });

        target.addEventListener("keydown", (event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            return;
          }

          event.preventDefault();
          const currentIndex = replayTargets.indexOf(target);
          const nextIndex =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? replayTargets.length - 1
                : event.key === "ArrowRight"
                  ? (currentIndex + 1) % replayTargets.length
                  : (currentIndex - 1 + replayTargets.length) % replayTargets.length;
          const nextTarget = replayTargets[nextIndex];

          nextTarget.focus();
          activateReplayTarget(nextTarget);
        });
      });
    });
  </script>
</body>
</html>`;
};

export const writeUiShell = async (outDir: string, targetPath = join(outDir, "splunkready-shell.html")): Promise<string> => {
  const html = renderUiShell(await loadUiArtifacts(outDir));

  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${html}\n`, "utf8");

  return targetPath;
};
