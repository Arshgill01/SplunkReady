#!/usr/bin/env node

import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, relative } from "node:path";

import { exportPublicDemo } from "./export-public-demo.js";

const root = process.cwd();
const failures = [];

const fail = (message) => {
  failures.push(message);
};

const isSecretFileName = (name) => name === ".env" || name.startsWith(".env.") || name.startsWith(".splunkready");

const walk = (dir, files = []) => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const info = lstatSync(path);

    if (info.isSymbolicLink()) {
      fail(`public demo export must not contain symlink: ${relative(root, path)}`);
      continue;
    }

    if (isSecretFileName(basename(path))) {
      fail(`public demo export must not contain secret-named file: ${relative(root, path)}`);
      continue;
    }

    if (info.isDirectory()) {
      walk(path, files);
    } else if (info.isFile()) {
      files.push(path);
    }
  }

  return files;
};

try {
  const result = await exportPublicDemo({
    root,
    outDir: "artifacts/public-demo",
    generatedAt: "2026-06-06T00:00:00.000Z"
  });
  const outDir = result.outDir;

  for (const requiredPath of [
    "index.html",
    "public-demo-manifest.json",
    "artifacts/judge-launch/artifact-manifest.json",
    "artifacts/judge-launch/judge-launch.json",
    "artifacts/judge-launch/judge-launch.md",
    "artifacts/mcp-proof/artifact-manifest.json",
    "artifacts/mcp-proof/mcp-proof-summary.json",
    "artifacts/mcp-proof/mcp-category-scorecard.json",
    "artifacts/mcp-proof/mcp-client-walkthrough.json",
    "artifacts/mcp-proof/mcp-client-walkthrough.md",
    "artifacts/mcp-proof/mcp-client-session.jsonl",
    "artifacts/mcp-proof/mcp-client-session.md",
    "artifacts/mcp-transcript/artifact-manifest.json",
    "artifacts/mcp-transcript/mcp-transcript-certification.json",
    "artifacts/mcp-transcript/mcp-transcript-import.json",
    "artifacts/mcp-transcript/receipt-external-001.json",
    "artifacts/mcp-transcript/proof-audit.json",
    "artifacts/suite-proof/artifact-manifest.json",
    "artifacts/suite-proof/suite-proof-summary.json",
    "artifacts/ci-pr-gate/artifact-manifest.json",
    "artifacts/ci-pr-gate/ci-pr-gate.json",
    "artifacts/ci-pr-gate/pr-comment.md",
    "artifacts/ci-pr-gate/receipt-after-001.json",
    "artifacts/judge-proof/artifact-manifest.json",
    "artifacts/judge-proof/judge-proof-summary.json",
    "artifacts/judge-proof/judge-proof-summary.md",
    "artifacts/platform-devex-proof/artifact-manifest.json",
    "artifacts/platform-devex-proof/platform-devex-proof.json",
    "artifacts/platform-devex-proof/platform-devex-proof.md",
    "artifacts/platform-devex-proof/fixture-demo/receipt-before-001.json",
    "artifacts/platform-devex-proof/fixture-demo/receipt-after-001.json",
    "artifacts/platform-devex-proof/mcp-transcript/receipt-external-001.json",
    "artifacts/judge-proof/suite-proof/suite-proof-summary.json",
    "artifacts/judge-proof/firewall-check/firewall-block-before.json",
    "artifacts/judge-proof/certification-index.json",
    "artifacts/interactive-demo/artifact-manifest.json",
    "artifacts/interactive-demo/environment-contract.json",
    "artifacts/interactive-demo/missions.json",
    "artifacts/interactive-demo/trace-after.json",
    "artifacts/public-proof-export/artifact-manifest.json",
    "artifacts/public-proof-export/public-proof-summary.json",
    "artifacts/real-splunk-stress-llm-layer/artifact-manifest.json",
    "artifacts/real-splunk-stress-llm-layer/llm-deliberation-before.json",
    "artifacts/real-splunk-stress-llm-layer/llm-deliberation-after.json",
    "artifacts/real-splunk-stress-llm-layer/llm-claim-audit-before.json",
    "artifacts/real-splunk-stress-llm-layer/llm-claim-audit-after.json",
    "artifacts/real-splunk-stress-llm-layer/ui-artifacts.json",
    "artifacts/real-splunk-stress-llm-layer/real-splunk-stress-replay-summary.json",
    "screenshots/workbench-mcp-proof.png",
    "screenshots/workbench-llm-deliberation.png",
    "screenshots/public-demo-llm-deliberation.png"
  ]) {
    if (!existsSync(join(outDir, requiredPath))) {
      fail(`public demo export missing required file: ${requiredPath}`);
    }
  }

  const manifestPath = join(outDir, "public-demo-manifest.json");
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};

  if (manifest.source !== "splunkready-public-demo-export") {
    fail("public demo manifest source must be splunkready-public-demo-export");
  }

  if (manifest.mutation !== false) {
    fail("public demo manifest must preserve mutation=false");
  }

  if (manifest.defaultUrl !== "?artifacts=artifacts%2Fmcp-proof#mcp-proof") {
    fail("public demo manifest must point at the relative MCP proof workbench route");
  }

  if (manifest.interactiveUrl !== "?demo=interactive") {
    fail("public demo manifest must expose the hosted interactive certification route");
  }

  const expectedArtifactBases = [
    "artifacts/judge-launch",
    "artifacts/mcp-proof",
    "artifacts/suite-proof",
    "artifacts/ci-pr-gate",
    "artifacts/public-proof-export",
    "artifacts/real-splunk-stress-llm-layer",
    "artifacts/mcp-transcript",
    "artifacts/judge-proof",
    "artifacts/platform-devex-proof",
    "artifacts/interactive-demo"
  ];

  if (JSON.stringify(manifest.artifactBases) !== JSON.stringify(expectedArtifactBases)) {
    fail("public demo manifest artifactBases changed unexpectedly");
  }

  for (const artifactBase of expectedArtifactBases) {
    const artifactManifestPath = join(outDir, artifactBase, "artifact-manifest.json");
    const artifactManifest = existsSync(artifactManifestPath)
      ? JSON.parse(readFileSync(artifactManifestPath, "utf8"))
      : {};

    if (artifactManifest.source !== "splunkready-artifact-file-manifest") {
      fail(`artifact manifest source is invalid for ${artifactBase}`);
    }

    if (!Array.isArray(artifactManifest.files) || artifactManifest.files.length === 0) {
      fail(`artifact manifest has no files for ${artifactBase}`);
    }
  }

  const judgeProofPath = join(outDir, "artifacts/judge-proof/judge-proof-summary.json");
  const judgeProof = existsSync(judgeProofPath) ? JSON.parse(readFileSync(judgeProofPath, "utf8")) : {};
  const judgeLaunchPath = join(outDir, "artifacts/judge-launch/judge-launch.json");
  const judgeLaunch = existsSync(judgeLaunchPath) ? JSON.parse(readFileSync(judgeLaunchPath, "utf8")) : {};

  if (judgeLaunch.source !== "splunkready-judge-launch") {
    fail("public demo judge launch source must be splunkready-judge-launch");
  }

  if (judgeLaunch.status !== "READY_FOR_JUDGES") {
    fail("public demo judge launch must be READY_FOR_JUDGES");
  }

  if (judgeLaunch.mutation !== false) {
    fail("public demo judge launch must preserve mutation=false");
  }

  if (judgeLaunch.passFailAuthority !== "deterministic-rule-engine") {
    fail("public demo judge launch must keep deterministic pass/fail authority");
  }

  if (judgeLaunch.credentialFree !== true) {
    fail("public demo judge launch must be credential-free");
  }

  if (!Array.isArray(judgeLaunch.commands) || !judgeLaunch.commands.includes("npx -y splunkready@0.1.10 judge-proof --out ./judge-proof --json")) {
    fail("public demo judge launch must include the published no-clone judge-proof command");
  }

  if (judgeProof.source !== "splunkready-judge-proof") {
    fail("public demo judge proof source must be splunkready-judge-proof");
  }

  if (judgeProof.status !== "PASS") {
    fail("public demo judge proof must pass");
  }

  if (judgeProof.mutation !== false) {
    fail("public demo judge proof must preserve mutation=false");
  }

  if (judgeProof.llmEvidence?.passFailAuthority !== "deterministic-rule-engine") {
    fail("public demo judge proof must keep deterministic pass/fail authority");
  }

  if (judgeProof.llmEvidence?.status !== "NOT_REQUESTED") {
    fail("public demo judge proof must stay credential-free with LLM evidence NOT_REQUESTED");
  }

  const indexHtmlPath = join(outDir, "index.html");
  const indexHtml = existsSync(indexHtmlPath) ? readFileSync(indexHtmlPath, "utf8") : "";

  if (indexHtml.includes('src="/assets/') || indexHtml.includes('href="/assets/')) {
    fail("public demo index must use relative asset paths for project-site hosting");
  }

  const files = walk(outDir);

  if (failures.length > 0) {
    throw new Error(JSON.stringify({ failures }, null, 2));
  }

  console.log(
    `PASS public demo export audit (${relative(root, outDir)}; ${files.length} files; mutation=false; defaultRoute=mcp-proof)`
  );
} catch (error) {
  console.error(`FAIL public demo export audit: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
