#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const marker = "<!-- splunkready-live-readiness-pr-gate -->";

const parseArgs = (argv) => {
  const proofDirIndex = argv.indexOf("--proof-dir");
  const outIndex = argv.indexOf("--out");
  const jsonOutIndex = argv.indexOf("--json-out");

  return {
    proofDir: proofDirIndex >= 0 ? argv[proofDirIndex + 1] : "artifacts/pr-gate",
    outPath: outIndex >= 0 ? argv[outIndex + 1] : "artifacts/pr-gate/pr-comment.md",
    jsonOutPath: jsonOutIndex >= 0 ? argv[jsonOutIndex + 1] : "artifacts/pr-gate/ci-pr-gate.json"
  };
};

const readJson = async (path, label) => {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`Could not read ${label} at ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const requireValue = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const formatStatus = (status) => (status === "PASS" ? "PASS" : String(status ?? "UNKNOWN"));
const formatMutation = (mutation) => (mutation === false ? "No" : String(mutation));
const formatPath = (repoRoot, path) => relative(repoRoot, resolve(repoRoot, path)).split(sep).join("/");

const auditIsAcceptableForPrGate = (proofAudit) => {
  if (proofAudit.status === "PASS") {
    return true;
  }

  if (proofAudit.status !== "WARN" || proofAudit.proofType !== "live" || !Array.isArray(proofAudit.checks)) {
    return false;
  }

  const warnings = proofAudit.checks.filter((check) => check?.status === "WARN").map((check) => check.id);

  return warnings.length === 1 && warnings[0] === "live-security-summary";
};

const artifactPaths = {
  summary: "live-proof-summary.json",
  audit: "proof-audit.json",
  beforeReceipt: "receipt-before-001.json",
  afterReceipt: "receipt-after-001.json",
  policyPatch: "policy-patch.json"
};

export const buildPrGateSummary = async ({ proofDir, repoRoot = process.cwd(), generatedAt = new Date().toISOString() }) => {
  const proofRoot = resolve(repoRoot, proofDir);
  const liveSummary = await readJson(join(proofRoot, artifactPaths.summary), "live proof summary");
  const proofAudit = await readJson(join(proofRoot, artifactPaths.audit), "proof audit");
  const beforeReceipt = await readJson(join(proofRoot, artifactPaths.beforeReceipt), "before receipt");
  const afterReceipt = await readJson(join(proofRoot, artifactPaths.afterReceipt), "after receipt");
  const policyPatch = await readJson(join(proofRoot, artifactPaths.policyPatch), "policy patch");

  requireValue(liveSummary.status === "PASS", `live proof status must be PASS, got ${liveSummary.status}`);
  requireValue(liveSummary.mutation === false, "live proof must report mutation=false");
  requireValue(
    auditIsAcceptableForPrGate(proofAudit),
    `proof audit status must be PASS or only warn on live-security-summary, got ${proofAudit.status}`
  );
  requireValue(proofAudit.mutation === false, "proof audit must report mutation=false");

  const summary = {
    source: "splunkready-live-readiness-pr-gate",
    status: "PASS",
    generatedAt,
    proofDir: formatPath(repoRoot, proofRoot),
    mode: liveSummary.mode,
    mutation: false,
    proofLoop: liveSummary.proofLoop,
    failToPass: Boolean(liveSummary.failToPass),
    before: {
      verdict: beforeReceipt.verdict,
      score: beforeReceipt.score,
      violations: Array.isArray(beforeReceipt.violations) ? beforeReceipt.violations.length : liveSummary.before?.violations
    },
    after: {
      verdict: afterReceipt.verdict,
      score: afterReceipt.score,
      violations: Array.isArray(afterReceipt.violations) ? afterReceipt.violations.length : liveSummary.after?.violations
    },
    audit: {
      status: proofAudit.status,
      readyAfterPatch: proofAudit.readyAfterPatch,
      failToPass: proofAudit.failToPass,
      checkCount: Array.isArray(proofAudit.checks) ? proofAudit.checks.length : 0
    },
    policy: {
      patchId: policyPatch.id,
      ruleCount: Array.isArray(policyPatch.rules) ? policyPatch.rules.length : 0,
      violationRefs: Array.isArray(policyPatch.violationRefs) ? policyPatch.violationRefs.length : 0
    },
    hostedModels: {
      status: liveSummary.hostedModels?.status ?? "unknown",
      advisoryOnly: true,
      assistanceItems: liveSummary.hostedModels?.assistanceItems ?? 0
    },
    artifacts: Object.fromEntries(
      Object.entries(artifactPaths).map(([key, path]) => [key, `${formatPath(repoRoot, proofRoot)}/${path}`])
    )
  };

  requireValue(summary.before.verdict === "NOT READY", `before receipt must be NOT READY, got ${summary.before.verdict}`);
  requireValue(summary.after.verdict === "READY", `after receipt must be READY, got ${summary.after.verdict}`);
  requireValue(summary.failToPass, "live proof must demonstrate fail-to-pass");

  return summary;
};

export const renderPrGateComment = (summary) => `${marker}
## SplunkReady Live Readiness

| Result | Value |
| --- | --- |
| Verdict | ${formatStatus(summary.status)} |
| Mode | ${summary.mode} |
| Mutation | ${formatMutation(summary.mutation)} |
| Proof loop | ${summary.proofLoop} |
| Before | ${summary.before.verdict} / ${summary.before.score}/100 / ${summary.before.violations} violation(s) |
| After | ${summary.after.verdict} / ${summary.after.score}/100 / ${summary.after.violations} violation(s) |
| Policy patch | ${summary.policy.patchId} / ${summary.policy.ruleCount} rule(s) / ${summary.policy.violationRefs} violation ref(s) |
| Proof audit | ${summary.audit.status}${summary.audit.status === "WARN" ? " (generic live proof; not flagship live-security proof)" : ""} / ${summary.audit.checkCount} check(s) |
| Hosted model evidence | ${summary.hostedModels.status} / advisory only |

Artifacts:

- ${summary.artifacts.summary}
- ${summary.artifacts.audit}
- ${summary.artifacts.beforeReceipt}
- ${summary.artifacts.afterReceipt}
- ${summary.artifacts.policyPatch}

SplunkReady did not call live Splunk and did not mutate Splunk in this PR gate. The proof uses the credential-free mock Splunk MCP live adapter path.
`;

export const writePrGateComment = async ({ proofDir, outPath, jsonOutPath, repoRoot = process.cwd() }) => {
  const summary = await buildPrGateSummary({ proofDir, repoRoot });
  const comment = renderPrGateComment(summary);
  const markdownPath = resolve(repoRoot, outPath);
  const jsonPath = resolve(repoRoot, jsonOutPath);

  await mkdir(dirname(markdownPath), { recursive: true });
  await mkdir(dirname(jsonPath), { recursive: true });
  await writeFile(markdownPath, comment, "utf8");
  await writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  return { summary, comment, markdownPath, jsonPath };
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await writePrGateComment(parseArgs(process.argv.slice(2)));
    console.log(
      JSON.stringify(
        {
          status: result.summary.status,
          mutation: result.summary.mutation,
          markdownPath: result.markdownPath,
          jsonPath: result.jsonPath
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error(`FAIL PR gate comment render: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
